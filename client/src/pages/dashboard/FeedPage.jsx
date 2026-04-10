// pages/dashboard/FeedPage.jsx
import React, { useState, useEffect } from 'react';
import { FiHeart, FiMessageCircle, FiDollarSign, FiBookmark, FiShare2, FiUserPlus, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getFeed, toggleLike, savePost, formatPostData } from '../../services/posts';
import { getSuggestions, followUser } from '../../services/auth';
import CommentsModal from '../../components/modals/CommentsModal';
import DonateModal from '../../components/modals/DonateModal';

const FeedPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [followingSuggestions, setFollowingSuggestions] = useState(new Set());
  
  // Comment modal state
  const [selectedPost, setSelectedPost] = useState(null);
  const [showComments, setShowComments] = useState(false);
  
  // Donate modal state
  const [donatePost, setDonatePost] = useState(null);
  const [showDonate, setShowDonate] = useState(false);

  useEffect(() => {
    loadFeed();
    loadSuggestions();
  }, [page]);

  const loadFeed = async () => {
    try {
      setLoading(true);
      const data = await getFeed(page, 20);
      
      const formattedPosts = (data.results || []).map(formatPostData);
      
      if (page === 1) {
        setPosts(formattedPosts);
      } else {
        setPosts(prev => [...prev, ...formattedPosts]);
      }
      
      setHasMore(!!data.next);
    } catch (error) {
      console.error('Error loading feed:', error);
      toast.error('Failed to load feed');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const data = await getSuggestions();
      setSuggestions(data.suggestions || []);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const handleFollowSuggestion = async (userId) => {
    try {
      await followUser(userId);
      setFollowingSuggestions(prev => new Set([...prev, userId]));
      toast.success('Started following!');
      setSuggestions(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      console.error('Error following user:', error);
      toast.error('Failed to follow user');
    }
  };

  const handleDismissSuggestion = (userId) => {
    setSuggestions(prev => prev.filter(user => user.id !== userId));
  };

  const handleLike = async (postId) => {
    try {
      const result = await toggleLike(postId);
      
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              stats: { ...post.stats, likes: result.likes_count },
              interactions: { ...post.interactions, isLiked: result.status === 'liked' }
            }
          : post
      ));
      
      toast.success(result.status === 'liked' ? 'Post liked!' : 'Post unliked');
    } catch (error) {
      console.error('Error toggling like:', error);
      toast.error('Failed to like/unlike post');
    }
  };

  const handleSave = async (postId) => {
    try {
      await savePost(postId);
      
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { 
              ...post, 
              stats: { ...post.stats, saves: post.stats.saves + 1 },
              interactions: { ...post.interactions, isSaved: true }
            }
          : post
      ));
      
      toast.success('Post saved to your collection!');
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Failed to save post');
    }
  };

  const handleOpenComments = (post) => {
    setSelectedPost(post);
    setShowComments(true);
  };

  const handleOpenDonate = (post) => {
    setDonatePost(post);
    setShowDonate(true);
  };

  const handleCommentCountUpdate = (postId, newCount) => {
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? { ...post, stats: { ...post.stats, comments: newCount } }
        : post
    ));
  };

  const handleDonationSuccess = (result) => {
    console.log('Donation successful:', result);
    // Optionally update the post's donation stats in the feed
    if (result.post_id) {
      setPosts(prev => prev.map(post =>
        post.id === result.post_id
          ? { 
              ...post, 
              stats: { 
                ...post.stats, 
                donations: (post.stats.donations || 0) + 1 
              }
            }
          : post
      ));
    }
    toast.success('Thank you for your support! 🎉');
  };

  if (loading && page === 1) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff7b57] border-t-transparent"></div>
          <p className="text-white mt-4">Loading feed...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Suggestions Card */}
      {suggestions.length > 0 && !suggestionsLoading && (
        <div className="bg-gradient-to-r from-[#1a1a1a] to-[#0d0d0d] rounded-2xl border border-zinc-800 p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#ff7b57]/20 flex items-center justify-center">
                <FiUserPlus className="text-[#ff7b57] text-sm" />
              </div>
              <h3 className="text-white font-semibold">Suggested for you</h3>
            </div>
            <button 
              onClick={() => setSuggestions([])}
              className="text-zinc-500 hover:text-white text-xs transition"
            >
              Dismiss all
            </button>
          </div>
          
          <div className="space-y-3">
            {suggestions.slice(0, 5).map((user) => (
              <div 
                key={user.id} 
                className="flex items-center justify-between p-2 hover:bg-white/5 rounded-xl transition-all duration-200 group"
              >
                <div className="flex items-center gap-3">
                  <img 
                    src={user.profile_picture_url || `https://ui-avatars.com/api/?name=${user.username}&background=ff7b57&color=fff&size=40`}
                    alt={user.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="text-white font-medium text-sm">{user.full_name || user.username}</p>
                    <p className="text-zinc-500 text-xs">@{user.username}</p>
                    {user.bio && (
                      <p className="text-zinc-600 text-xs mt-0.5 line-clamp-1 max-w-[150px]">{user.bio}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFollowSuggestion(user.id)}
                    disabled={followingSuggestions.has(user.id)}
                    className="bg-[#ff7b57] hover:bg-[#e96e4c] text-black text-xs font-semibold px-4 py-1.5 rounded-full transition disabled:opacity-50"
                  >
                    Follow
                  </button>
                  <button
                    onClick={() => handleDismissSuggestion(user.id)}
                    className="text-zinc-600 hover:text-zinc-400 transition p-1"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {suggestions.length > 5 && (
            <button 
              onClick={() => setSuggestions([])}
              className="w-full mt-3 text-center text-zinc-500 hover:text-[#ff7b57] text-xs transition pt-2 border-t border-zinc-800"
            >
              See more suggestions
            </button>
          )}
        </div>
      )}

      {/* Feed Posts */}
      {posts.length === 0 && !loading ? (
        <div className="bg-[#131313] rounded-2xl border border-zinc-800 p-12 text-center">
          <p className="text-zinc-400 mb-4">No posts in your feed yet</p>
          <p className="text-zinc-500 text-sm">Follow some users to see their posts here!</p>
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="bg-[#131313] rounded-2xl border border-zinc-800 overflow-hidden hover:border-zinc-700 transition-all duration-200">
            {/* Post Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img 
                  src={post.user.profile_picture_url || `https://ui-avatars.com/api/?name=${post.user.username}&background=ff7b57&color=fff`}
                  alt={post.user.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <p className="text-white font-semibold">{post.user.full_name || post.user.username}</p>
                  <p className="text-zinc-500 text-xs">@{post.user.username}</p>
                </div>
              </div>
              <button className="text-zinc-500 hover:text-white transition">
                <span className="text-xl">⋯</span>
              </button>
            </div>
            
            {/* Post Content */}
            <div className="px-4 pb-4">
              <p className="text-white mb-3">{post.caption}</p>
              {post.mediaUrl && !post.isCarousel && (
                post.type === 'video' ? (
                  <video 
                    src={post.mediaUrl} 
                    className="rounded-xl w-full object-cover max-h-96"
                    controls
                  />
                ) : (
                  <img 
                    src={post.mediaUrl} 
                    alt={post.caption || 'Post'} 
                    className="rounded-xl w-full object-cover max-h-96"
                  />
                )
              )}
              
              {/* Carousel Images */}
              {post.isCarousel && post.carouselImages && post.carouselImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {post.carouselImages.slice(0, 4).map((img, idx) => (
                    <img 
                      key={idx}
                      src={img.image} 
                      alt={`Carousel ${idx + 1}`}
                      className="rounded-lg w-full aspect-square object-cover"
                    />
                  ))}
                  {post.carouselImages.length > 4 && (
                    <div className="relative aspect-square rounded-lg bg-black/50 flex items-center justify-center">
                      <span className="text-white font-bold">+{post.carouselImages.length - 4}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Post Stats */}
            <div className="px-4 py-2 border-t border-zinc-800">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-zinc-400">❤️ {post.stats.likes} likes</span>
                <span className="text-zinc-400">💬 {post.stats.comments} comments</span>
                <span className="text-zinc-400">📌 {post.stats.saves} saves</span>
              </div>
            </div>
            
            {/* Post Actions */}
            <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-around">
              <button 
                onClick={() => handleLike(post.id)}
                className={`flex items-center gap-2 transition-all duration-200 group ${
                  post.interactions.isLiked ? 'text-red-500' : 'text-zinc-400 hover:text-red-500'
                }`}
              >
                <FiHeart className={`text-xl group-hover:scale-110 transition-transform ${post.interactions.isLiked ? 'fill-red-500' : ''}`} />
                <span className="text-sm">Like</span>
              </button>
              
              <button 
                onClick={() => handleOpenComments(post)}
                className="flex items-center gap-2 text-zinc-400 hover:text-blue-500 transition-all duration-200 group"
              >
                <FiMessageCircle className="text-xl group-hover:scale-110 transition-transform" />
                <span className="text-sm">Comment</span>
              </button>
              
              <button 
                onClick={() => handleSave(post.id)}
                className={`flex items-center gap-2 transition-all duration-200 group ${
                  post.interactions.isSaved ? 'text-green-500' : 'text-zinc-400 hover:text-green-500'
                }`}
              >
                <FiBookmark className={`text-xl group-hover:scale-110 transition-transform ${post.interactions.isSaved ? 'fill-green-500' : ''}`} />
                <span className="text-sm">Save</span>
              </button>
              
              <button 
                onClick={() => handleOpenDonate(post)}
                className="flex items-center gap-2 text-zinc-400 hover:text-green-500 transition-all duration-200 group"
              >
                <FiDollarSign className="text-xl group-hover:scale-110 transition-transform" />
                <span className="text-sm">Donate</span>
              </button>
              
              <button className="flex items-center gap-2 text-zinc-400 hover:text-purple-500 transition-all duration-200 group">
                <FiShare2 className="text-xl group-hover:scale-110 transition-transform" />
                <span className="text-sm">Share</span>
              </button>
            </div>
          </div>
        ))
      )}
      
      {/* Load More Button */}
      {hasMore && posts.length > 0 && (
        <div className="flex justify-center pt-4">
          <button 
            onClick={() => setPage(p => p + 1)}
            disabled={loading}
            className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-full transition disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* Comments Modal */}
      {showComments && selectedPost && (
        <CommentsModal
          postId={selectedPost.id}
          post={selectedPost}
          onClose={() => {
            setShowComments(false);
            setSelectedPost(null);
          }}
          onCommentCountUpdate={handleCommentCountUpdate}
        />
      )}

      {/* Donate Modal */}
      {showDonate && donatePost && (
        <DonateModal
          post={donatePost}
          onClose={() => {
            setShowDonate(false);
            setDonatePost(null);
          }}
          onSuccess={handleDonationSuccess}
        />
      )}
    </div>
  );
};

export default FeedPage;