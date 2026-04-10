# payments/serializers.py
from rest_framework import serializers
from .models import Donation, DonationStats
from oauth.serializers import UserProfileSerializer
from posts.serializers import PostSerializer


class DonationSerializer(serializers.ModelSerializer):
    donor_info = UserProfileSerializer(source='donor', read_only=True)
    recipient_info = UserProfileSerializer(source='recipient', read_only=True)
    post_info = PostSerializer(source='post', read_only=True)
    formatted_amount = serializers.SerializerMethodField()
    formatted_date = serializers.SerializerMethodField()

    class Meta:
        model = Donation
        fields = [
            'id', 'donor', 'donor_info', 'recipient', 'recipient_info',
            'post', 'post_info', 'donation_type', 'amount', 'formatted_amount',
            'currency', 'message', 'is_anonymous', 'status', 'channel',
            'created_at', 'formatted_date', 'completed_at'
        ]
        read_only_fields = ['id', 'status', 'created_at', 'completed_at']

    def get_formatted_amount(self, obj):
        return f"{obj.currency} {obj.amount:,.2f}"

    def get_formatted_date(self, obj):
        return obj.created_at.strftime("%B %d, %Y at %I:%M %p")

    def validate_amount(self, value):
        if value < 1:
            raise serializers.ValidationError("Minimum donation amount is 1 KES")
        if value > 100000:
            raise serializers.ValidationError("Maximum donation amount is 100,000 KES")
        return value


class MpesaSTKPushSerializer(serializers.Serializer):
    post_id = serializers.IntegerField(required=False)
    recipient_id = serializers.IntegerField(required=False)
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    phone_number = serializers.CharField(max_length=15)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)
    is_anonymous = serializers.BooleanField(default=False)

    def validate(self, data):
        if not data.get('post_id') and not data.get('recipient_id'):
            raise serializers.ValidationError("Either post_id or recipient_id is required")

        # Validate phone number format
        phone = data.get('phone_number')
        # Remove any non-digit characters
        phone = ''.join(filter(str.isdigit, phone))
        if not phone.startswith('254'):
            if phone.startswith('0'):
                phone = '254' + phone[1:]
            elif phone.startswith('+'):
                phone = phone[1:]
            else:
                phone = '254' + phone
        data['phone_number'] = phone

        if len(phone) != 12:
            raise serializers.ValidationError("Invalid phone number format. Use 254XXXXXXXXX")

        return data


class DonationStatsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DonationStats
        fields = [
            'id', 'period', 'total_amount', 'total_donations',
            'unique_donors', 'average_amount', 'date'
        ]


class TipSerializer(serializers.Serializer):
    recipient_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    message = serializers.CharField(max_length=500, required=False, allow_blank=True)
    is_anonymous = serializers.BooleanField(default=False)
