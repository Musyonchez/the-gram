from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # Authentication
    path('register/', views.RegistrationView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('refresh-token/', TokenRefreshView.as_view(), name='token_refresh'),
    path('change-password/', views.PasswordChangeView.as_view(), name='change-password'),
    
    # Profile
    path('profile/', views.UserProfileView.as_view(), name='my-profile'),
    path('profile/<str:username>/', views.UserDetailView.as_view(), name='user-profile'),
    
    # Validation endpoints
    path('check-username/', views.check_username, name='check-username'),
    path('check-email/', views.check_email, name='check-email'),
]