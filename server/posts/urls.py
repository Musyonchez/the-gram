# posts/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'posts', views.PostViewSet, basename='post')
router.register(r'collections', views.CollectionViewSet, basename='collection')

# Nested router for comments
post_router = DefaultRouter()
post_router.register(r'comments', views.CommentViewSet, basename='post-comment')

urlpatterns = [
    # Post routes are handled by the main router
    path('', include(router.urls)),
    
    # Nested comments routes
    path('posts/<int:post_pk>/', include(post_router.urls)),
    
    # Feed routes
    path('feed/', views.FeedView.as_view(), name='feed'),
    path('explore/', views.ExploreView.as_view(), name='explore'),
    
    # Saved posts
    path('saved/', views.SavedPostsView.as_view(), name='saved-posts'),
]