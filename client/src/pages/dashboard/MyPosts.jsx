// pages/dashboard/MyPostsPage.jsx
import React, { useState, useEffect } from 'react';
import { FiHeart, FiMessageCircle, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getUserPosts, deletePost, formatPostData } from '../../services/posts';
import { getUser } from '../../services/auth';

const MyPostsPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const user = getUser();
    if (user) {
      fetchMyPosts(user.username);
    }
  }, []);

  const fetchMyPosts = async (username) => {
    try {
      setLoading(true);
      const data = await getUserPosts(username);
      const formattedPosts = (data.results || []).map(formatPostData);
      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching my posts:', error);
      toast.error('Failed to load your posts');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await deletePost(postId);
        setPosts(prev => prev.filter(post => post.id !== postId));
        toast.success('Post deleted successfully');
      } catch (error) {
        console.error('Error deleting post:', error);
        toast.error('Failed to delete post');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff7b57] border-t-transparent"></div>
          <p className="text-white mt-4">Loading your posts...</p>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-[#131313] rounded-2xl border border-zinc-800 p-12 text-center">
          <p className="text-zinc-400 mb-4">You haven't created any posts yet</p>
          <button
            onClick={() => window.location.href = '/dashboard/create'}
            className="bg-[#ff7b57] text-black px-6 py-2 rounded-full hover:bg-[#e96e4c] transition"
          >
            Create Your First Post
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-6">My Posts</h2>
      <div className="space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="bg-[#131313] rounded-2xl border border-zinc-800 overflow-hidden">
            <div className="p-4">
              <p className="text-white mb-3">{post.caption}</p>
              {post.mediaUrl && !post.isCarousel && (
                post.type === 'video' ? (
                  <video src={post.mediaUrl} className="rounded-xl w-full object-cover max-h-96" controls />
                ) : (
                  <img src={post.mediaUrl} alt={post.caption} className="rounded-xl w-full object-cover max-h-96" />
                )
              )}
            </div>
            <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <span className="flex items-center gap-1 text-zinc-400">
                  <FiHeart className="text-red-500" /> {post.stats.likes} likes
                </span>
                <span className="flex items-center gap-1 text-zinc-400">
                  <FiMessageCircle className="text-blue-500" /> {post.stats.comments} comments
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDeletePost(post.id)}
                  className="text-red-500 hover:text-red-400 transition p-1"
                >
                  <FiTrash2 size={18} />
                </button>
              </div>
            </div>
            <div className="px-4 py-2 bg-black/20 text-zinc-500 text-xs">
              Posted on {post.formattedDate} at {post.formattedTime}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyPostsPage;