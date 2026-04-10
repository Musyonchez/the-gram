# payments/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Sum, Count, Q
from decimal import Decimal
from .models import Donation, DonationStats, MpesaTransaction
from .serializers import (
    DonationSerializer, MpesaSTKPushSerializer, TipSerializer
)
from .mpesa_handler import MpesaHandler
from posts.models import Post
from oauth.models import User


class InitiateMpesaDonationView(APIView):
    """Initiate M-Pesa STK Push for donation"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = MpesaSTKPushSerializer(data=request.data)

        if serializer.is_valid():
            data = serializer.validated_data

            # Determine recipient and post
            recipient = None
            post = None
            account_ref = None

            if data.get('post_id'):
                try:
                    post = Post.objects.get(id=data['post_id'])
                    recipient = post.user
                    account_ref = f"POST_{post.id}"
                except Post.DoesNotExist:
                    return Response({'error': 'Post not found'}, status=status.HTTP_404_NOT_FOUND)
            elif data.get('recipient_id'):
                try:
                    recipient = User.objects.get(id=data['recipient_id'])
                    account_ref = f"TIP_{recipient.username[:8]}"
                except User.DoesNotExist:
                    return Response({'error': 'Recipient not found'}, status=status.HTTP_404_NOT_FOUND)

            # Create donation record
            donation = Donation.objects.create(
                donor=request.user,
                recipient=recipient,
                post=post,
                donation_type='post' if post else 'creator',
                amount=Decimal(str(data['amount'])),  # Convert to Decimal properly
                phone_number=data['phone_number'],
                message=data.get('message', ''),
                is_anonymous=data.get('is_anonymous', False),
                status='processing',
                channel='mpesa',
                ip_address=self.get_client_ip(request),
                user_agent=request.META.get('HTTP_USER_AGENT', '')
            )

            # Initialize M-Pesa handler
            mpesa = MpesaHandler()

            # Make STK Push
            transaction_desc = f"Donation for {'post' if post else recipient.username}"
            response = mpesa.make_stk_push(
                phone_number=data['phone_number'],
                amount=float(data['amount']),  # Convert to float for M-Pesa API
                account_reference=account_ref,
                transaction_desc=transaction_desc[:13]
            )

            # Prepare request data for storage (convert Decimal to float)
            request_data_copy = {
                'post_id': data.get('post_id'),
                'recipient_id': data.get('recipient_id'),
                'amount': float(data['amount']),
                'phone_number': data['phone_number'],
                'message': data.get('message', ''),
                'is_anonymous': data.get('is_anonymous', False)
            }

            # Store the response
            try:
                MpesaTransaction.objects.create(
                    donation=donation,
                    transaction_type='stk_push',
                    request_data=request_data_copy,
                    response_data=response,
                    checkout_request_id=response.get('CheckoutRequestID', ''),
                    merchant_request_id=response.get('MerchantRequestID', ''),
                    result_code=int(response.get('ResponseCode', '1')) if response.get(
                        'ResponseCode') and str(response.get('ResponseCode')).isdigit() else None,
                    result_description=response.get('ResponseDescription', '')
                )
            except Exception as e:
                print(f"Error storing transaction: {e}")

            # Update donation with checkout request ID
            if response.get('CheckoutRequestID'):
                donation.checkout_request_id = response.get('CheckoutRequestID')
                donation.save(update_fields=['checkout_request_id'])

            # Check response code (convert to string for comparison)
            response_code = str(response.get('ResponseCode', ''))

            if response_code == '0':
                return Response({
                    'success': True,
                    'message': 'STK Push initiated successfully. Please check your phone to complete payment.',
                    'donation_id': donation.id,
                    'checkout_request_id': response.get('CheckoutRequestID'),
                    'merchant_request_id': response.get('MerchantRequestID'),
                    'amount': float(donation.amount),
                    'phone_number': donation.phone_number
                }, status=status.HTTP_200_OK)
            else:
                donation.status = 'failed'
                donation.result_description = response.get('ResponseDescription', 'Failed to initiate payment')
                donation.save(update_fields=['status', 'result_description'])
                return Response({
                    'success': False,
                    'message': response.get('ResponseDescription', 'Failed to initiate payment'),
                    'error_code': response.get('ResponseCode')
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip


class MpesaCallbackView(APIView):
    """Handle M-Pesa callback after STK Push"""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        callback_data = request.data

        # Extract relevant information
        body = callback_data.get('Body', {})
        stk_callback = body.get('stkCallback', {})

        checkout_request_id = stk_callback.get('CheckoutRequestID')
        result_code = stk_callback.get('ResultCode')
        result_desc = stk_callback.get('ResultDesc')

        # Store callback data
        try:
            MpesaTransaction.objects.create(
                transaction_type='stk_push',
                callback_data=callback_data,
                checkout_request_id=checkout_request_id or '',
                merchant_request_id=stk_callback.get('MerchantRequestID', ''),
                result_code=result_code,
                result_description=result_desc
            )
        except Exception as e:
            print(f"Error storing callback: {e}")

        # Find the donation by checkout_request_id
        if checkout_request_id:
            try:
                donation = Donation.objects.get(checkout_request_id=checkout_request_id)
            except Donation.DoesNotExist:
                return Response({'ResultCode': 0, 'ResultDesc': 'Success'})

            if result_code == 0:
                # Payment successful
                callback_metadata = stk_callback.get('CallbackMetadata', {})
                items = callback_metadata.get('Item', [])

                # Extract payment details
                receipt_number = None

                for item in items:
                    if item.get('Name') == 'MpesaReceiptNumber':
                        receipt_number = item.get('Value')

                # Update donation record
                donation.mark_completed(receipt_number, checkout_request_id)

                # Update donation stats
                DonationStats.update_stats(donation)

                # Update post stats
                if donation.post:
                    donation.post.update_donation_stats()

            else:
                # Payment failed
                donation.mark_failed(result_code, result_desc)

        return Response({'ResultCode': 0, 'ResultDesc': 'Success'})


class TransactionStatusView(APIView):
    """Query the status of a transaction"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, checkout_request_id):
        try:
            donation = Donation.objects.get(checkout_request_id=checkout_request_id)

            # Initialize M-Pesa handler
            mpesa = MpesaHandler()

            # Query transaction status
            result = mpesa.query_transaction_status(checkout_request_id)

            # Store query result
            try:
                MpesaTransaction.objects.create(
                    donation=donation,
                    transaction_type='stk_push_query',
                    response_data=result,
                    checkout_request_id=checkout_request_id,
                    result_code=int(result.get('ResultCode', '1')) if result.get(
                        'ResultCode') and str(result.get('ResultCode')).isdigit() else None,
                    result_description=result.get('ResultDesc', '')
                )
            except Exception as e:
                print(f"Error storing query result: {e}")

            # Update donation status if completed
            if result.get('ResultCode') == '0':
                if donation.status != 'completed':
                    donation.mark_completed(None, checkout_request_id)
                    if donation.post:
                        donation.post.update_donation_stats()

            return Response({
                'status': donation.status,
                'result': result
            })

        except Donation.DoesNotExist:
            return Response({'error': 'Transaction not found'}, status=404)


