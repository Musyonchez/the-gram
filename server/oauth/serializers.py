# oauth/serializers.py
from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.db import models
from datetime import date
import re
from .models import User, BlacklistedRegistration, Follow


class CountryField(serializers.ChoiceField):
    def __init__(self, **kwargs):
        africa_countries = [
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
        kwargs['choices'] = africa_countries
        super().__init__(**kwargs)


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    confirm_password = serializers.CharField(
        write_only=True,
        min_length=8,
        style={'input_type': 'password'}
    )
    country = CountryField()
    profile_picture = serializers.ImageField(required=False, allow_null=True)
    cover_photo = serializers.ImageField(required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'username', 'email', 'password', 'confirm_password',
            'full_name', 'date_of_birth', 'phone_number', 'country', 'city',
            'profile_picture', 'cover_photo'
        ]

    def validate_username(self, value):
        """Validate username format"""
        if not re.match(r'^[a-zA-Z0-9_]+$', value):
            raise serializers.ValidationError(
                "Username can only contain letters, numbers, and underscores"
            )
        if len(value) < 3:
            raise serializers.ValidationError(
                "Username must be at least 3 characters long"
            )
        return value.lower()

    def validate_email(self, value):
        """Validate email format and uniqueness"""
        value = value.lower()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value

    def validate_phone_number(self, value):
        """Validate phone number format and uniqueness"""
        # Remove any spaces or dashes
        value = re.sub(r'[\s\-]', '', value)

        # Check if it starts with +
        if not value.startswith('+'):
            value = '+' + value

        if User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("User with this phone number already exists")
        return value

    def validate(self, data):
        # Check password match
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords don't match"})

        # Check age (must be 13 or older)
        today = date.today()
        age = today.year - data['date_of_birth'].year - (
            (today.month, today.day) < (data['date_of_birth'].month, data['date_of_birth'].day)
        )

        if age < 13:
            # Blacklist the registration attempt
            request = self.context.get('request')

            # Get client IP
            x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
            if x_forwarded_for:
                ip = x_forwarded_for.split(',')[0]
            else:
                ip = request.META.get('REMOTE_ADDR', '0.0.0.0')

            # Get user agent
            user_agent = request.META.get('HTTP_USER_AGENT', '')

            # Use get_or_create to avoid duplicate errors
            BlacklistedRegistration.objects.get_or_create(
                email=data['email'],
                phone_number=data['phone_number'],
                defaults={
                    'reason': 'underage',
                    'attempted_data': {
                        'username': data['username'],
                        'full_name': data['full_name'],
                        'date_of_birth': str(data['date_of_birth']),
                        'country': data['country'],
                        'city': data['city']
                    },
                    'ip_address': ip,
                    'user_agent': user_agent
                }
            )
            raise serializers.ValidationError({
                "date_of_birth": "You must be at least 13 years old to register"
            })

        # Check if email or phone is blacklisted
        if BlacklistedRegistration.objects.filter(
            models.Q(email=data['email']) |
            models.Q(phone_number=data['phone_number'])
        ).exists():
            raise serializers.ValidationError({
                "non_field_errors": ["This account has been blacklisted. Please contact support."]
            })

        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        password = validated_data.pop('password')

        # Extract image fields
        profile_picture = validated_data.pop('profile_picture', None)
        cover_photo = validated_data.pop('cover_photo', None)

        # Create user with all validated data
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=password,
            full_name=validated_data['full_name'],
            date_of_birth=validated_data['date_of_birth'],
            phone_number=validated_data['phone_number'],
            country=validated_data['country'],
            city=validated_data['city']
        )

        # Add images if provided
        if profile_picture:
            user.profile_picture = profile_picture
        if cover_photo:
            user.cover_photo = cover_photo
        user.save()

        return user


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=False)
    email = serializers.EmailField(required=False)
    phone_number = serializers.CharField(required=False)
    password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, data):
        # Check if at least one identifier is provided
        username = data.get('username')
        email = data.get('email')
        phone_number = data.get('phone_number')
        password = data.get('password')

        if not (username or email or phone_number):
            raise serializers.ValidationError(
                "Must include 'username', 'email', or 'phone_number'"
            )

        if not password:
            raise serializers.ValidationError("Must include 'password'")

        # Try to find user by username, email, or phone
        user = None
        if username:
            user = authenticate(username=username.lower(), password=password)
        if not user and email:
            try:
                user_obj = User.objects.get(email=email.lower())
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass
        if not user and phone_number:
            try:
                user_obj = User.objects.get(phone_number=phone_number)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if user and user.is_active:
            if not user.is_age_verified:
                raise serializers.ValidationError(
                    "Account not verified. Please check your email."
                )
            data['user'] = user
        else:
            raise serializers.ValidationError(
                "Unable to log in with provided credentials"
            )

        return data


