# oauth/admin.py
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, BlacklistedRegistration, Follow

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ['username', 'email', 'full_name', 'country', 'city', 'is_active', 'date_joined']
    list_filter = ['is_active', 'is_staff', 'country', 'date_joined']
    search_fields = ['username', 'email', 'full_name', 'phone_number']
    readonly_fields = ['date_joined', 'last_login', 'age']
    
    fieldsets = UserAdmin.fieldsets + (
        ('Personal Info', {'fields': ('full_name', 'date_of_birth', 'bio', 'phone_number', 'country', 'city')}),
        ('Profile Images', {'fields': ('profile_picture', 'cover_photo')}),
        ('Verification', {'fields': ('is_age_verified', 'age_verified_at', 'is_verified')}),
    )
    
    def get_readonly_fields(self, request, obj=None):
        if obj:  # editing an existing object
            return self.readonly_fields + ('username', 'email')
        return self.readonly_fields

@admin.register(BlacklistedRegistration)
class BlacklistedRegistrationAdmin(admin.ModelAdmin):
    list_display = ['email', 'phone_number', 'reason', 'created_at']
    list_filter = ['reason', 'created_at']
    search_fields = ['email', 'phone_number', 'attempted_data']
    readonly_fields = ['created_at']

@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ['id', 'follower', 'following', 'created_at']
    list_filter = ['created_at']
    search_fields = ['follower__username', 'following__username']
    raw_id_fields = ['follower', 'following']
    readonly_fields = ['created_at']