# oauth/models.py - Fixed indentation
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import RegexValidator
from datetime import date
from django.utils import timezone


class BlacklistedRegistration(models.Model):
    """Store blacklisted registration attempts"""
    REASON_CHOICES = [
        ('underage', 'Under 13'),
        ('outside_africa', 'Outside Africa'),
        ('suspicious', 'Suspicious Activity'),
        ('duplicate', 'Duplicate Account Attempt'),
        ('banned', 'Previously Banned')
    ]

    email = models.EmailField(db_index=True)
    phone_number = models.CharField(max_length=17, db_index=True)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    attempted_data = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['email', 'phone_number']
        indexes = [
            models.Index(fields=['email', 'phone_number']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.email} - {self.reason} - {self.created_at.date()}"


class User(AbstractUser):
    # Africa country codes with proper names
    AFRICA_COUNTRIES = [
        ('DZ', 'Algeria'), ('AO', 'Angola'), ('BJ', 'Benin'), ('BW', 'Botswana'),
        ('BF', 'Burkina Faso'), ('BI', 'Burundi'), ('CV', 'Cabo Verde'),
        ('CM', 'Cameroon'), ('CF', 'Central African Republic'), ('TD', 'Chad'),
        ('KM', 'Comoros'), ('CD', 'Congo'), ('DJ', 'Djibouti'), ('EG', 'Egypt'),
        ('GQ', 'Equatorial Guinea'), ('ER', 'Eritrea'), ('SZ', 'Eswatini'),
        ('ET', 'Ethiopia'), ('GA', 'Gabon'), ('GM', 'Gambia'), ('GH', 'Ghana'),
        ('GN', 'Guinea'), ('GW', 'Guinea-Bissau'), ('CI', 'Côte d\'Ivoire'),
        ('KE', 'Kenya'), ('LS', 'Lesotho'), ('LR', 'Liberia'), ('LY', 'Libya'),
        ('MG', 'Madagascar'), ('MW', 'Malawi'), ('ML', 'Mali'), ('MR', 'Mauritania'),
        ('MU', 'Mauritius'), ('MA', 'Morocco'), ('MZ', 'Mozambique'), ('NA', 'Namibia'),
        ('NE', 'Niger'), ('NG', 'Nigeria'), ('RW', 'Rwanda'), ('ST', 'Sao Tome and Principe'),
        ('SN', 'Senegal'), ('SC', 'Seychelles'), ('SL', 'Sierra Leone'), ('SO', 'Somalia'),
        ('ZA', 'South Africa'), ('SS', 'South Sudan'), ('SD', 'Sudan'), ('TZ', 'Tanzania'),
        ('TG', 'Togo'), ('TN', 'Tunisia'), ('UG', 'Uganda'), ('ZM', 'Zambia'),
        ('ZW', 'Zimbabwe')
    ]

    # Personal Information
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    date_of_birth = models.DateField()
    bio = models.TextField(max_length=500, blank=True, default='')

    # Profile Images - Fixed indentation (these were the problem lines)
    profile_picture = models.ImageField(upload_to='profile_pics/', null=True, blank=True)
    cover_photo = models.ImageField(upload_to='cover_photos/', null=True, blank=True)

    # Contact Information
    phone_regex = RegexValidator(
        regex=r'^\+?[1-9]\d{1,14}$',
        message="Phone number must be entered in format: '+233123456789'. Up to 15 digits allowed."
    )
    phone_number = models.CharField(validators=[phone_regex], max_length=17, unique=True)

    # Location Information
    country = models.CharField(max_length=2, choices=AFRICA_COUNTRIES)
    city = models.CharField(max_length=100)

    # Age Verification
    is_age_verified = models.BooleanField(default=False)
    age_verified_at = models.DateTimeField(null=True, blank=True)

    # Account Status
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)

    # Timestamps
    date_joined = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_active = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_joined']
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['phone_number']),
            models.Index(fields=['country']),
        ]

    @property
    def age(self):
        today = date.today()
        born = self.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    @property
    def profile_picture_url(self):
        if self.profile_picture and hasattr(self.profile_picture, 'url'):
            return self.profile_picture.url
        return '/static/default_profile.png'

    @property
    def cover_photo_url(self):
        if self.cover_photo and hasattr(self.cover_photo, 'url'):
            return self.cover_photo.url
        return '/static/default_cover.jpg'

    @property
    def followers_count(self):
        return self.followers.count()

    @property
    def following_count(self):
        return self.following.count()

    def save(self, *args, **kwargs):
        # Auto-verify age if user is 13 or older
        if self.age >= 13:
            self.is_age_verified = True
            if not self.age_verified_at:
                self.age_verified_at = timezone.now()
        else:
            self.is_age_verified = False
            self.age_verified_at = None

        # Ensure username is lowercase
        if self.username:
            self.username = self.username.lower()

        # Ensure email is lowercase
        if self.email:
            self.email = self.email.lower()

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} - {self.full_name}"


class Follow(models.Model):
    """Model to handle user following relationships"""
    follower = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='following'  # Users this person follows
    )
    following = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='followers'  # Users following this person
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['follower', 'following']
        indexes = [
            models.Index(fields=['follower', 'following']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.follower.username} follows {self.following.username}"
