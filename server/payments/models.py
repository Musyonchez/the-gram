# payments/models.py
from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from datetime import timedelta


class Donation(models.Model):
    """
    Model to handle M-Pesa STK Push donations
    """
    
    # Payment Status Choices
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
        ('refunded', 'Refunded'),
    ]
    
    # Payment Channel Choices
    CHANNEL_CHOICES = [
        ('mpesa', 'M-Pesa'),
        ('card', 'Credit/Debit Card'),
        ('paypal', 'PayPal'),
    ]
    
    # Donation Type Choices
    DONATION_TYPE_CHOICES = [
        ('post', 'Post Donation'),
        ('creator', 'Creator Donation'),
        ('event', 'Event Donation'),
    ]
    
    # Basic Information
    donor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='donations_made',
        verbose_name='Donor'
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='donations_received',
        verbose_name='Recipient'
    )
    post = models.ForeignKey(
        'posts.Post',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='donations',
        verbose_name='Post'
    )
    
    # Donation Details
    donation_type = models.CharField(
        max_length=20,
        choices=DONATION_TYPE_CHOICES,
        default='post',
        verbose_name='Donation Type'
    )
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(1.00), MaxValueValidator(100000.00)],
        verbose_name='Amount'
    )
    currency = models.CharField(
        max_length=3,
        default='KES',
        choices=[('KES', 'Kenyan Shilling'), ('USD', 'US Dollar'), ('EUR', 'Euro')],
        verbose_name='Currency'
    )
    message = models.TextField(
        max_length=500,
        blank=True,
        null=True,
        verbose_name='Donation Message'
    )
    is_anonymous = models.BooleanField(
        default=False,
        verbose_name='Donate Anonymously'
    )
    
    # M-Pesa Specific Fields
    phone_number = models.CharField(
        max_length=15,
        blank=True,
        null=True,
        help_text='Format: 254712345678 (without +)',
        verbose_name='Phone Number'
    )
    mpesa_receipt_number = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        unique=True,
        verbose_name='M-Pesa Receipt Number'
    )
    transaction_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        verbose_name='Transaction ID'
    )
    checkout_request_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_index=True,
        verbose_name='Checkout Request ID'
    )
    merchant_request_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        db_index=True,
        verbose_name='Merchant Request ID'
    )
    result_code = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Result Code'
    )
    result_description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Result Description'
    )
    
    # Payment Status
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True,
        verbose_name='Payment Status'
    )
    channel = models.CharField(
        max_length=20,
        choices=CHANNEL_CHOICES,
        default='mpesa',
        verbose_name='Payment Channel'
    )
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Created At')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated At')
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='Completed At'
    )
    
    # Metadata
    metadata = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='Additional Metadata'
    )
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='IP Address'
    )
    user_agent = models.TextField(
        blank=True,
        null=True,
        verbose_name='User Agent'
    )
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['donor', '-created_at']),
            models.Index(fields=['recipient', '-created_at']),
            models.Index(fields=['status', '-created_at']),
            models.Index(fields=['mpesa_receipt_number']),
            models.Index(fields=['transaction_id']),
            models.Index(fields=['checkout_request_id']),
            models.Index(fields=['created_at']),
        ]
        verbose_name = 'Donation'
        verbose_name_plural = 'Donations'
    
    def __str__(self):
        donor_name = self.donor.username if self.donor else 'Anonymous'
        return f"{donor_name} donated {self.amount} {self.currency} to {self.recipient.username}"
    
    @property
    def is_completed(self):
        return self.status == 'completed'
    
    @property
    def is_pending(self):
        return self.status == 'pending'
    
    @property
    def is_failed(self):
        return self.status == 'failed'
    
    @property
    def display_name(self):
        """Return donor name or 'Anonymous' for public display"""
        if self.is_anonymous:
            return 'Anonymous'
        return self.donor.full_name or self.donor.username if self.donor else 'Anonymous'
    
    def mark_completed(self, receipt_number=None, transaction_id=None):
        """Mark donation as completed"""
        self.status = 'completed'
        self.completed_at = timezone.now()
        if receipt_number:
            self.mpesa_receipt_number = receipt_number
        if transaction_id:
            self.transaction_id = transaction_id
        self.save(update_fields=['status', 'completed_at', 'mpesa_receipt_number', 'transaction_id'])
    
    def mark_failed(self, result_code, result_description):
        """Mark donation as failed"""
        self.status = 'failed'
        self.result_code = result_code
        self.result_description = result_description
        self.save(update_fields=['status', 'result_code', 'result_description'])
    
    def mark_processing(self):
        """Mark donation as processing"""
        self.status = 'processing'
        self.save(update_fields=['status'])
    
    def save(self, *args, **kwargs):
        # Ensure phone number is in correct format
        if self.phone_number:
            # Remove any non-digit characters
            self.phone_number = ''.join(filter(str.isdigit, self.phone_number))
            # Ensure it starts with 254
            if self.phone_number.startswith('0'):
                self.phone_number = '254' + self.phone_number[1:]
            elif self.phone_number.startswith('+'):
                self.phone_number = self.phone_number[1:]
        super().save(*args, **kwargs)


class MpesaTransaction(models.Model):
    """
    Model to store raw M-Pesa API responses and callbacks
    """
    
    TRANSACTION_TYPE_CHOICES = [
        ('stk_push', 'STK Push'),
        ('stk_push_query', 'STK Push Query'),
        ('b2c', 'B2C'),
        ('c2b', 'C2B'),
    ]
    
    donation = models.ForeignKey(
        Donation,
        on_delete=models.CASCADE,
        related_name='mpesa_transactions',
        null=True,
        blank=True
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        verbose_name='Transaction Type'
    )
    request_data = models.JSONField(
        default=dict,
        verbose_name='Request Data'
    )
    response_data = models.JSONField(
        default=dict,
        verbose_name='Response Data'
    )
    callback_data = models.JSONField(
        default=dict,
        null=True,
        blank=True,
        verbose_name='Callback Data'
    )
    checkout_request_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name='Checkout Request ID'
    )
    merchant_request_id = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name='Merchant Request ID'
    )
    result_code = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='Result Code'
    )
    result_description = models.TextField(
        blank=True,
        null=True,
        verbose_name='Result Description'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created At')
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['checkout_request_id']),
            models.Index(fields=['merchant_request_id']),
            models.Index(fields=['created_at']),
        ]
        verbose_name = 'M-Pesa Transaction'
        verbose_name_plural = 'M-Pesa Transactions'
    
    def __str__(self):
        return f"{self.transaction_type} - {self.checkout_request_id}"


class DonationStats(models.Model):
    """
    Model to track aggregated donation statistics for users and posts
    """
    
    PERIOD_CHOICES = [
        ('day', 'Daily'),
        ('week', 'Weekly'),
        ('month', 'Monthly'),
        ('year', 'Yearly'),
        ('all', 'All Time'),
    ]
    
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='donation_stats',
        null=True,
        blank=True
    )
    post = models.ForeignKey(
        'posts.Post',
        on_delete=models.CASCADE,
        related_name='donation_stats',
        null=True,
        blank=True
    )
    period = models.CharField(max_length=10, choices=PERIOD_CHOICES)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_donations = models.PositiveIntegerField(default=0)
    unique_donors = models.PositiveIntegerField(default=0)
    average_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    last_donation_at = models.DateTimeField(null=True, blank=True)
    date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = [['user', 'period', 'date'], ['post', 'period', 'date']]
        indexes = [
            models.Index(fields=['user', 'period', '-date']),
            models.Index(fields=['post', 'period', '-date']),
            models.Index(fields=['date']),
        ]
        verbose_name = 'Donation Stats'
        verbose_name_plural = 'Donation Stats'
    
    def __str__(self):
        if self.user:
            return f"{self.user.username} - {self.period} - {self.date}"
        return f"Post {self.post.id} - {self.period} - {self.date}"
    
    @classmethod
    def update_stats(cls, donation):
        """Update donation statistics when a donation is completed"""
        from django.db.models import Sum, Count
        
        # Update for recipient user
        if donation.recipient:
            date = donation.completed_at.date()
            
            # Update daily stats
            daily_stats, _ = cls.objects.get_or_create(
                user=donation.recipient,
                period='day',
                date=date,
                defaults={'total_amount': 0, 'total_donations': 0, 'unique_donors': 0}
            )
            
            # Update weekly stats
            week_start = date - timedelta(days=date.weekday())
            weekly_stats, _ = cls.objects.get_or_create(
                user=donation.recipient,
                period='week',
                date=week_start,
                defaults={'total_amount': 0, 'total_donations': 0, 'unique_donors': 0}
            )
            
            # Update monthly stats
            month_start = date.replace(day=1)
            monthly_stats, _ = cls.objects.get_or_create(
                user=donation.recipient,
                period='month',
                date=month_start,
                defaults={'total_amount': 0, 'total_donations': 0, 'unique_donors': 0}
            )
            
            # Update all-time stats
            all_stats, _ = cls.objects.get_or_create(
                user=donation.recipient,
                period='all',
                date=date.min,
                defaults={'total_amount': 0, 'total_donations': 0, 'unique_donors': 0}
            )
            
            for stats in [daily_stats, weekly_stats, monthly_stats, all_stats]:
                stats.total_amount += donation.amount
                stats.total_donations += 1
                if stats.total_donations > 0:
                    stats.average_amount = stats.total_amount / stats.total_donations
                stats.unique_donors = Donation.objects.filter(
                    recipient=donation.recipient,
                    status='completed'
                ).values('donor').distinct().count()
                stats.last_donation_at = donation.completed_at
                stats.save()
        
        # Update for post
        if donation.post:
            date = donation.completed_at.date()
            post_stats, _ = cls.objects.get_or_create(
                post=donation.post,
                period='all',
                date=date.min,
                defaults={'total_amount': 0, 'total_donations': 0, 'unique_donors': 0}
            )
            post_stats.total_amount += donation.amount
            post_stats.total_donations += 1
            if post_stats.total_donations > 0:
                post_stats.average_amount = post_stats.total_amount / post_stats.total_donations
            post_stats.last_donation_at = donation.completed_at
            post_stats.save()