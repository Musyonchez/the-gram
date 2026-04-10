from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase, APIClient
from rest_framework import status
from datetime import date, timedelta
from .models import BlacklistedRegistration

User = get_user_model()


class UserModelTests(TestCase):
    """Test the User model"""

    def setUp(self):
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'full_name': 'Test User',
            'date_of_birth': date.today() - timedelta(days=365*20),  # 20 years old
            'phone_number': '+233123456789',
            'country': 'GH',
            'city': 'Accra'
        }

    def test_create_user(self):
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.full_name, 'Test User')
        self.assertEqual(user.country, 'GH')
        self.assertEqual(user.city, 'Accra')
        self.assertTrue(user.is_age_verified)
        self.assertIsNotNone(user.age_verified_at)

    # oauth/tests.py - Fix test_age_property
    def test_age_property(self):
        user = User.objects.create_user(**self.user_data)
        today = date.today()
        expected_age = today.year - self.user_data['date_of_birth'].year - (
            (today.month, today.day) < (self.user_data['date_of_birth'].month,
                                        self.user_data['date_of_birth'].day)
        )
        self.assertEqual(user.age, expected_age)

    def test_under_age_user_not_verified(self):
        self.user_data['date_of_birth'] = date.today() - timedelta(days=365*10)  # 10 years old
        self.user_data['username'] = 'testuser2'
        self.user_data['email'] = 'test2@example.com'
        self.user_data['phone_number'] = '+233123456788'

        user = User.objects.create_user(**self.user_data)
        self.assertFalse(user.is_age_verified)
        self.assertIsNone(user.age_verified_at)

    def test_username_lowercase_on_save(self):
        self.user_data['username'] = 'TestUser'
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(user.username, 'testuser')

    def test_email_lowercase_on_save(self):
        self.user_data['email'] = 'Test@Example.com'
        user = User.objects.create_user(**self.user_data)
        self.assertEqual(user.email, 'test@example.com')


