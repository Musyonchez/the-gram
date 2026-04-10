# posts/views.py
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.views import APIView
from django.db.models import Q, Count, Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import timedelta
from .models import (
    Post, CarouselImage, Like, Comment, CommentLike,
    Save, Collection, Report
)
from .serializers import (
    PostSerializer, PostCreateSerializer, LikeSerializer,
    CommentSerializer, CommentCreateSerializer,
    CollectionSerializer, SaveSerializer, SaveCreateSerializer,
    ReportSerializer
)
from oauth.models import User, Follow
from oauth.serializers import UserProfileSerializer


class PostViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        username = self.request.query_params.get('user', None)
        
        # Base queryset with optimizations
        queryset = Post.objects.select_related('user').prefetch_related(
            'carousel_images',
            Prefetch('likes', queryset=Like.objects.filter(user=user), to_attr='user_like'),
            Prefetch('saves', queryset=Save.objects.filter(user=user), to_attr='user_save')
        )
        
        # If username is provided (for user's own posts), filter by that user
        if username:
            return queryset.filter(user__username=username).order_by('-created_at')
        
        # Otherwise, return feed (posts from followed users and public posts)
        following_users = user.following.values_list('following', flat=True)
        return queryset.filter(
            Q(user__in=following_users) |
            Q(user=user) |
            Q(visibility='public')
        ).distinct().order_by('-created_at')
    
    def get_serializer_class(self):
        if self.action == 'create':
            return PostCreateSerializer
        return PostSerializer
    
    def perform_create(self, serializer):
        # DON'T pass user here - it will be handled in the serializer's create method
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def like(self, request, pk=None):
        """Like or unlike a post"""
        post = self.get_object()
        like, created = Like.objects.get_or_create(user=request.user, post=post)
        
        if created:
            return Response({
                'status': 'liked',
                'likes_count': post.likes_count
            }, status=status.HTTP_201_CREATED)
        else:
            like.delete()
            return Response({
                'status': 'unliked',
                'likes_count': post.likes_count
            }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def likes(self, request, pk=None):
        """Get users who liked this post"""
        post = self.get_object()
        likes = post.likes.select_related('user').all()[:50]
        
        users = [like.user for like in likes]
        serializer = UserProfileSerializer(users, many=True, context={'request': request})
        
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def comment(self, request, pk=None):
        """Add a comment to the post"""
        post = self.get_object()
        
        if not post.allow_comments:
            return Response(
                {'error': 'Comments are disabled for this post'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = CommentCreateSerializer(
            data=request.data,
            context={'request': request, 'post_id': post.id}
        )
        
        if serializer.is_valid():
            comment = serializer.save()
            return Response(
                CommentSerializer(comment, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Get comments for the post"""
        post = self.get_object()
        
        # Get top-level comments (no parent)
        comments = post.comments.filter(
            parent__isnull=True
        ).select_related('user').prefetch_related(
            'replies__user',
            Prefetch('likes', queryset=CommentLike.objects.filter(user=request.user), to_attr='user_like')
        ).order_by('-created_at')
        
        page = self.paginate_queryset(comments)
        if page is not None:
            serializer = CommentSerializer(page, many=True, context={'request': request})
            return self.get_paginated_response(serializer.data)
        
        serializer = CommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def save(self, request, pk=None):
        """Save a post to a collection"""
        post = self.get_object()
        
        serializer = SaveCreateSerializer(
            data={'post_id': post.id, **request.data},
            context={'request': request}
        )
        
        if serializer.is_valid():
            save = serializer.save()
            return Response(
                SaveSerializer(save, context={'request': request}).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['delete'])
    def unsave(self, request, pk=None):
        """Remove a post from saves"""
        post = self.get_object()
        
        try:
            save = Save.objects.get(user=request.user, post=post)
            save.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Save.DoesNotExist:
            return Response(
                {'error': 'Post not saved'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    @action(detail=True, methods=['post'])
    def report(self, request, pk=None):
        """Report a post"""
        post = self.get_object()
        
        serializer = ReportSerializer(
            data=request.data,
            context={'request': request, 'post_id': post.id}
        )
        
        if serializer.is_valid():
            report = serializer.save()
            return Response(
                ReportSerializer(report).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommentViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CommentSerializer
    
    def get_queryset(self):
        return Comment.objects.filter(
            post_id=self.kwargs.get('post_pk')
        ).select_related('user', 'post').prefetch_related('replies')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['post_id'] = self.kwargs.get('post_pk')
        return context
    
    def perform_create(self, serializer):
        serializer.save(
            user=self.request.user,
            post_id=self.kwargs.get('post_pk')
        )
    
    @action(detail=True, methods=['post'])
    def like(self, request, post_pk=None, pk=None):
        """Like or unlike a comment"""
        comment = self.get_object()
        like, created = CommentLike.objects.get_or_create(
            user=request.user,
            comment=comment
        )
        
        if created:
            return Response({
                'status': 'liked',
                'likes_count': comment.likes_count
            }, status=status.HTTP_201_CREATED)
        else:
            like.delete()
            return Response({
                'status': 'unliked',
                'likes_count': comment.likes_count
            }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def report(self, request, post_pk=None, pk=None):
        """Report a comment"""
        comment = self.get_object()
        
        serializer = ReportSerializer(
            data=request.data,
            context={'request': request, 'comment_id': comment.id}
        )
        
        if serializer.is_valid():
            report = serializer.save()
            return Response(
                ReportSerializer(report).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=True, methods=['get'])
    def replies(self, request, post_pk=None, pk=None):
        """Get replies to a comment"""
        comment = self.get_object()
        replies = comment.replies.select_related('user').all()
        
        serializer = CommentSerializer(replies, many=True, context={'request': request})
        return Response(serializer.data)


class FeedView(generics.ListAPIView):
    """Get personalized feed for the user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Get users that the current user follows
        following_users = user.following.values_list('following', flat=True)
        
        # Get posts from followed users (last 7 days)
        week_ago = timezone.now() - timedelta(days=7)
        
        return Post.objects.filter(
            Q(user__in=following_users) |
            Q(user=user),
            created_at__gte=week_ago
        ).select_related('user').prefetch_related(
            'carousel_images'
        ).order_by('-created_at')


class ExploreView(generics.ListAPIView):
    """Get popular posts for discovery"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostSerializer
    
    def get_queryset(self):
        user = self.request.user
        
        # Get popular posts from the last 7 days
        week_ago = timezone.now() - timedelta(days=7)
        
        # Exclude posts from users the current user already follows
        following_users = user.following.values_list('following', flat=True)
        
        return Post.objects.filter(
            visibility='public',
            created_at__gte=week_ago
        ).exclude(
            user__in=following_users
        ).exclude(
            user=user
        ).annotate(
            engagement=Count('likes') + Count('comments') + Count('saves')
        ).select_related('user').prefetch_related(
            'carousel_images'
        ).order_by('-engagement', '-created_at')[:50]


class CollectionViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = CollectionSerializer
    
    def get_queryset(self):
        return Collection.objects.filter(
            user=self.request.user
        ).prefetch_related('saved_posts').order_by('-created_at')
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=True, methods=['get'])
    def posts(self, request, pk=None):
        """Get posts in a collection"""
        collection = self.get_object()
        saves = collection.saved_posts.select_related('post__user').all()
        
        posts = [save.post for save in saves]
        serializer = PostSerializer(posts, many=True, context={'request': request})
        
        return Response(serializer.data)
    
    @action(detail=True, methods=['post'])
    def remove_post(self, request, pk=None):
        """Remove a post from the collection"""
        collection = self.get_object()
        post_id = request.data.get('post_id')
        
        try:
            save = Save.objects.get(
                collection=collection,
                post_id=post_id
            )
            save.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Save.DoesNotExist:
            return Response(
                {'error': 'Post not found in collection'},
                status=status.HTTP_404_NOT_FOUND
            )


class SavedPostsView(generics.ListAPIView):
    """Get all saved posts for the user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostSerializer
    
    def get_queryset(self):
        user = self.request.user
        saves = user.save_set.select_related('post__user').all()
        
        return [save.post for save in saves]


# Add a dedicated view for user posts
class UserPostsView(generics.ListAPIView):
    """Get posts for a specific user"""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PostSerializer
    
    def get_queryset(self):
        username = self.kwargs.get('username')
        return Post.objects.filter(
            user__username=username
        ).select_related('user').prefetch_related(
            'carousel_images',
            'likes',
            'saves'
        ).order_by('-created_at')