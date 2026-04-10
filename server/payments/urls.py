# payments/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

urlpatterns = [
    # Donation endpoints
    path('donate/mpesa/', views.InitiateMpesaDonationView.as_view(), name='mpesa-donate'),
    path('donate/tip/', views.TipCreatorView.as_view(), name='tip-creator'),
    path('mpesa/callback/', views.MpesaCallbackView.as_view(), name='mpesa-callback'),
    path('history/', views.DonationHistoryView.as_view(), name='donation-history'),
    path('stats/', views.DonationStatsView.as_view(), name='donation-stats'),
    path('post/<int:post_id>/donations/', views.PostDonationsView.as_view(), name='post-donations'),
]