// pages/dashboard/ProfilePage.jsx
import React, { useState, useEffect } from 'react';
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
  FiArrowLeft
} from 'react-icons/fi';
import { getUser, getAccessToken, isAuthenticated } from '../../services/auth';
import { formatPostData } from '../../services/posts';

const ProfilePage = () => {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
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
        
        // If no username in URL, use current user's username
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
        console.log('Profile data:', data);
        
        setProfile(data.user);
        setFollowersCount(data.user.followers_count || 0);
        setFollowingCount(data.user.following_count || 0);
        setIsFollowing(data.user.is_following || false);
        
        setEditForm({
          full_name: data.user.full_name || '',
          bio: data.user.bio || '',
          city: data.user.city || '',
        });
        
        // Fetch user's posts using the correct endpoint
        try {
          const postsResponse = await fetch(`http://localhost:8000/api/posts/?user=${profileUsername}`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          });
          
          if (postsResponse.ok) {
            const postsData = await postsResponse.json();
            console.log('Posts data received:', postsData);
            
            // Format posts using the formatPostData function
            const formattedPosts = (postsData.results || []).map(formatPostData);
            console.log('Formatted posts:', formattedPosts);
            setPosts(formattedPosts);
          } else {
            console.log('Posts API returned error:', postsResponse.status);
            setPosts([]);
          }
        } catch (postsError) {
          console.error('Error fetching posts:', postsError);
          setPosts([]);
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
  
  const handleEditProfile = async (e) => {
    e.preventDefault();
    
    try {
      const token = getAccessToken();
      const response = await fetch('http://localhost:8000/api/auth/profile/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      
      if (response.ok) {
        const data = await response.json();
        setProfile(data.user);
        setIsEditing(false);
        toast.success('Profile updated successfully');
        
        // Update stored user data
        const storedUser = getUser();
        if (storedUser && storedUser.username === data.user.username) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      } else {
        toast.error('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Something went wrong');
    }
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
        <div className="h-48 bg-gradient-to-r from-[#ff7b57] to-[#e96e4c]"></div>
        
        {/* Profile Info */}
        <div className="px-8 pb-8 relative">
          {/* Avatar */}
          <div className="relative -mt-16 mb-4">
            <div className="w-32 h-32 rounded-full bg-zinc-700 border-4 border-[#131313] overflow-hidden">
              {profile.profile_picture_url && profile.profile_picture_url !== '/static/default_profile.png' ? (
                <img 
                  src={profile.profile_picture_url} 
                  alt={profile.full_name || profile.username} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-r from-[#ff7b57] to-[#e96e4c] flex items-center justify-center text-4xl font-bold text-black">
                  {profile.full_name?.charAt(0) || profile.username?.charAt(0)}
                </div>
              )}
            </div>
            {isOwnProfile && (
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
              {profile.bio && (
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
      
      {/* Posts Grid */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4">Posts</h2>
        {posts.length === 0 ? (
          <div className="bg-[#131313] rounded-2xl border border-zinc-800 p-12 text-center">
            <p className="text-zinc-400">No posts yet</p>
            {isOwnProfile && (
              <button
                onClick={() => navigate('/dashboard/create')}
                className="mt-4 bg-[#ff7b57] text-black px-6 py-2 rounded-full hover:bg-[#e96e4c] transition"
              >
                Create Your First Post
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {posts.map((post) => (
              <div 
                key={post.id} 
                className="bg-[#131313] rounded-xl overflow-hidden border border-zinc-800 cursor-pointer hover:scale-105 transition-transform group"
              >
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
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#131313] rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-6">Edit Profile</h2>
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
                  className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
                  placeholder="Tell us about yourself..."
                />
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
              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-[#ff7b57] text-black font-bold py-2 rounded-lg hover:bg-[#e96e4c] transition"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
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