class DonationHistoryView(generics.ListAPIView):
    """Get donation history for the current user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DonationSerializer

    def get_queryset(self):
        user = self.request.user
        donation_type = self.request.query_params.get('type', 'all')

        if donation_type == 'sent':
            return Donation.objects.filter(donor=user).order_by('-created_at')
        elif donation_type == 'received':
            return Donation.objects.filter(recipient=user).order_by('-created_at')
        else:
            return Donation.objects.filter(
                Q(donor=user) | Q(recipient=user)
            ).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class PostDonationsView(generics.ListAPIView):
    """Get all donations for a specific post"""
    permission_classes = [permissions.AllowAny]
    serializer_class = DonationSerializer

    def get_queryset(self):
        post_id = self.kwargs.get('post_id')
        return Donation.objects.filter(
            post_id=post_id,
            status='completed'
        ).order_by('-created_at')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class DonationStatsView(APIView):
    """Get donation statistics for a user or post"""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        user_id = request.query_params.get('user_id')
        post_id = request.query_params.get('post_id')

        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=404)

            stats = Donation.objects.filter(
                recipient=user,
                status='completed'
            ).aggregate(
                total_donations=Count('id'),
                total_amount=Sum('amount'),
            )

            recent_donations = Donation.objects.filter(
                recipient=user,
                status='completed'
            ).order_by('-created_at')[:10]

            return Response({
                'total_donations': stats['total_donations'] or 0,
                'total_amount': float(stats['total_amount'] or 0),
                'recent_donations': DonationSerializer(recent_donations, many=True, context={'request': request}).data
            })

        elif post_id:
            try:
                post = Post.objects.get(id=post_id)
            except Post.DoesNotExist:
                return Response({'error': 'Post not found'}, status=404)

            stats = Donation.objects.filter(
                post=post,
                status='completed'
            ).aggregate(
                total_donations=Count('id'),
                total_amount=Sum('amount'),
            )

            recent_donations = Donation.objects.filter(
                post=post,
                status='completed'
            ).order_by('-created_at')[:10]

            return Response({
                'total_donations': stats['total_donations'] or 0,
                'total_amount': float(stats['total_amount'] or 0),
                'donations_count': post.donations_count,
                'total_donations_amount': float(post.total_donations),
                'recent_donations': DonationSerializer(recent_donations, many=True, context={'request': request}).data
            })

        return Response({'error': 'Either user_id or post_id is required'}, status=400)


class TipCreatorView(APIView):
    """Allow users to tip a creator directly"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = TipSerializer(data=request.data)

        if serializer.is_valid():
            data = serializer.validated_data

            try:
                User.objects.get(id=data['recipient_id'])
            except User.DoesNotExist:
                return Response({'error': 'Recipient not found'}, status=404)

            # Create a new request object for the donation
            donation_request = request._request
            donation_request.data = {
                'recipient_id': data['recipient_id'],
                'amount': data['amount'],
                'phone_number': request.user.phone_number or '',
                'message': data.get('message', ''),
                'is_anonymous': data.get('is_anonymous', False)
            }

            # Call the M-Pesa donation view
            return InitiateMpesaDonationView().post(donation_request)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
