// components/modals/CommentsModal.jsx
import React, { useState, useEffect } from 'react';
import { FiHeart, FiSend, FiX, FiMessageCircle, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getComments, addComment, toggleCommentLike, deleteComment, getCommentReplies } from '../../services/posts';
import { getUser } from '../../services/auth';

const CommentsModal = ({ postId, post, onClose, onCommentCountUpdate }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState({});
  const [loadingReplies, setLoadingReplies] = useState({});
  const [repliesCache, setRepliesCache] = useState({});

  useEffect(() => {
    const user = getUser();
    setCurrentUser(user);
    loadComments();
  }, [postId]);

  const loadComments = async (pageNum = 1, append = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      
      const data = await getComments(postId, pageNum, 20);
      const formattedComments = (data.results || []).map(formatCommentData);
      
      if (append) {
        setComments(prev => [...prev, ...formattedComments]);
      } else {
        setComments(formattedComments);
      }
      
      setHasMore(!!data.next);
    } catch (error) {
      console.error('Error loading comments:', error);
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreComments = () => {
    if (hasMore && !loadingMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadComments(nextPage, true);
    }
  };

  const loadReplies = async (commentId) => {
    if (expandedReplies[commentId]) {
      // Collapse replies
      setExpandedReplies(prev => ({ ...prev, [commentId]: false }));
      return;
    }
    
    // Expand
    setExpandedReplies(prev => ({ ...prev, [commentId]: true }));
    
    // Load replies if not already cached
    if (!repliesCache[commentId]) {
      try {
        setLoadingReplies(prev => ({ ...prev, [commentId]: true }));
        // getCommentReplies returns an array directly (not wrapped in {results})
        const repliesData = await getCommentReplies(postId, commentId);
        const formattedReplies = (Array.isArray(repliesData) ? repliesData : []).map(formatCommentData);
        
        setRepliesCache(prev => ({ ...prev, [commentId]: formattedReplies }));
      } catch (error) {
        console.error('Error loading replies:', error);
        toast.error('Failed to load replies');
      } finally {
        setLoadingReplies(prev => ({ ...prev, [commentId]: false }));
      }
    }
  };

  const formatCommentData = (comment) => {
    return {
      id: comment.id,
      user: {
        id: comment.user.id,
        username: comment.user.username,
        full_name: comment.user.full_name,
        profile_picture: comment.user.profile_picture_url || `https://ui-avatars.com/api/?name=${comment.user.username}&background=ff7b57&color=fff`
      },
      content: comment.content,
      likesCount: comment.likes_count || 0,
      repliesCount: comment.replies_count || 0,
      isLiked: comment.is_liked || false,
      parentId: comment.parent,
      createdAt: new Date(comment.created_at),
      formattedDate: new Date(comment.created_at).toLocaleDateString(),
      formattedTime: new Date(comment.created_at).toLocaleTimeString()
    };
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    
    if (!newComment.trim()) {
      toast.error('Please enter a comment');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const comment = await addComment(postId, newComment, replyTo?.id);
      const formattedComment = formatCommentData(comment);
      
      if (replyTo) {
        // Add reply to cache
        setRepliesCache(prev => ({
          ...prev,
          [replyTo.id]: [formattedComment, ...(prev[replyTo.id] || [])]
        }));
        
        // Update replies count in comments list
        setComments(prev => prev.map(c => 
          c.id === replyTo.id 
            ? { ...c, repliesCount: (c.repliesCount || 0) + 1 }
            : c
        ));
        
        // Keep reply section expanded
        setExpandedReplies(prev => ({ ...prev, [replyTo.id]: true }));
        toast.success('Reply added!');
        setReplyTo(null);
      } else {
        // Add new comment to top of list
        setComments(prev => [formattedComment, ...prev]);
        // Update post comment count
        if (onCommentCountUpdate) {
          onCommentCountUpdate(postId, (post?.stats?.comments || 0) + 1);
        }
        toast.success('Comment added!');
      }
      
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLikeComment = async (commentId, isReply = false, parentId = null) => {
    try {
      const result = await toggleCommentLike(postId, commentId);
      
      if (isReply && parentId) {
        // Update reply in cache
        setRepliesCache(prev => ({
          ...prev,
          [parentId]: (prev[parentId] || []).map(reply =>
            reply.id === commentId
              ? {
                  ...reply,
                  likesCount: result.likes_count,
                  isLiked: result.status === 'liked'
                }
              : reply
          )
        }));
      } else {
        // Update top-level comment
        setComments(prev => prev.map(comment =>
          comment.id === commentId
            ? {
                ...comment,
                likesCount: result.likes_count,
                isLiked: result.status === 'liked'
              }
            : comment
        ));
      }
    } catch (error) {
      console.error('Error liking comment:', error);
      toast.error('Failed to like comment');
    }
  };

  const handleDeleteComment = async (commentId, isReply = false, parentId = null) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      await deleteComment(postId, commentId);
      
      if (isReply && parentId) {
        // Remove reply from cache
        setRepliesCache(prev => ({
          ...prev,
          [parentId]: (prev[parentId] || []).filter(reply => reply.id !== commentId)
        }));
        
        // Update replies count in comments list
        setComments(prev => prev.map(c => 
          c.id === parentId 
            ? { ...c, repliesCount: Math.max(0, (c.repliesCount || 0) - 1) }
            : c
        ));
      } else {
        // Remove top-level comment
        setComments(prev => prev.filter(comment => comment.id !== commentId));
        // Update post comment count
        if (onCommentCountUpdate) {
          onCommentCountUpdate(postId, Math.max(0, (post?.stats?.comments || 0) - 1));
        }
      }
      
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const handleReply = (comment) => {
    setReplyTo(comment);
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) textarea.focus();
    }, 100);
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  const getImageUrl = (url) => {
    if (!url) return null;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/media/')) {
      return `http://localhost:8000${url}`;
    }
    return url;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#131313] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h3 className="text-white font-semibold text-lg">
            Comments ({post?.stats?.comments || 0})
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-zinc-800"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Original Post Preview */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-start gap-3">
            <img
              src={getImageUrl(post?.user?.profile_picture_url) || `https://ui-avatars.com/api/?name=${post?.user?.username || 'User'}&background=ff7b57&color=fff`}
              alt={post?.user?.username}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm">
                  {post?.user?.full_name || post?.user?.username}
                </p>
                <p className="text-zinc-500 text-xs">@{post?.user?.username}</p>
              </div>
              <p className="text-zinc-300 text-sm mt-1 line-clamp-2">{post?.caption}</p>
            </div>
          </div>
        </div>

        {/* Reply Indicator */}
        {replyTo && (
          <div className="px-4 py-2 bg-[#ff7b57]/10 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiMessageCircle className="text-[#ff7b57] text-sm" />
              <span className="text-zinc-300 text-sm">
                Replying to <span className="text-[#ff7b57]">@{replyTo.user.username}</span>
              </span>
            </div>
            <button
              onClick={cancelReply}
              className="text-zinc-400 hover:text-white"
            >
              <FiX size={16} />
            </button>
          </div>
        )}

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-[#ff7b57] border-t-transparent"></div>
            </div>
          ) : comments.length === 0 ? (
            <div className="text-center py-8">
              <FiMessageCircle className="text-zinc-600 text-4xl mx-auto mb-3" />
              <p className="text-zinc-500">No comments yet</p>
              <p className="text-zinc-600 text-sm">Be the first to comment!</p>
            </div>
          ) : (
            <>
              {comments.map((comment) => (
                <div key={comment.id} className="group">
                  {/* Main Comment */}
                  <div className="flex items-start gap-3">
                    <img
                      src={getImageUrl(comment.user.profile_picture)}
                      alt={comment.user.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                    <div className="flex-1">
                      <div className="bg-zinc-800/50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-semibold text-sm">
                            {comment.user.full_name || comment.user.username}
                          </p>
                          <p className="text-zinc-500 text-xs">@{comment.user.username}</p>
                          <span className="text-zinc-600 text-xs">•</span>
                          <p className="text-zinc-600 text-xs">{comment.formattedDate}</p>
                        </div>
                        <p className="text-zinc-300 text-sm">{comment.content}</p>
                      </div>
                      
                      {/* Comment Actions */}
                      <div className="flex items-center gap-4 mt-1 ml-2">
                        <button
                          onClick={() => handleLikeComment(comment.id)}
                          className={`flex items-center gap-1 text-xs transition ${
                            comment.isLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'
                          }`}
                        >
                          <FiHeart className={`text-sm ${comment.isLiked ? 'fill-red-500' : ''}`} />
                          <span>{comment.likesCount > 0 ? comment.likesCount : 'Like'}</span>
                        </button>
                        
                        <button
                          onClick={() => handleReply(comment)}
                          className="text-xs text-zinc-500 hover:text-blue-500 transition"
                        >
                          Reply
                        </button>
                        
                        {comment.repliesCount > 0 && (
                          <button
                            onClick={() => loadReplies(comment.id)}
                            className="text-xs text-zinc-500 hover:text-[#ff7b57] transition flex items-center gap-1"
                          >
                            {expandedReplies[comment.id] ? (
                              <>
                                <FiChevronUp size={12} />
                                Hide replies ({comment.repliesCount})
                              </>
                            ) : (
                              <>
                                <FiChevronDown size={12} />
                                View replies ({comment.repliesCount})
                              </>
                            )}
                          </button>
                        )}
                        
                        {currentUser?.id === comment.user.id && (
                          <button
                            onClick={() => handleDeleteComment(comment.id)}
                            className="text-xs text-red-500 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                      
                      {/* Replies Section */}
                      {expandedReplies[comment.id] && (
                        <div className="mt-3 ml-6 pl-3 border-l-2 border-zinc-700 space-y-3">
                          {loadingReplies[comment.id] ? (
                            <div className="flex justify-center py-2">
                              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-[#ff7b57] border-t-transparent"></div>
                            </div>
                          ) : (
                            (repliesCache[comment.id] || []).map((reply) => (
                              <div key={reply.id} className="group/reply">
                                <div className="flex items-start gap-2">
                                  <img
                                    src={getImageUrl(reply.user.profile_picture)}
                                    alt={reply.user.username}
                                    className="w-6 h-6 rounded-full object-cover"
                                  />
                                  <div className="flex-1">
                                    <div className="bg-zinc-800/30 rounded-lg p-2">
                                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                                        <p className="text-white font-semibold text-xs">
                                          {reply.user.full_name || reply.user.username}
                                        </p>
                                        <p className="text-zinc-500 text-xs">@{reply.user.username}</p>
                                        <span className="text-zinc-600 text-xs">•</span>
                                        <p className="text-zinc-600 text-xs">{reply.formattedDate}</p>
                                      </div>
                                      <p className="text-zinc-300 text-xs">{reply.content}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mt-1 ml-1">
                                      <button
                                        onClick={() => handleLikeComment(reply.id, true, comment.id)}
                                        className={`flex items-center gap-1 text-xs transition ${
                                          reply.isLiked ? 'text-red-500' : 'text-zinc-500 hover:text-red-500'
                                        }`}
                                      >
                                        <FiHeart className={`text-xs ${reply.isLiked ? 'fill-red-500' : ''}`} />
                                        <span>{reply.likesCount > 0 ? reply.likesCount : 'Like'}</span>
                                      </button>
                                      
                                      <button
                                        onClick={() => handleReply(reply)}
                                        className="text-xs text-zinc-500 hover:text-blue-500 transition"
                                      >
                                        Reply
                                      </button>
                                      
                                      {currentUser?.id === reply.user.id && (
                                        <button
                                          onClick={() => handleDeleteComment(reply.id, true, comment.id)}
                                          className="text-xs text-red-500 hover:text-red-400 transition opacity-0 group-hover/reply:opacity-100"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Load More Comments Button */}
              {hasMore && (
                <div className="flex justify-center pt-2">
                  <button
                    onClick={loadMoreComments}
                    disabled={loadingMore}
                    className="text-zinc-500 hover:text-[#ff7b57] text-sm transition disabled:opacity-50"
                  >
                    {loadingMore ? 'Loading...' : 'Load more comments'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Add Comment Input */}
        <div className="p-4 border-t border-zinc-800">
          <form onSubmit={handleAddComment} className="flex items-center gap-3">
            <img
              src={getImageUrl(currentUser?.profile_picture_url) || `https://ui-avatars.com/api/?name=${currentUser?.username || 'User'}&background=ff7b57&color=fff`}
              alt={currentUser?.username}
              className="w-8 h-8 rounded-full object-cover"
            />
            <div className="flex-1 relative">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={replyTo ? `Reply to @${replyTo.user.username}...` : "Add a comment..."}
                className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-xl px-4 py-2 focus:border-[#ff7b57] focus:outline-none resize-none"
                rows="2"
                maxLength="500"
              />
              <div className="absolute bottom-2 right-2 text-xs text-zinc-500">
                {newComment.length}/500
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting || !newComment.trim()}
              className="bg-[#ff7b57] hover:bg-[#e96e4c] text-black font-semibold px-4 py-2 rounded-full transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div> : <FiSend size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CommentsModal;