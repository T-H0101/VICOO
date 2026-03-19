from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
import xml.etree.ElementTree as ET
import secrets

from app.database import get_db
from app.models.payment import PaymentTransaction
from app.schemas import ApiResponse, PaymentCreate, PaymentOut, PaginatedResponse, WeChatPaymentParams
from app.deps import get_current_user
from app.services.payment_service import payment_service

router = APIRouter(prefix="/payments", tags=["Payments"])

_mock_payments = [
    {"id": 1, "order_id": 1, "donation_id": None, "amount": "257.00", "method": "wechat", "provider_transaction_id": "wx2025040110001", "status": "success", "created_at": "2025-04-01T10:05:00"},
    {"id": 2, "order_id": 2, "donation_id": None, "amount": "258.00", "method": "alipay", "provider_transaction_id": "ali2025040514002", "status": "success", "created_at": "2025-04-05T14:05:00"},
    {"id": 3, "order_id": 3, "donation_id": None, "amount": "368.00", "method": "wechat", "provider_transaction_id": "wx2025041016003", "status": "success", "created_at": "2025-04-10T16:05:00"},
    {"id": 4, "order_id": None, "donation_id": 1, "amount": "500.00", "method": "wechat", "provider_transaction_id": "wx20250301123456", "status": "success", "created_at": "2025-03-01T10:35:00"},
    {"id": 5, "order_id": None, "donation_id": 3, "amount": "2000.00", "method": "wechat", "provider_transaction_id": "wx20250303789012", "status": "success", "created_at": "2025-03-03T09:05:00"},
    {"id": 6, "order_id": 5, "donation_id": None, "amount": "326.00", "method": "alipay", "provider_transaction_id": "ali2025042009005", "status": "success", "created_at": "2025-04-20T09:05:00"},
]


@router.post("/create", response_model=ApiResponse, status_code=201)
async def create_payment(body: PaymentCreate, db: AsyncSession = Depends(get_db)):
    """Initiate a payment (create payment transaction record)."""
    try:
        tx = PaymentTransaction(
            order_id=body.order_id,
            donation_id=body.donation_id,
            amount=body.amount,
            method=body.method,
            status="pending",
        )
        db.add(tx)
        await db.flush()
        return ApiResponse(data=PaymentOut.model_validate(tx).model_dump())
    except Exception:
        new_id = max(p["id"] for p in _mock_payments) + 1 if _mock_payments else 1
        new_payment = {
            "id": new_id,
            "order_id": body.order_id,
            "donation_id": body.donation_id,
            "amount": str(body.amount),
            "method": body.method,
            "provider_transaction_id": f"{body.method}_pending_{secrets.randbelow(90000) + 10000}",
            "status": "pending",
            "created_at": "2025-06-01T00:00:00",
        }
        _mock_payments.append(new_payment)
        return ApiResponse(data=new_payment)


@router.post("/wechat-notify")
async def wechat_notify(request: Request):
    """Handle WeChat payment notification callback.

    Security: This is a public endpoint called by WeChat servers.
    Authentication is performed via WeChat signature verification,
    not via user session cookies.
    """
    # Read the raw XML body from the request
    xml_body = await request.body()

    try:
        # Parse the XML
        root = ET.fromstring(xml_body)

        # Convert XML to dictionary
        params = {}
        for child in root:
            params[child.tag] = child.text

        # Verify the signature
        if not payment_service.verify_payment_signature(params):
            # Signature verification failed
            # WeChat expects a specific XML response for failures
            return Response(
                content="<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Signature verification failed]]></return_msg></xml>",
                media_type="application/xml"
            )

        # Signature is valid, process the payment
        # Check result_code from WeChat
        result_code = params.get("result_code")
        if result_code != "SUCCESS":
            # Payment failed or pending, WeChat expects failure response
            return Response(
                content=f"<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Payment result is not SUCCESS: {result_code}]]></return_msg></xml>",
                media_type="application/xml"
            )

        # Check transaction_id existence
        transaction_id = params.get("transaction_id")
        if not transaction_id:
            return Response(
                content="<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Missing transaction_id]]></return_msg></xml>",
                media_type="application/xml"
            )

        out_trade_no = params.get("out_trade_no")

        # In production: update payment status, update order/donation
        # Ensure idempotency: check if transaction_id already processed

        # Example logic to update database (mocked for now)
        # In a real scenario, you would query the DB by out_trade_no and update the status

        # Return success response to WeChat
        return Response(
            content="<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>",
            media_type="application/xml"
        )

    except ET.ParseError:
        return Response(
            content="<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[Invalid XML format]]></return_msg></xml>",
            media_type="application/xml"
        )
    except Exception as e:
        return Response(
            content=f"<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[{str(e)}]]></return_msg></xml>",
            media_type="application/xml"
        )


@router.post("/alipay-notify", response_model=ApiResponse)
async def alipay_notify():
    """Handle Alipay payment notification callback."""
    # In production: verify signature, update payment status, update order/donation
    return ApiResponse(data={"message": "Alipay notification received"})


@router.get("/test-wechat-params", response_model=ApiResponse)
async def test_wechat_params():
    """Test endpoint to verify WeChat payment parameter generation."""
    try:
        payment_params = payment_service.create_unified_order(
            order_no="TEST123",
            amount=Decimal("100.00"),
            description="Test Donation",
            trade_type="JSAPI",
            donation_id=999
        )
        return ApiResponse(data=payment_params)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{payment_id}", response_model=ApiResponse)
async def get_payment(payment_id: int, db: AsyncSession = Depends(get_db)):
    """Get a payment transaction by ID."""
    try:
        stmt = select(PaymentTransaction).where(PaymentTransaction.id == payment_id)
        result = await db.execute(stmt)
        tx = result.scalar_one_or_none()
        if not tx:
            raise HTTPException(status_code=404, detail="Payment not found")
        return ApiResponse(data=PaymentOut.model_validate(tx).model_dump())
    except HTTPException:
        raise
    except Exception:
        for p in _mock_payments:
            if p["id"] == payment_id:
                return ApiResponse(data=p)
        raise HTTPException(status_code=404, detail="Payment not found")
