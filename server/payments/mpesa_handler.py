# payments/mpesa_handler.py
import base64
import requests
import logging
from datetime import datetime
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)


class MpesaHandler:
    """Handles M-Pesa Daraja API integration"""

    def __init__(self):
        """Initialize M-Pesa handler with credentials from settings"""
        # Get credentials from Django settings
        self.consumer_key = getattr(settings, 'MPESA_CONSUMER_KEY', '')
        self.consumer_secret = getattr(settings, 'MPESA_CONSUMER_SECRET', '')
        self.passkey = getattr(settings, 'MPESA_PASSKEY', '')
        self.shortcode = getattr(settings, 'MPESA_SHORTCODE', '174379')
        self.callback_url = getattr(settings, 'MPESA_CALLBACK_URL', '')

        # Environment (sandbox or production)
        self.env = getattr(settings, 'MPESA_ENVIRONMENT', 'sandbox')

        # Base URLs
        if self.env == 'production':
            self.base_url = 'https://api.safaricom.co.ke'
        else:
            self.base_url = 'https://sandbox.safaricom.co.ke'

        # API endpoints
        self.auth_url = f'{self.base_url}/oauth/v1/generate?grant_type=client_credentials'
        self.stk_push_url = f'{self.base_url}/mpesa/stkpush/v1/processrequest'
        self.stk_query_url = f'{self.base_url}/mpesa/stkpushquery/v1/query'

        # Access token cache
        self.access_token = None
        self.token_expiry = None

    def get_access_token(self):
        """
        Get M-Pesa access token
        Returns: access_token string or None if failed
        """
        # Check if cached token is still valid
        if self.access_token and self.token_expiry and timezone.now() < self.token_expiry:
            return self.access_token

        try:
            # Create authentication string
            auth_string = f"{self.consumer_key}:{self.consumer_secret}"
            encoded_auth = base64.b64encode(auth_string.encode()).decode()

            headers = {
                'Authorization': f'Basic {encoded_auth}'
            }

            response = requests.get(self.auth_url, headers=headers, timeout=30)
            response.raise_for_status()

            result = response.json()
            self.access_token = result.get('access_token')

            # Token expires in 1 hour (3599 seconds)
            self.token_expiry = timezone.now() + timezone.timedelta(seconds=3500)

            logger.info("Successfully obtained M-Pesa access token")
            return self.access_token

        except requests.RequestException as e:
            logger.error(f"Failed to get M-Pesa access token: {str(e)}")
            return None

    def generate_password(self):
        """
        Generate password for STK push
        Format: base64_encode(shortcode + passkey + timestamp)
        """
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        password_str = f"{self.shortcode}{self.passkey}{timestamp}"
        password = base64.b64encode(password_str.encode()).decode()
        return password, timestamp

    def make_stk_push(self, phone_number, amount, account_reference, transaction_desc, callback_url=None):
        """
        Initiate STK Push to customer's phone

        Parameters:
        - phone_number: Customer's phone number (format: 254XXXXXXXXX)
        - amount: Amount to charge (minimum 1)
        - account_reference: Reference for the transaction (e.g., 'Donation123')
        - transaction_desc: Description of the transaction (e.g., 'Post Donation')
        - callback_url: URL to receive payment confirmation (optional)

        Returns: Response dict from M-Pesa API
        """
        # Validate inputs
        if not phone_number or not amount or amount < 1:
            return {
                'success': False,
                'error': 'Invalid phone number or amount'
            }

        # Format phone number (ensure it starts with 254)
        phone_number = self.format_phone_number(phone_number)

        # Get access token
        access_token = self.get_access_token()
        if not access_token:
            return {
                'success': False,
                'error': 'Failed to get access token'
            }

        # Generate password and timestamp
        password, timestamp = self.generate_password()

        # Use provided callback or default from settings
        callback = callback_url or self.callback_url

        # Prepare request payload
        payload = {
            'BusinessShortCode': self.shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'TransactionType': 'CustomerPayBillOnline',
            'Amount': int(amount),
            'PartyA': phone_number,
            'PartyB': self.shortcode,
            'PhoneNumber': phone_number,
            'CallBackURL': callback,
            'AccountReference': account_reference[:12],  # Max 12 characters
            'TransactionDesc': transaction_desc[:13]  # Max 13 characters
        }

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(
                self.stk_push_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()

            result = response.json()

            # Check if request was successful
            if result.get('ResponseCode') == '0':
                logger.info(f"STK Push initiated successfully: {result.get('CheckoutRequestID')}")
                return {
                    'success': True,
                    'checkout_request_id': result.get('CheckoutRequestID'),
                    'merchant_request_id': result.get('MerchantRequestID'),
                    'response_code': result.get('ResponseCode'),
                    'response_description': result.get('ResponseDescription'),
                    'customer_message': result.get('CustomerMessage')
                }
            else:
                logger.error(f"STK Push failed: {result}")
                return {
                    'success': False,
                    'error': result.get('ResponseDescription', 'STK Push failed'),
                    'response_code': result.get('ResponseCode')
                }

        except requests.RequestException as e:
            logger.error(f"STK Push request error: {str(e)}")
            return {
                'success': False,
                'error': f'Request failed: {str(e)}'
            }

    def query_transaction_status(self, checkout_request_id):
        """
        Query the status of an STK Push transaction

        Parameters:
        - checkout_request_id: The CheckoutRequestID from STK Push response

        Returns: Transaction status details
        """
        if not checkout_request_id:
            return {
                'success': False,
                'error': 'CheckoutRequestID is required'
            }

        # Get access token
        access_token = self.get_access_token()
        if not access_token:
            return {
                'success': False,
                'error': 'Failed to get access token'
            }

        # Generate password and timestamp
        password, timestamp = self.generate_password()

        # Prepare request payload
        payload = {
            'BusinessShortCode': self.shortcode,
            'Password': password,
            'Timestamp': timestamp,
            'CheckoutRequestID': checkout_request_id
        }

        headers = {
            'Authorization': f'Bearer {access_token}',
            'Content-Type': 'application/json'
        }

        try:
            response = requests.post(
                self.stk_query_url,
                json=payload,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()

            result = response.json()

            # Check transaction status
            if result.get('ResponseCode') == '0':
                return {
                    'success': True,
                    'result_code': result.get('ResultCode'),
                    'result_desc': result.get('ResultDesc'),
                    'checkout_request_id': checkout_request_id,
                    'merchant_request_id': result.get('MerchantRequestID')
                }
            else:
                return {
                    'success': False,
                    'error': result.get('ResponseDescription', 'Query failed'),
                    'response_code': result.get('ResponseCode')
                }

        except requests.RequestException as e:
            logger.error(f"Transaction query error: {str(e)}")
            return {
                'success': False,
                'error': f'Query failed: {str(e)}'
            }

    def format_phone_number(self, phone_number):
        """
        Format phone number to international format (254XXXXXXXXX)
        """
        # Remove any non-digit characters
        phone = ''.join(filter(str.isdigit, str(phone_number)))

        # Remove leading 0 or + if present
        if phone.startswith('0'):
            phone = '254' + phone[1:]
        elif phone.startswith('254'):
            pass  # Already in correct format
        else:
            phone = '254' + phone

        return phone

    def process_callback(self, callback_data):
        """
        Process M-Pesa callback data

        Parameters:
        - callback_data: The JSON data received from M-Pesa callback

        Returns: Processed donation data
        """
        try:
            body = callback_data.get('Body', {})
            stk_callback = body.get('stkCallback', {})

            result_code = stk_callback.get('ResultCode')
            result_desc = stk_callback.get('ResultDesc')
            checkout_request_id = stk_callback.get('CheckoutRequestID')
            merchant_request_id = stk_callback.get('MerchantRequestID')

            # Initialize response
            response = {
                'success': result_code == '0',
                'result_code': result_code,
                'result_desc': result_desc,
                'checkout_request_id': checkout_request_id,
                'merchant_request_id': merchant_request_id
            }

            # Extract transaction details if successful
            if result_code == '0':
                callback_metadata = stk_callback.get('CallbackMetadata', {})
                items = callback_metadata.get('Item', [])

                for item in items:
                    name = item.get('Name')
                    value = item.get('Value')

                    if name == 'MpesaReceiptNumber':
                        response['receipt_number'] = value
                    elif name == 'TransactionDate':
                        response['transaction_date'] = value
                    elif name == 'Amount':
                        response['amount'] = value
                    elif name == 'PhoneNumber':
                        response['phone_number'] = value

                response['transaction_id'] = checkout_request_id

            return response

        except Exception as e:
            logger.error(f"Error processing callback: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
