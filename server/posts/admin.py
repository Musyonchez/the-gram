# posts/admin.py
from django.contrib import admin
from .models import (
    Post, CarouselImage, Like, Comment, CommentLike,
    Save, Collection, Report
)
# Remove Follow from imports

@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post_type', 'visibility', 'likes_count', 'comments_count', 'created_at']
    list_filter = ['post_type', 'visibility', 'created_at']
    search_fields = ['user__username', 'user__email', 'caption']
    readonly_fields = ['likes_count', 'comments_count', 'shares_count', 'saves_count', 'created_at', 'updated_at']
    raw_id_fields = ['user']

@admin.register(CarouselImage)
class CarouselImageAdmin(admin.ModelAdmin):
    list_display = ['id', 'post', 'order', 'created_at']
    list_filter = ['created_at']
    raw_id_fields = ['post']

@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'created_at']
    list_filter = ['created_at']
    raw_id_fields = ['user', 'post']

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'content_preview', 'likes_count', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'content']
    raw_id_fields = ['user', 'post', 'parent']
    
    def content_preview(self, obj):
        return obj.content[:50] + '...' if len(obj.content) > 50 else obj.content
    content_preview.short_description = 'Content'

@admin.register(CommentLike)
class CommentLikeAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'comment', 'created_at']
    list_filter = ['created_at']
    raw_id_fields = ['user', 'comment']

# Follow model is now in oauth app - remove from here
# If you want to manage Follow from admin, add it to oauth/admin.py

@admin.register(Save)
class SaveAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'post', 'collection', 'created_at']
    list_filter = ['created_at']
    raw_id_fields = ['user', 'post', 'collection']

@admin.register(Collection)
class CollectionAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'name', 'visibility', 'posts_count', 'created_at']
    list_filter = ['visibility', 'created_at']
    search_fields = ['user__username', 'name']
    raw_id_fields = ['user']

@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ['id', 'reporter', 'post', 'comment', 'reason', 'status', 'created_at']
    list_filter = ['reason', 'status', 'created_at']
    search_fields = ['reporter__username', 'description']
    raw_id_fields = ['reporter', 'post', 'comment']