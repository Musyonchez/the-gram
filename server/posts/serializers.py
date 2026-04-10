# posts/serializers.py
from rest_framework import serializers
from django.db import models
from django.utils import timezone
from datetime import timedelta
from .models import (
    Post, CarouselImage, Like, Comment, CommentLike,
    Save, Collection, Report
)
from oauth.models import Follow
from oauth.serializers import UserProfileSerializer


class CarouselImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarouselImage
        fields = ['id', 'image', 'order']


class PostSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    likes_count = serializers.IntegerField(read_only=True)
    comments_count = serializers.IntegerField(read_only=True)
    saves_count = serializers.IntegerField(read_only=True)
    shares_count = serializers.IntegerField(read_only=True)
    is_liked = serializers.SerializerMethodField()
    is_saved = serializers.SerializerMethodField()
    is_following = serializers.SerializerMethodField()
    carousel_images = CarouselImageSerializer(many=True, read_only=True)
    media_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Post
        fields = [
            'id', 'user', 'post_type', 'caption', 'media_file', 'media_url',
            'thumbnail', 'thumbnail_url', 'is_carousel', 'carousel_images',
            'location_name', 'location_country', 'location_city',
            'location_lat', 'location_lng',
            'likes_count', 'comments_count', 'saves_count', 'shares_count',
            'visibility', 'allow_comments', 'allow_sharing',
            'created_at', 'updated_at',
            'is_liked', 'is_saved', 'is_following'
        ]
        read_only_fields = [
            'likes_count', 'comments_count', 'saves_count', 'shares_count',
            'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'media_file': {'write_only': True},
            'thumbnail': {'write_only': True},
        }
    
    def get_media_url(self, obj):
        if obj.media_file and hasattr(obj.media_file, 'url'):
            return obj.media_file.url
        return None
    
    def get_thumbnail_url(self, obj):
        if obj.thumbnail and hasattr(obj.thumbnail, 'url'):
            return obj.thumbnail.url
        return None
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def get_is_saved(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.saves.filter(user=request.user).exists()
        return False
    
    def get_is_following(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            if request.user == obj.user:
                return None
            return Follow.objects.filter(
                follower=request.user,
                following=obj.user
            ).exists()
        return False
    
    def validate_media_file(self, value):
        if value.size > 100 * 1024 * 1024:
            raise serializers.ValidationError("File size cannot exceed 100MB")
        return value


class PostCreateSerializer(serializers.ModelSerializer):
    carousel_images = serializers.ListField(
        child=serializers.ImageField(),
        write_only=True,
        required=False
    )
    
    class Meta:
        model = Post
        fields = [
            'post_type', 'caption', 'media_file', 'carousel_images',
            'location_name', 'location_country', 'location_city',
            'location_lat', 'location_lng',
            'visibility', 'allow_comments', 'allow_sharing'
        ]
    
    def validate(self, data):
        post_type = data.get('post_type')
        media_file = data.get('media_file')
        carousel_images = data.get('carousel_images')
        
        if post_type == 'carousel':
            if not carousel_images or len(carousel_images) < 2:
                raise serializers.ValidationError(
                    "Carousel posts require at least 2 images"
                )
            if len(carousel_images) > 10:
                raise serializers.ValidationError(
                    "Carousel posts cannot have more than 10 images"
                )
        else:
            if not media_file:
                raise serializers.ValidationError(
                    f"Media file is required for {post_type} posts"
                )
        
        return data
    
    def create(self, validated_data):
        carousel_images = validated_data.pop('carousel_images', [])
        user = self.context['request'].user
        
        if carousel_images:
            validated_data['is_carousel'] = True
            validated_data['post_type'] = 'carousel'
        
        post = Post.objects.create(user=user, **validated_data)
        
        for order, image in enumerate(carousel_images):
            CarouselImage.objects.create(
                post=post,
                image=image,
                order=order
            )
        
        return post


class LikeSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = Like
        fields = ['id', 'user', 'created_at']


class CommentSerializer(serializers.ModelSerializer):
    user = UserProfileSerializer(read_only=True)
    replies_count = serializers.SerializerMethodField()
    is_liked = serializers.SerializerMethodField()
    
    class Meta:
        model = Comment
        fields = [
            'id', 'user', 'content', 'likes_count', 'replies_count',
            'created_at', 'updated_at', 'parent', 'is_liked'
        ]
        read_only_fields = ['likes_count', 'created_at', 'updated_at']
    
    def get_replies_count(self, obj):
        return obj.replies.count()
    
    def get_is_liked(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            return obj.likes.filter(user=request.user).exists()
        return False
    
    def validate_parent(self, value):
        if value and value.parent:
            raise serializers.ValidationError("Cannot reply to a reply")
        return value


class CommentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comment
        fields = ['content', 'parent']
    
    def validate(self, data):
        post_id = self.context.get('post_id')
        if post_id:
            try:
                post = Post.objects.get(id=post_id)
                if not post.allow_comments:
                    raise serializers.ValidationError(
                        "Comments are disabled for this post"
                    )
            except Post.DoesNotExist:
                raise serializers.ValidationError("Post not found")
        
        parent = data.get('parent')
        if parent and parent.post.id != int(post_id):
            raise serializers.ValidationError(
                "Parent comment does not belong to this post"
            )
        
        return data
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        validated_data['post_id'] = self.context['post_id']
        return super().create(validated_data)


class CollectionSerializer(serializers.ModelSerializer):
    posts_count = serializers.IntegerField(read_only=True)
    cover_image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Collection
        fields = [
            'id', 'name', 'description', 'cover_image', 'cover_image_url',
            'visibility', 'posts_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
    
    def get_cover_image_url(self, obj):
        if obj.cover_image and hasattr(obj.cover_image, 'url'):
            return obj.cover_image.url
        return None
    
    def validate_name(self, value):
        user = self.context['request'].user
        if Collection.objects.filter(user=user, name=value).exists():
            raise serializers.ValidationError(
                "You already have a collection with this name"
            )
        return value
    
    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class SaveSerializer(serializers.ModelSerializer):
    post = PostSerializer(read_only=True)
    collection = CollectionSerializer(read_only=True)
    
    class Meta:
        model = Save
        fields = ['id', 'post', 'collection', 'created_at']


class SaveCreateSerializer(serializers.Serializer):
    post_id = serializers.IntegerField()
    collection_id = serializers.IntegerField(required=False)
    
    def validate_post_id(self, value):
        try:
            post = Post.objects.get(id=value, visibility='public')
            return post
        except Post.DoesNotExist:
            raise serializers.ValidationError("Post not found")
    
    def validate_collection_id(self, value):
        if value:
            try:
                collection = Collection.objects.get(
                    id=value,
                    user=self.context['request'].user
                )
                return collection
            except Collection.DoesNotExist:
                raise serializers.ValidationError("Collection not found")
        return None
    
    def validate(self, data):
        user = self.context['request'].user
        post = data['post_id']
        
        if Save.objects.filter(user=user, post=post).exists():
            raise serializers.ValidationError("Post already saved")
        
        return data
    
    def save(self, **kwargs):
        user = self.context['request'].user
        post = self.validated_data['post_id']
        collection = self.validated_data.get('collection_id')
        
        return Save.objects.create(
            user=user,
            post=post,
            collection=collection
        )


class ReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = Report
        fields = ['id', 'reason', 'description', 'created_at', 'status']
        read_only_fields = ['created_at', 'status']
    
    def validate(self, data):
        user = self.context['request'].user
        post_id = self.context.get('post_id')
        comment_id = self.context.get('comment_id')
        
        if not post_id and not comment_id:
            raise serializers.ValidationError(
                "Either post_id or comment_id is required"
            )
        
        if post_id:
            try:
                post = Post.objects.get(id=post_id)
                if Report.objects.filter(
                    reporter=user,
                    post=post,
                    status='pending'
                ).exists():
                    raise serializers.ValidationError(
                        "You have already reported this post"
                    )
            except Post.DoesNotExist:
                raise serializers.ValidationError("Post not found")
        
        if comment_id:
            try:
                comment = Comment.objects.get(id=comment_id)
                if Report.objects.filter(
                    reporter=user,
                    comment=comment,
                    status='pending'
                ).exists():
                    raise serializers.ValidationError(
                        "You have already reported this comment"
                    )
            except Comment.DoesNotExist:
                raise serializers.ValidationError("Comment not found")
        
        return data
    
    def create(self, validated_data):
        validated_data['reporter'] = self.context['request'].user
        
        if 'post_id' in self.context:
            validated_data['post_id'] = self.context['post_id']
        if 'comment_id' in self.context:
            validated_data['comment_id'] = self.context['comment_id']
        
        return super().create(validated_data)