class UserProfileSerializer(serializers.ModelSerializer):
    age = serializers.IntegerField(read_only=True)
    profile_picture_url = serializers.URLField(read_only=True)
    cover_photo_url = serializers.URLField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'full_name', 'email', 'bio',
            'profile_picture', 'profile_picture_url',
            'cover_photo', 'cover_photo_url',
            'phone_number', 'country', 'city', 'date_of_birth',
            'age', 'is_age_verified', 'is_verified', 'date_joined'
        ]
        read_only_fields = ['is_age_verified', 'is_verified', 'date_joined']
        extra_kwargs = {
            'profile_picture': {'write_only': True},
            'cover_photo': {'write_only': True}
        }


class UserUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['full_name', 'bio', 'profile_picture', 'cover_photo', 'city']
        extra_kwargs = {
            'full_name': {'required': False},
            'bio': {'required': False},
            'city': {'required': False}
        }

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class PasswordChangeSerializer(serializers.Serializer):
    old_password = serializers.CharField(style={'input_type': 'password'})
    new_password = serializers.CharField(
        min_length=8,
        style={'input_type': 'password'},
        validators=[validate_password]
    )
    confirm_new_password = serializers.CharField(style={'input_type': 'password'})

    def validate(self, data):
        if data['new_password'] != data['confirm_new_password']:
            raise serializers.ValidationError(
                {"confirm_new_password": "New passwords don't match"}
            )
        return data

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value


class FollowSerializer(serializers.ModelSerializer):
    follower_username = serializers.CharField(source='follower.username', read_only=True)
    follower_full_name = serializers.CharField(source='follower.full_name', read_only=True)
    follower_profile_picture = serializers.ImageField(source='follower.profile_picture', read_only=True)
    follower_profile_picture_url = serializers.URLField(source='follower.profile_picture_url', read_only=True)

    following_username = serializers.CharField(source='following.username', read_only=True)
    following_full_name = serializers.CharField(source='following.full_name', read_only=True)
    following_profile_picture = serializers.ImageField(source='following.profile_picture', read_only=True)
    following_profile_picture_url = serializers.URLField(source='following.profile_picture_url', read_only=True)

    class Meta:
        model = Follow
        fields = [
            'id', 'follower', 'follower_username', 'follower_full_name',
            'follower_profile_picture', 'follower_profile_picture_url',
            'following', 'following_username', 'following_full_name',
            'following_profile_picture', 'following_profile_picture_url',
            'created_at'
        ]
        read_only_fields = ['created_at']


class FollowActionSerializer(serializers.Serializer):
    user_id = serializers.IntegerField(required=True)

    def validate_user_id(self, value):
        try:
            User.objects.get(id=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found")

        current_user = self.context['request'].user

        if current_user.id == value:
            raise serializers.ValidationError("You cannot follow yourself")

        return value


class UserProfileWithFollowSerializer(UserProfileSerializer):
    followers_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    is_following = serializers.SerializerMethodField()
    is_followed_by = serializers.SerializerMethodField()

    class Meta(UserProfileSerializer.Meta):
        fields = UserProfileSerializer.Meta.fields + [
            'followers_count', 'following_count', 'is_following', 'is_followed_by'
        ]

    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(follower=request.user, following=obj).exists()
        return False

    def get_is_followed_by(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return Follow.objects.filter(follower=obj, following=request.user).exists()
        return False