class RegistrationTests(APITestCase):
    """Test user registration"""

    def setUp(self):
        self.register_url = reverse('register')
        self.valid_user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
            'full_name': 'Test User',
            'date_of_birth': (date.today() - timedelta(days=365*20)).isoformat(),
            'phone_number': '+233123456789',
            'country': 'GH',
            'city': 'Accra'
        }

    def test_user_registration_success(self):
        response = self.client.post(self.register_url, self.valid_user_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['message'], 'Registration successful')
        self.assertEqual(User.objects.count(), 1)

        user = User.objects.first()
        self.assertEqual(user.username, 'testuser')
        self.assertEqual(user.email, 'test@example.com')
        self.assertEqual(user.full_name, 'Test User')

    def test_user_registration_password_mismatch(self):
        data = self.valid_user_data.copy()
        data['confirm_password'] = 'WrongPass123!'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('password', response.data['errors'])
        self.assertEqual(User.objects.count(), 0)

    def test_user_registration_under_13_fails(self):
        data = self.valid_user_data.copy()
        data['date_of_birth'] = (date.today() - timedelta(days=365*12)).isoformat()
        data['username'] = 'testuser2'
        data['email'] = 'test2@example.com'
        data['phone_number'] = '+233123456788'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('date_of_birth', response.data['errors'])
        self.assertEqual(User.objects.count(), 0)

        # Check if blacklisted
        self.assertEqual(BlacklistedRegistration.objects.count(), 1)
        blacklisted = BlacklistedRegistration.objects.first()
        self.assertEqual(blacklisted.reason, 'underage')
        self.assertEqual(blacklisted.email, 'test2@example.com')

    def test_registration_with_existing_email_fails(self):
        # Create first user
        self.client.post(self.register_url, self.valid_user_data, format='json')

        # Try to register with same email
        data = self.valid_user_data.copy()
        data['username'] = 'testuser2'
        data['phone_number'] = '+233123456788'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('email', response.data['errors'])

    def test_registration_with_existing_username_fails(self):
        # Create first user
        self.client.post(self.register_url, self.valid_user_data, format='json')

        # Try to register with same username
        data = self.valid_user_data.copy()
        data['email'] = 'test2@example.com'
        data['phone_number'] = '+233123456788'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('username', response.data['errors'])

    def test_registration_with_existing_phone_fails(self):
        # Create first user
        self.client.post(self.register_url, self.valid_user_data, format='json')

        # Try to register with same phone
        data = self.valid_user_data.copy()
        data['username'] = 'testuser2'
        data['email'] = 'test2@example.com'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('phone_number', response.data['errors'])

    def test_registration_with_blacklisted_details_fails(self):
        # First create a blacklisted entry
        BlacklistedRegistration.objects.create(
            email='blacklisted@example.com',
            phone_number='+233999999999',
            reason='underage',
            attempted_data={},
            ip_address='127.0.0.1'
        )

        data = self.valid_user_data.copy()
        data['email'] = 'blacklisted@example.com'
        data['phone_number'] = '+233999999999'
        data['username'] = 'newuser'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('non_field_errors', response.data['errors'])
        self.assertEqual(User.objects.count(), 0)

    def test_registration_with_non_african_country_fails(self):
        data = self.valid_user_data.copy()
        data['country'] = 'US'
        data['username'] = 'testuser2'
        data['email'] = 'test2@example.com'
        data['phone_number'] = '+233123456788'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('country', response.data['errors'])
        self.assertEqual(User.objects.count(), 0)

    def test_username_validation(self):
        # Test invalid characters
        data = self.valid_user_data.copy()
        data['username'] = 'test@user'
        data['email'] = 'test2@example.com'
        data['phone_number'] = '+233123456788'

        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data['errors'])

        # Test too short
        data['username'] = 'te'
        response = self.client.post(self.register_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('username', response.data['errors'])


class LoginTests(APITestCase):
    """Test user login"""

    def setUp(self):
        self.login_url = reverse('login')
        self.register_url = reverse('register')

        # Create a user
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
            'full_name': 'Test User',
            'date_of_birth': (date.today() - timedelta(days=365*20)).isoformat(),
            'phone_number': '+233123456789',
            'country': 'GH',
            'city': 'Accra'
        }
        self.client.post(self.register_url, self.user_data, format='json')

    def test_login_with_username_success(self):
        data = {
            'username': 'testuser',
            'password': 'TestPass123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['message'], 'Login successful')
        self.assertIn('user', response.data)

    def test_login_with_email_success(self):
        data = {
            'email': 'test@example.com',
            'password': 'TestPass123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    def test_login_with_phone_success(self):
        data = {
            'phone_number': '+233123456789',
            'password': 'TestPass123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

    def test_login_failure_wrong_password(self):
        data = {
            'username': 'testuser',
            'password': 'WrongPassword'
        }
        response = self.client.post(self.login_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

    def test_login_failure_no_identifier(self):
        data = {
            'password': 'TestPass123!'
        }
        response = self.client.post(self.login_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])

# oauth/tests.py - Fix ProfileTests


class ProfileTests(APITestCase):
    """Test user profile operations"""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.profile_url = reverse('my-profile')

        # Create user
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
            'full_name': 'Test User',
            'date_of_birth': (date.today() - timedelta(days=365*20)).isoformat(),
            'phone_number': '+233123456789',
            'country': 'GH',
            'city': 'Accra'
        }

        # Register the user - this will also log them in
        self.client.post(self.register_url, self.user_data, format='json')

        # The client is now authenticated via session cookie
        # Don't set bearer token - Django uses session authentication

    def test_get_profile(self):
        response = self.client.get(self.profile_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])
        self.assertEqual(response.data['user']['username'], 'testuser')
        self.assertEqual(response.data['user']['email'], 'test@example.com')
        self.assertEqual(response.data['user']['full_name'], 'Test User')

    def test_update_profile(self):
        data = {
            'full_name': 'Updated Name',
            'bio': 'This is my bio',
            'city': 'Kumasi'
        }
        response = self.client.patch(self.profile_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Check if updated
        user = User.objects.first()
        self.assertEqual(user.full_name, 'Updated Name')
        self.assertEqual(user.bio, 'This is my bio')
        self.assertEqual(user.city, 'Kumasi')

# oauth/tests.py - Fix PasswordChangeTests


class PasswordChangeTests(APITestCase):
    """Test password change"""

    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse('register')
        self.password_change_url = reverse('change-password')

        # Create user
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
            'full_name': 'Test User',
            'date_of_birth': (date.today() - timedelta(days=365*20)).isoformat(),
            'phone_number': '+233123456789',
            'country': 'GH',
            'city': 'Accra'
        }

        # Register the user - this logs them in automatically
        self.client.post(self.register_url, self.user_data, format='json')

    def test_password_change_success(self):
        data = {
            'old_password': 'TestPass123!',
            'new_password': 'NewPass123!',
            'confirm_new_password': 'NewPass123!'
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['success'])

        # Test login with new password
        login_url = reverse('login')
        login_data = {
            'username': 'testuser',
            'password': 'NewPass123!'
        }
        login_response = self.client.post(login_url, login_data, format='json')
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)

    def test_password_change_wrong_old_password(self):
        data = {
            'old_password': 'WrongPass123!',
            'new_password': 'NewPass123!',
            'confirm_new_password': 'NewPass123!'
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('old_password', response.data['errors'])

    def test_password_change_mismatch(self):
        data = {
            'old_password': 'TestPass123!',
            'new_password': 'NewPass123!',
            'confirm_new_password': 'DifferentPass123!'
        }
        response = self.client.post(self.password_change_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(response.data['success'])
        self.assertIn('confirm_new_password', response.data['errors'])

# oauth/tests.py - Fix CheckAvailabilityTests


class CheckAvailabilityTests(APITestCase):
    """Test username and email availability checks"""

    def setUp(self):
        self.check_username_url = reverse('check-username')
        self.check_email_url = reverse('check-email')
        self.register_url = reverse('register')

        # Create a user
        self.user_data = {
            'username': 'testuser',
            'email': 'test@example.com',
            'password': 'TestPass123!',
            'confirm_password': 'TestPass123!',
            'full_name': 'Test User',
            'date_of_birth': (date.today() - timedelta(days=365*20)).isoformat(),
            'phone_number': '+233123456789',
            'country': 'GH',
            'city': 'Accra'
        }

        # This will create the user
        self.client.post(self.register_url, self.user_data, format='json')

    # Keep the rest of the test methods as they are

    def test_check_username_available(self):
        data = {'username': 'newuser'}
        response = self.client.post(self.check_username_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['available'])

    def test_check_username_taken(self):
        data = {'username': 'testuser'}
        response = self.client.post(self.check_username_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])

    def test_check_email_available(self):
        data = {'email': 'new@example.com'}
        response = self.client.post(self.check_email_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['available'])

    def test_check_email_taken(self):
        data = {'email': 'test@example.com'}
        response = self.client.post(self.check_email_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['available'])
