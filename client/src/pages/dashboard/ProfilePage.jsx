// pages/dashboard/ProfilePage.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  FiHeart, 
  FiMessageCircle, 
  FiEdit2,
  FiUserPlus,
  FiUserCheck,
  FiMapPin,
  FiCalendar,
  FiArrowLeft,
  FiGrid,
  FiBookmark,
  FiCamera,
  FiX
} from 'react-icons/fi';
import { getUser, getAccessToken, isAuthenticated, updateProfile } from '../../services/auth';
import { formatPostData, getSavedPosts } from '../../services/posts';

// Helper function to get full image URL
const getImageUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  // Django media base URL
  const MEDIA_BASE_URL = 'http://localhost:8000';
  if (path.startsWith('/media/')) return `${MEDIA_BASE_URL}${path}`;
  if (path.startsWith('media/')) return `${MEDIA_BASE_URL}/${path}`;
  return `${MEDIA_BASE_URL}/${path}`;
};

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Image upload states
  const [profilePicture, setProfilePicture] = useState(null);
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [profilePreview, setProfilePreview] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  
  const profileInputRef = useRef(null);
  const coverInputRef = useRef(null);
  
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    city: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        
        const currentUserData = getUser();
        setCurrentUser(currentUserData);
        
        const profileUsername = username || currentUserData?.username;
        
        if (!profileUsername) {
          navigate('/dashboard');
          return;
        }
        
        const token = getAccessToken();
        
        // Fetch user profile
        const response = await fetch(`http://localhost:8000/api/auth/profile/${profileUsername}/`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        
        if (!response.ok) {
          throw new Error('Profile not found');
        }
        
        const data = await response.json();
        
        setProfile(data.user);
        setFollowersCount(data.user.followers_count || 0);
        setFollowingCount(data.user.following_count || 0);
        setIsFollowing(data.user.is_following || false);
        
        setEditForm({
          full_name: data.user.full_name || '',
          bio: data.user.bio || '',
          city: data.user.city || '',
        });
        
        // Fetch user's posts
        await fetchUserPosts(profileUsername, token);
        
        // Fetch saved posts only for own profile
        if (!username || (currentUserData && currentUserData.username === profileUsername)) {
          await fetchSavedPosts();
        }
        
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast.error(error.message || 'Failed to load profile');
        if (error.message === 'Profile not found') {
          navigate('/dashboard');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [username, navigate]);

  const fetchUserPosts = async (profileUsername, token) => {
    try {
      const postsResponse = await fetch(`http://localhost:8000/api/posts/?user=${profileUsername}`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      
      if (postsResponse.ok) {
        const postsData = await postsResponse.json();
        const formattedPosts = (postsData.results || []).map(formatPostData);
        setPosts(formattedPosts);
      } else {
        setPosts([]);
      }
    } catch (postsError) {
      console.error('Error fetching posts:', postsError);
      setPosts([]);
    }
  };

  const fetchSavedPosts = async () => {
    try {
      const savedData = await getSavedPosts();
      const formattedSavedPosts = (savedData.results || []).map(formatPostData);
      setSavedPosts(formattedSavedPosts);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
      setSavedPosts([]);
    }
  };

  const handleFollow = async () => {
    if (!isAuthenticated()) {
      navigate('/auth');
      return;
    }
    
    try {
      const token = getAccessToken();
      const url = isFollowing 
        ? 'http://localhost:8000/api/auth/unfollow/'
        : 'http://localhost:8000/api/auth/follow/';
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: profile.id }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setIsFollowing(!isFollowing);
        setFollowersCount(prev => isFollowing ? prev - 1 : prev + 1);
        toast.success(data.message);
      } else {
        toast.error(data.message || data.error || 'Action failed');
      }
    } catch (error) {
      console.error('Error following/unfollowing:', error);
      toast.error('Something went wrong');
    }
  };
  
  const handleProfilePictureSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Profile picture must be less than 5MB');
        return;
      }
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCoverPhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('Cover photo must be less than 10MB');
        return;
      }
      setCoverPhoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditProfile = async (e) => {
    e.preventDefault();
    
    try {
      setUploading(true);
      const formData = new FormData();
      
      // Add text fields
      formData.append('full_name', editForm.full_name);
      formData.append('bio', editForm.bio);
      formData.append('city', editForm.city);
      
      // Add images if they exist
      if (profilePicture) {
        formData.append('profile_picture', profilePicture);
      }
      if (coverPhoto) {
        formData.append('cover_photo', coverPhoto);
      }
      
      const result = await updateProfile(formData);
      
      if (result.success !== false) {
        setProfile(result.user);
        setProfilePreview(null);
        setCoverPreview(null);
        setProfilePicture(null);
        setCoverPhoto(null);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      } else {
        toast.error(result.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setUploading(false);
    }
  };
  
  const handleUnsave = async (postId) => {
    try {
      const token = getAccessToken();
      const response = await fetch(`http://localhost:8000/api/posts/${postId}/unsave/`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.status === 204) {
        setSavedPosts(prev => prev.filter(post => post.id !== postId));
        toast.success('Post removed from saved');
      }
    } catch (error) {
      console.error('Error unsaving post:', error);
      toast.error('Failed to remove post');
    }
  };
  
  const cancelEdit = () => {
    setIsEditing(false);
    setProfilePreview(null);
    setCoverPreview(null);
    setProfilePicture(null);
    setCoverPhoto(null);
    setEditForm({
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
      city: profile?.city || '',
    });
  };
  
  const isOwnProfile = !username || (currentUser && currentUser.username === profile?.username);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff7b57] border-t-transparent"></div>
          <p className="text-white mt-4">Loading profile...</p>
        </div>
      </div>
    );
  }
  
  if (!profile) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="text-center">
          <p className="text-white mb-4">User not found</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="bg-[#ff7b57] text-black px-6 py-2 rounded-full"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  const displayPosts = activeTab === 'posts' ? posts : savedPosts;
  
  // Get full image URLs
  const profileImageUrl = getImageUrl(profile.profile_picture_url);
  const coverImageUrl = getImageUrl(profile.cover_photo_url);
  
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back Button */}
      <button
        onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-zinc-400 hover:text-white mb-6 transition"
      >
        <FiArrowLeft size={20} />
        Back to Dashboard
      </button>
      
      {/* Profile Header */}
      <div className="bg-[#131313] rounded-2xl border border-zinc-800 overflow-hidden mb-8">
        {/* Cover Photo */}
        <div className="relative h-48 bg-gradient-to-r from-[#ff7b57] to-[#e96e4c]">
          {(coverPreview || coverImageUrl) && !isEditing ? (
            <img 
              src={coverPreview || coverImageUrl} 
              alt="Cover" 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-[#ff7b57]/20 to-purple-500/20 flex items-center justify-center">
              <FiCamera className="text-4xl text-zinc-500" />
            </div>
          )}
          
          {isOwnProfile && isEditing && (
            <button
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-4 right-4 bg-black/70 hover:bg-black/90 text-white px-4 py-2 rounded-full transition flex items-center gap-2"
            >
              <FiCamera size={16} />
              <span className="text-sm">Change Cover</span>
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverPhotoSelect}
            className="hidden"
          />
        </div>
        
        {/* Profile Info */}
        <div className="px-8 pb-8 relative">
          {/* Avatar */}
          <div className="relative -mt-16 mb-4">
            <div className="w-32 h-32 rounded-full border-4 border-[#131313] overflow-hidden bg-zinc-800">
              {(profilePreview || profileImageUrl) && !isEditing ? (
                <img 
                  src={profilePreview || profileImageUrl} 
                  alt={profile.full_name || profile.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#ff7b57] to-purple-600 flex items-center justify-center text-4xl font-bold text-white">
                  {profile.full_name?.charAt(0) || profile.username?.charAt(0)}
                </div>
              )}
            </div>
            
            {isOwnProfile && isEditing && (
              <button 
                onClick={() => profileInputRef.current?.click()}
                className="absolute bottom-2 right-2 bg-[#ff7b57] hover:bg-[#e96e4c] text-black p-2 rounded-full transition"
              >
                <FiCamera size={16} />
              </button>
            )}
            <input
              ref={profileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureSelect}
              className="hidden"
            />
            
            {isOwnProfile && !isEditing && (
              <button 
                onClick={() => setIsEditing(true)}
                className="absolute bottom-2 right-2 bg-[#ff7b57] p-2 rounded-full text-black hover:bg-[#e96e4c] transition"
              >
                <FiEdit2 size={16} />
              </button>
            )}
          </div>
          
          {/* User Info */}
          <div className="flex justify-between items-start flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {profile.full_name || profile.username}
              </h1>
              <p className="text-zinc-400">@{profile.username}</p>
              {profile.bio && !isEditing && (
                <p className="text-white mt-2 max-w-xl">{profile.bio}</p>
              )}
            </div>
            
            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                className={`font-semibold px-6 py-2 rounded-full transition flex items-center gap-2 ${
                  isFollowing 
                    ? 'bg-zinc-800 text-white hover:bg-zinc-700' 
                    : 'bg-[#ff7b57] text-black hover:bg-[#e96e4c]'
                }`}
              >
                {isFollowing ? <FiUserCheck size={18} /> : <FiUserPlus size={18} />}
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          
          {/* Stats */}
          <div className="flex gap-8 mt-6 pt-6 border-t border-zinc-800">
            <div>
              <span className="text-2xl font-bold text-white">{posts.length}</span>
              <span className="text-zinc-400 ml-2">posts</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-white">{followersCount}</span>
              <span className="text-zinc-400 ml-2">followers</span>
            </div>
            <div>
              <span className="text-2xl font-bold text-white">{followingCount}</span>
              <span className="text-zinc-400 ml-2">following</span>
            </div>
          </div>
          
          {/* Additional Info */}
          <div className="mt-4 space-y-2 text-zinc-400 text-sm">
            {profile.city && profile.country && (
              <div className="flex items-center gap-2">
                <FiMapPin size={14} />
                <span>{profile.city}, {profile.country}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FiCalendar size={14} />
              <span>Joined {new Date(profile.date_joined).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tabs for Posts/Saved */}
      <div className="mb-6">
        <div className="flex gap-2 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all duration-200 ${
              activeTab === 'posts'
                ? 'text-[#ff7b57] border-b-2 border-[#ff7b57]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FiGrid size={18} />
            Posts
          </button>
          
          {isOwnProfile && (
            <button
              onClick={() => setActiveTab('saved')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-semibold transition-all duration-200 ${
                activeTab === 'saved'
                  ? 'text-[#ff7b57] border-b-2 border-[#ff7b57]'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <FiBookmark size={18} />
              Saved
              {savedPosts.length > 0 && (
                <span className="ml-1 text-xs bg-zinc-800 px-2 py-0.5 rounded-full">
                  {savedPosts.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
      
      {/* Content Grid */}
      <div>
        {displayPosts.length === 0 ? (
          <div className="bg-[#131313] rounded-2xl border border-zinc-800 p-12 text-center">
            {activeTab === 'posts' ? (
              <>
                <p className="text-zinc-400">No posts yet</p>
                {isOwnProfile && (
                  <button
                    onClick={() => navigate('/dashboard/create')}
                    className="mt-4 bg-[#ff7b57] text-black px-6 py-2 rounded-full hover:bg-[#e96e4c] transition"
                  >
                    Create Your First Post
                  </button>
                )}
              </>
            ) : (
              <>
                <FiBookmark className="text-4xl text-zinc-600 mx-auto mb-3" />
                <p className="text-zinc-400">No saved posts yet</p>
                <p className="text-zinc-500 text-sm mt-2">Save posts you like to see them here!</p>
                <button
                  onClick={() => navigate('/dashboard/feed')}
                  className="mt-4 bg-[#ff7b57] text-black px-6 py-2 rounded-full hover:bg-[#e96e4c] transition"
                >
                  Explore Feed
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {displayPosts.map((post) => (
              <div 
                key={post.id} 
                className="bg-[#131313] rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:scale-105 transition-transform group relative"
              >
                {activeTab === 'saved' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUnsave(post.id);
                    }}
                    className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-red-500 rounded-full p-1.5 transition"
                    title="Remove from saved"
                  >
                    <FiBookmark size={14} className="text-green-500 fill-green-500 hover:text-white" />
                  </button>
                )}
                
                {post.mediaUrl && !post.isCarousel && (
                  post.type === 'video' ? (
                    <video 
                      src={post.mediaUrl} 
                      className="w-full aspect-square object-cover"
                    />
                  ) : (
                    <img 
                      src={post.mediaUrl} 
                      alt={post.caption || 'Post'} 
                      className="w-full aspect-square object-cover group-hover:opacity-90 transition"
                    />
                  )
                )}
                
                {/* Carousel posts */}
                {post.isCarousel && post.carouselImages && post.carouselImages.length > 0 && (
                  <div className="relative w-full aspect-square">
                    <img 
                      src={post.carouselImages[0].image} 
                      alt={post.caption || 'Post'} 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1">
                      <span className="text-white text-xs">📸 {post.carouselImages.length}</span>
                    </div>
                  </div>
                )}
                
                <div className="p-3">
                  {post.caption && (
                    <p className="text-white text-sm line-clamp-2 mb-2">{post.caption}</p>
                  )}
                  <div className="flex items-center gap-4 text-zinc-400 text-xs">
                    <span className="flex items-center gap-1">
                      <FiHeart size={12} className="text-red-500" /> {post.stats.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <FiMessageCircle size={12} className="text-blue-500" /> {post.stats.comments}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-[#131313] rounded-2xl p-8 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-white">Edit Profile</h2>
              <button
                onClick={cancelEdit}
                className="text-zinc-400 hover:text-white transition"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <form onSubmit={handleEditProfile}>
              <div className="mb-4">
                <label className="block text-white text-sm font-semibold mb-2">Full Name</label>
                <input
                  type="text"
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
                />
              </div>
              
              <div className="mb-4">
                <label className="block text-white text-sm font-semibold mb-2">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  rows="4"
                  maxLength="500"
                  className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none resize-none"
                  placeholder="Tell us about yourself..."
                />
                <div className="text-right text-xs text-zinc-500 mt-1">
                  {editForm.bio.length}/500
                </div>
              </div>
              
              <div className="mb-6">
                <label className="block text-white text-sm font-semibold mb-2">City</label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
                />
              </div>
              
              {/* Image Preview Section */}
              {(profilePreview || coverPreview) && (
                <div className="mb-6 p-4 bg-zinc-900/50 rounded-xl">
                  <p className="text-zinc-400 text-sm mb-3">New Images:</p>
                  {profilePreview && (
                    <div className="mb-3">
                      <p className="text-white text-xs mb-1">Profile Picture:</p>
                      <img src={profilePreview} alt="Profile preview" className="w-20 h-20 rounded-full object-cover" />
                    </div>
                  )}
                  {coverPreview && (
                    <div>
                      <p className="text-white text-xs mb-1">Cover Photo:</p>
                      <img src={coverPreview} alt="Cover preview" className="w-full h-24 object-cover rounded-lg" />
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 bg-[#ff7b57] text-black font-bold py-2 rounded-lg hover:bg-[#e96e4c] transition disabled:opacity-50"
                >
                  {uploading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="flex-1 bg-zinc-800 text-white font-bold py-2 rounded-lg hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;