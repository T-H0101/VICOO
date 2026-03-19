"""WeChat Pay integration service."""

import time
import secrets
import hashlib
import xml.etree.ElementTree as ET
from decimal import Decimal
from typing import Optional, Dict, Any
from app.config import settings


class WeChatPayService:
    """WeChat Pay unified order service."""

    def __init__(self):
        # Raise exception if required configs are missing
        if not settings.WECHAT_APP_ID:
            raise ValueError("WECHAT_APP_ID environment variable is required for payment security")
        self.app_id = settings.WECHAT_APP_ID
        if not settings.WECHAT_MCH_ID:
            raise ValueError("WECHAT_MCH_ID environment variable is required for payment security")
        self.mch_id = settings.WECHAT_MCH_ID
        # Use dedicated WeChat Pay API key, not the system AES key
        # Raise exception if API key is not configured (security requirement)
        if not settings.WECHAT_PAY_API_KEY:
            raise ValueError("WECHAT_PAY_API_KEY environment variable is required for payment security")
        self.api_key = settings.WECHAT_PAY_API_KEY
        # Use dedicated WeChat Pay notification URL, not CORS origins
        if not settings.WECHAT_NOTIFY_URL:
            raise ValueError("WECHAT_NOTIFY_URL environment variable is required for payment notifications")
        self.notify_url = settings.WECHAT_NOTIFY_URL

    def generate_nonce_str(self) -> str:
        """Generate random nonce string using cryptographically secure random."""
        return secrets.token_hex(16)  # 32 hex characters

    def generate_order_no(self) -> str:
        """Generate unique order number."""
        timestamp = int(time.time())
        random_part = secrets.randbelow(9000) + 1000
        return f"TH{timestamp}{random_part}"

    def calculate_sign(self, params: Dict[str, Any]) -> str:
        """
        Calculate WeChat Pay signature (SHA256).

        WeChat Pay signature algorithm:
        1. Sort parameters by key
        2. Concatenate key=value pairs
        3. Add API key at the end
        4. SHA256 hash the result

        Security note: WeChat Pay supports both MD5 and SHA256. SHA256 is cryptographically
        stronger and should be used in production. The API key must be properly configured
        in the WeChat Pay merchant backend.
        """
        sorted_params = sorted([(k, v) for k, v in params.items() if v is not None and v != ""])
        sign_str = "&".join([f"{k}={v}" for k, v in sorted_params])
        sign_str += f"&key={self.api_key}"

        return hashlib.sha256(sign_str.encode('utf-8')).hexdigest().upper()

    def create_unified_order(self, order_no: str, amount: Decimal, description: str, trade_type: str = "JSAPI", openid: Optional[str] = None, donation_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Create WeChat Pay unified order.

        Args:
            order_no: Order number
            amount: Payment amount in CNY (in yuan, not fen)
            description: Product description
            trade_type: Trade type (JSAPI for mini-program)
            openid: User's WeChat openid (required for JSAPI)
            donation_id: Donation ID if this is a donation payment

        Returns:
            Dictionary with payment parameters for wx.requestPayment
        """
        # Server-side amount verification
        if amount <= 0:
            raise ValueError("Amount must be positive")

        # Convert amount to fen (WeChat Pay uses fen)
        amount_fen = int(amount * 100)

        # Build WeChat Pay unified order parameters
        params = {
            "appid": self.app_id,
            "mch_id": self.mch_id,
            "nonce_str": self.generate_nonce_str(),
            "body": description[:127],  # WeChat limit: 127 chars
            "out_trade_no": order_no,
            "total_fee": amount_fen,
            "spbill_create_ip": "127.0.0.1",  # Mock IP
            "notify_url": self.notify_url,
            "trade_type": trade_type,
        }

        if openid and trade_type == "JSAPI":
            params["openid"] = openid

        # Calculate signature
        params["sign"] = self.calculate_sign(params)

        # For simulation, we generate wx.requestPayment parameters directly
        # In production, this would call WeChat Pay API and parse the XML response
        return self._generate_wx_payment_params(order_no, amount, description, donation_id)

    def _generate_wx_payment_params(self, order_no: str, amount: Decimal, description: str, donation_id: Optional[int] = None) -> Dict[str, Any]:
        """
        Generate mock wx.requestPayment parameters.

        In production, you would:
        1. Call WeChat unified order API: https://api.mch.weixin.qq.com/pay/unifiedorder
        2. Parse XML response
        3. Extract prepay_id
        4. Generate signature for wx.requestPayment
        """
        prepay_id = f"wx{int(time.time())}{secrets.randbelow(900000) + 100000}"

        # Generate parameters for wx.requestPayment
        timestamp = str(int(time.time()))
        nonce_str = self.generate_nonce_str()
        package = f"prepay_id={prepay_id}"

        # Sign the payment parameters
        sign_params = {
            "appId": self.app_id,
            "timeStamp": timestamp,
            "nonceStr": nonce_str,
            "package": package,
            "signType": "SHA256",
        }

        pay_sign = self.calculate_sign(sign_params)

        result = {
            "timeStamp": timestamp,
            "nonceStr": nonce_str,
            "package": package,
            "signType": "SHA256",
            "paySign": pay_sign,
            "transactionId": prepay_id,  # WeChat prepay_id serves as transaction ID for verification
            "order_no": order_no,
            "amount": str(amount),
            "description": description,
        }

        if donation_id:
            result["donationId"] = donation_id

        return result

    def verify_payment_signature(self, params: Dict[str, Any]) -> bool:
        """
        Verify WeChat Pay callback signature.

        Args:
            params: Callback parameters including sign

        Returns:
            True if signature is valid
        """
        if "sign" not in params:
            return False

        expected_sign = self.calculate_sign(params)
        return params["sign"] == expected_sign


# Singleton instance
payment_service = WeChatPayService()
