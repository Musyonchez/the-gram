# oauth/views.py
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from django.core.exceptions import ObjectDoesNotExist
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, BlacklistedRegistration, Follow
from .serializers import (
    UserRegistrationSerializer, UserLoginSerializer, UserProfileSerializer,
    UserUpdateSerializer, PasswordChangeSerializer, FollowSerializer,
    FollowActionSerializer, UserProfileWithFollowSerializer
)


class RegistrationView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]

    def post(self, request, *args, **kwargs):
        # Handle FormData with files
        if request.content_type and 'multipart/form-data' in request.content_type:
            # For file uploads, we need to handle the data differently
            data = request.data.copy()
            serializer = self.get_serializer(data=data, context={'request': request})
        else:
            serializer = self.get_serializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user = serializer.save()

            # Create JWT tokens
            refresh = RefreshToken.for_user(user)

            return Response({
                "success": True,
                "message": "Registration successful",
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "user": UserProfileSerializer(user, context={'request': request}).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = UserLoginSerializer(data=request.data)

        if serializer.is_valid():
            user = serializer.validated_data['user']

            # Create JWT tokens
            refresh = RefreshToken.for_user(user)

            return Response({
                "success": True,
                "message": "Login successful",
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "user": UserProfileSerializer(user, context={'request': request}).data
            })

        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            if refresh_token := request.data.get("refresh_token"):
                RefreshToken(refresh_token).blacklist()
            return Response({
                "success": True,
                "message": "Logout successful"
            })
        except Exception:
            return Response({
                "success": False,
                "message": "Invalid token"
            }, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = self.get_serializer(user)
        return Response({
            "success": True,
            "user": serializer.data
        })

    def patch(self, request, *args, **kwargs):
        user = self.get_object()
        serializer = UserUpdateSerializer(user, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response({
                "success": True,
                "message": "Profile updated successfully",
                "user": UserProfileSerializer(user, context={'request': request}).data
            })

        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class UserDetailView(generics.RetrieveAPIView):
    queryset = User.objects.filter(is_active=True)
    serializer_class = UserProfileWithFollowSerializer  # Updated to include follow info
    permission_classes = [permissions.AllowAny]
    lookup_field = 'username'

    def get(self, request, *args, **kwargs):
        try:
            user = self.get_object()
            serializer = self.get_serializer(user, context={'request': request})
            return Response({
                "success": True,
                "user": serializer.data
            })
        except ObjectDoesNotExist:
            return Response({
                "success": False,
                "message": "User not found"
            }, status=status.HTTP_404_NOT_FOUND)


class PasswordChangeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data,
            context={'request': request}
        )

        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.save()

            return Response({
                "success": True,
                "message": "Password changed successfully"
            })

        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def check_username(request):
    """Check if username is available"""
    username = request.data.get('username', '').lower()

    if not username:
        return Response({
            "success": False,
            "message": "Username is required"
        }, status=status.HTTP_400_BAD_REQUEST)

    exists = User.objects.filter(username=username).exists()
    blacklisted = BlacklistedRegistration.objects.filter(
        attempted_data__username=username
    ).exists()

    return Response({
        "success": True,
        "available": not exists and not blacklisted,
        "message": "Username is taken" if exists else "Username is available"
    })


@api_view(['POST'])
@permission_classes([permissions.AllowAny])
def check_email(request):
    """Check if email is available"""
    email = request.data.get('email', '').lower()

    if not email:
        return Response({
            "success": False,
            "message": "Email is required"
        }, status=status.HTTP_400_BAD_REQUEST)

    exists = User.objects.filter(email=email).exists()
    blacklisted = BlacklistedRegistration.objects.filter(email=email).exists()

    return Response({
        "success": True,
        "available": not exists and not blacklisted,
        "message": "Email is already registered" if exists else "Email is available"
    })

# ==================== FOLLOW FUNCTIONALITY VIEWS ====================


class FollowUserView(APIView):
    """Follow a user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FollowActionSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user_to_follow_id = serializer.validated_data['user_id']
            user_to_follow = User.objects.get(id=user_to_follow_id)

            # Check if already following
            if Follow.objects.filter(follower=request.user, following=user_to_follow).exists():
                return Response({
                    "success": False,
                    "message": "You are already following this user"
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create follow relationship
            follow = Follow.objects.create(
                follower=request.user,
                following=user_to_follow
            )

            return Response({
                "success": True,
                "message": f"You are now following {user_to_follow.username}",
                "follow": FollowSerializer(follow).data
            }, status=status.HTTP_201_CREATED)

        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class UnfollowUserView(APIView):
    """Unfollow a user"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = FollowActionSerializer(data=request.data, context={'request': request})

        if serializer.is_valid():
            user_to_unfollow_id = serializer.validated_data['user_id']
            user_to_unfollow = User.objects.get(id=user_to_unfollow_id)

            # Check if following exists
            try:
                follow = Follow.objects.get(follower=request.user, following=user_to_unfollow)
                follow.delete()

                return Response({
                    "success": True,
                    "message": f"You have unfollowed {user_to_unfollow.username}"
                }, status=status.HTTP_200_OK)
            except Follow.DoesNotExist:
                return Response({
                    "success": False,
                    "message": "You are not following this user"
                }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "success": False,
            "errors": serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class FollowersListView(APIView):
    """Get list of users following a specific user"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username.lower())
            followers = user.followers.all().select_related('follower')

            # Serialize with pagination
            page = request.GET.get('page', 1)
            page_size = request.GET.get('page_size', 20)

            start = (int(page) - 1) * int(page_size)
            end = start + int(page_size)

            followers_list = [
                {
                    'id': follow.follower.id,
                    'username': follow.follower.username,
                    'full_name': follow.follower.full_name,
                    'profile_picture_url': follow.follower.profile_picture_url,
                    'bio': follow.follower.bio,
                    'followed_at': follow.created_at
                }
                for follow in followers[start:end]
            ]

            return Response({
                "success": True,
                "count": followers.count(),
                "followers": followers_list
            })
        except User.DoesNotExist:
            return Response({
                "success": False,
                "message": "User not found"
            }, status=status.HTTP_404_NOT_FOUND)


class FollowingListView(APIView):
    """Get list of users a specific user is following"""
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        try:
            user = User.objects.get(username=username.lower())
            following = user.following.all().select_related('following')

            # Serialize with pagination
            page = request.GET.get('page', 1)
            page_size = request.GET.get('page_size', 20)

            start = (int(page) - 1) * int(page_size)
            end = start + int(page_size)

            following_list = [
                {
                    'id': follow.following.id,
                    'username': follow.following.username,
                    'full_name': follow.following.full_name,
                    'profile_picture_url': follow.following.profile_picture_url,
                    'bio': follow.following.bio,
                    'followed_at': follow.created_at
                }
                for follow in following[start:end]
            ]

            return Response({
                "success": True,
                "count": following.count(),
                "following": following_list
            })
        except User.DoesNotExist:
            return Response({
                "success": False,
                "message": "User not found"
            }, status=status.HTTP_404_NOT_FOUND)


class CheckFollowStatusView(APIView):
    """Check if current user follows another user"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, username):
        try:
            user_to_check = User.objects.get(username=username.lower())
            is_following = Follow.objects.filter(
                follower=request.user,
                following=user_to_check
            ).exists()
            is_followed_by = Follow.objects.filter(
                follower=user_to_check,
                following=request.user
            ).exists()

            return Response({
                "success": True,
                "is_following": is_following,
                "is_followed_by": is_followed_by
            })
        except User.DoesNotExist:
            return Response({
                "success": False,
                "message": "User not found"
            }, status=status.HTTP_404_NOT_FOUND)


class SuggestionsView(APIView):
    """Get suggested users to follow"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Get users that the current user is not following
        following_ids = request.user.following.values_list('following_id', flat=True)

        suggested_users = User.objects.filter(
            is_active=True,
            is_age_verified=True
        ).exclude(
            id=request.user.id
        ).exclude(
            id__in=following_ids
        ).order_by('-date_joined')[:20]

        serializer = UserProfileSerializer(suggested_users, many=True, context={'request': request})

        return Response({
            "success": True,
            "suggestions": serializer.data
        })
