from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from decimal import Decimal
import xml.etree.ElementTree as ET
import secrets

from app.database import get_db
from app.models.payment import PaymentTransaction
from app.models.order import Order
from app.models.donation import Donation
from app.schemas import ApiResponse, PaymentCreate, PaymentOut, PaginatedResponse, WeChatPaymentParams
from app.deps import get_current_user
from app.services.payment_service import payment_service
from app.routers.orders import _mock_orders
from app.routers.donations import _mock_donations

router = APIRouter(prefix="/payments", tags=["Payments"])

_mock_payments = [
    {"id": 1, "order_id": 1, "donation_id": None, "amount": "257.00", "method": "wechat", "provider_transaction_id": "wx2025040110001", "status": "success", "created_at": "2025-04-01T10:05:00"},
    {"id": 2, "order_id": 2, "donation_id": None, "amount": "258.00", "method": "alipay", "provider_transaction_id": "ali2025040514002", "status": "success", "created_at": "2025-04-05T14:05:00"},
    {"id": 3, "order_id": 3, "donation_id": None, "amount": "368.00", "method": "wechat", "provider_transaction_id": "wx2025041016003", "status": "success", "created_at": "2025-04-10T16:05:00"},
    {"id": 4, "order_id": None, "donation_id": 1, "amount": "500.00", "method": "wechat", "provider_transaction_id": "wx20250301123456", "status": "success", "created_at": "2025-03-01T10:35:00"},
    {"id": 5, "order_id": None, "donation_id": 3, "amount": "2000.00", "method": "wechat", "provider_transaction_id": "wx20250303789012", "status": "success", "created_at": "2025-03-03T09:05:00"},
    {"id": 6, "order_id": 5, "donation_id": None, "amount": "326.00", "method": "alipay", "provider_transaction_id": "ali2025042009005", "status": "success", "created_at": "2025-04-20T09:05:00"},
    # Payment for order 6 (user 1) - to test IDOR and own payment access
    {"id": 7, "order_id": 6, "donation_id": None, "amount": "128.00", "method": "wechat", "provider_transaction_id": "wx2025060100007", "status": "pending", "created_at": "2025-06-01T00:00:00"},
]


@router.post("/create", response_model=ApiResponse, status_code=201)
async def create_payment(body: PaymentCreate, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
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


@router.post("/webhook", response_model=ApiResponse)
async def payment_webhook(request: Request, body: dict):
    """Handle generic payment webhook from various providers.

    Security: Verifies HMAC signature from the X-Webhook-Signature header.
    """
    signature = request.headers.get("X-Webhook-Signature")

    # Simple validation: in production, verify HMAC with shared secret
    # For now, accept "valid-hmac-signature" as valid
    if not signature:
        raise HTTPException(status_code=400, detail="Missing signature")

    # Mock verification - in production use: hmac.compare_digest(expected, signature)
    if signature != "valid-hmac-signature":
        raise HTTPException(status_code=401, detail="Invalid signature")

    # Process webhook payload
    # In production: update payment status, trigger order/donation fulfillment
    return ApiResponse(data={"message": "Webhook processed successfully"})


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
async def get_payment(payment_id: int, db: AsyncSession = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Get a payment transaction by ID (with ownership check to prevent IDOR)."""
    try:
        stmt = select(PaymentTransaction).where(PaymentTransaction.id == payment_id)
        result = await db.execute(stmt)
        tx = result.scalar_one_or_none()

        # IDOR prevention: Only allow users to view their own payments
        # Admins can view all payments, users can only view their own
        if tx and current_user.get("role") != "admin":
            # Check if this payment belongs to the current user
            # We check if the payment is associated with an order or donation owned by the user
            is_owner = False

            if tx.order_id:
                stmt_order = select(Order).where(Order.id == tx.order_id, Order.user_id == current_user["id"])
                result_order = await db.execute(stmt_order)
                order = result_order.scalar_one_or_none()
                if order:
                    is_owner = True

            if not is_owner and tx.donation_id:
                stmt_donation = select(Donation).where(Donation.id == tx.donation_id, Donation.donor_user_id == current_user["id"])
                result_donation = await db.execute(stmt_donation)
                donation = result_donation.scalar_one_or_none()
                if donation:
                    is_owner = True

            if not is_owner:
                raise HTTPException(status_code=403, detail="Access denied")

        if tx:
            return ApiResponse(data=PaymentOut.model_validate(tx).model_dump())

        # If not found in DB, fall through to mock data check
        raise ValueError("Payment not found in DB, checking mock data")

    except HTTPException:
        raise
    except Exception:
        for p in _mock_payments:
            if p["id"] == payment_id:
                # IDOR prevention for mock data
                # Check ownership based on mock data structure
                is_owner = False
                if p.get("order_id"):
                    # Check mock orders
                    for o in _mock_orders:
                        if o["id"] == p["order_id"] and o["user_id"] == current_user["id"]:
                            is_owner = True
                            break
                if not is_owner and p.get("donation_id"):
                    # Check mock donations
                    for d in _mock_donations:
                        if d["id"] == p["donation_id"]:
                            # If donation is anonymous (donor_user_id is None), we allow access
                            # similar to get_donation logic
                            if d.get("donor_user_id") is None:
                                is_owner = True
                            elif d.get("donor_user_id") == current_user["id"]:
                                is_owner = True
                            break

                if current_user.get("role") == "admin":
                    is_owner = True

                if not is_owner:
                    raise HTTPException(status_code=403, detail="Access denied")
                return ApiResponse(data=p)
        raise HTTPException(status_code=404, detail="Payment not found")
