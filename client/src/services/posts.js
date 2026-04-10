// services/posts.js
// API service for posts functionality

const API_BASE_URL = 'http://localhost:8000/api';
const MEDIA_BASE_URL = 'http://localhost:8000'; // Django server base URL for media files

// Helper function to get full image URL
const getFullImageUrl = (path) => {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    if (path.startsWith('/media/')) return `${MEDIA_BASE_URL}${path}`;
    if (path.startsWith('media/')) return `${MEDIA_BASE_URL}/${path}`;
    return `${MEDIA_BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
};

// Helper function to get auth headers
const getAuthHeaders = (multipart = false) => {
    const token = localStorage.getItem('access_token');
    const headers = {
        'Authorization': `Bearer ${token}`,
    };
    
    if (!multipart) {
        headers['Content-Type'] = 'application/json';
    }
    
    return headers;
};

// Helper for handling API responses
const handleResponse = async (response) => {
    if (response.status === 401) {
        // Token expired, try to refresh
        const refreshed = await refreshToken();
        if (refreshed) {
            // Retry the original request
            const retryResponse = await fetch(response.url, {
                ...response,
                headers: getAuthHeaders(response.url.includes('form-data'))
            });
            return handleResponse(retryResponse);
        } else {
            // Redirect to login
            localStorage.clear();
            window.location.href = '/auth';
            throw new Error('Session expired. Please login again.');
        }
    }
    
    if (!response.ok) {
        let errorMessage;
        try {
            const error = await response.json();
            errorMessage = error.message || error.error || error.detail || 'API request failed';
        } catch {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
    }
    
    // Return empty object for 204 No Content responses
    if (response.status === 204) {
        return { success: true };
    }
    
    return response.json();
};

// Token refresh function
const refreshToken = async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh-token/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh })
        });
        
        if (response.ok) {
            const data = await response.json();
            localStorage.setItem('access_token', data.access);
            return true;
        }
    } catch (error) {
        console.error('Token refresh failed:', error);
    }
    return false;
};

// ============ POST CRUD OPERATIONS ============

// Create a new post
export const createPost = async (formData) => {
    const response = await fetch(`${API_BASE_URL}/posts/`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: formData
    });
    return handleResponse(response);
};

// Get feed posts (posts from followed users)
export const getFeed = async (page = 1, pageSize = 20) => {
    const response = await fetch(
        `${API_BASE_URL}/feed/?page=${page}&page_size=${pageSize}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
};

// Get explore posts (popular posts)
export const getExplore = async (page = 1, pageSize = 20) => {
    const response = await fetch(
        `${API_BASE_URL}/explore/?page=${page}&page_size=${pageSize}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
};

// Get posts by specific user - This uses the user query parameter
export const getUserPosts = async (username, page = 1, pageSize = 20) => {
    const response = await fetch(
        `${API_BASE_URL}/posts/?user=${username}&page=${page}&page_size=${pageSize}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
};

// Get a single post by ID
export const getPost = async (postId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Update a post
export const updatePost = async (postId, data) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

// Delete a post
export const deletePost = async (postId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (response.status === 204) return { success: true };
    return handleResponse(response);
};

// ============ INTERACTION ENDPOINTS ============

// Like/Unlike a post
export const toggleLike = async (postId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/like/`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Get users who liked a post
export const getPostLikes = async (postId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/likes/`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Add a comment to a post
export const addComment = async (postId, content, parentId = null) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comment/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content, parent: parentId })
    });
    return handleResponse(response);
};

// Get comments for a post
export const getComments = async (postId, page = 1, pageSize = 20) => {
    const response = await fetch(
        `${API_BASE_URL}/posts/${postId}/comments/?page=${page}&page_size=${pageSize}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
};

// Update a comment
export const updateComment = async (postId, commentId, content) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ content })
    });
    return handleResponse(response);
};

// Delete a comment
export const deleteComment = async (postId, commentId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (response.status === 204) return { success: true };
    return handleResponse(response);
};

// Like/Unlike a comment
export const toggleCommentLike = async (postId, commentId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/like/`, {
        method: 'POST',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Get replies to a comment
export const getCommentReplies = async (postId, commentId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/replies/`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// ============ SAVE/COLLECTION ENDPOINTS ============

// Save a post to a collection
export const savePost = async (postId, collectionId = null) => {
    const body = collectionId ? { collection_id: collectionId } : {};
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/save/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
    });
    return handleResponse(response);
};

// Unsave a post
export const unsavePost = async (postId) => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/unsave/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (response.status === 204) return { success: true };
    return handleResponse(response);
};

// Get all saved posts
export const getSavedPosts = async (page = 1, pageSize = 20) => {
    const response = await fetch(`${API_BASE_URL}/saved/?page=${page}&page_size=${pageSize}`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Create a new collection
export const createCollection = async (data) => {
    const response = await fetch(`${API_BASE_URL}/collections/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

// Get user's collections
export const getCollections = async () => {
    const response = await fetch(`${API_BASE_URL}/collections/`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Get a single collection
export const getCollection = async (collectionId) => {
    const response = await fetch(`${API_BASE_URL}/collections/${collectionId}/`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Get posts in a collection
export const getCollectionPosts = async (collectionId) => {
    const response = await fetch(`${API_BASE_URL}/collections/${collectionId}/posts/`, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Remove post from collection
export const removePostFromCollection = async (collectionId, postId) => {
    const response = await fetch(`${API_BASE_URL}/collections/${collectionId}/remove_post/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ post_id: postId })
    });
    if (response.status === 204) return { success: true };
    return handleResponse(response);
};

// Update collection
export const updateCollection = async (collectionId, data) => {
    const response = await fetch(`${API_BASE_URL}/collections/${collectionId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

// Delete collection
export const deleteCollection = async (collectionId) => {
    const response = await fetch(`${API_BASE_URL}/collections/${collectionId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
    });
    if (response.status === 204) return { success: true };
    return handleResponse(response);
};

// ============ REPORT ENDPOINTS ============

// Report a post
export const reportPost = async (postId, reason, description = '') => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/report/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason, description })
    });
    return handleResponse(response);
};

// Report a comment
export const reportComment = async (postId, commentId, reason, description = '') => {
    const response = await fetch(`${API_BASE_URL}/posts/${postId}/comments/${commentId}/report/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ reason, description })
    });
    return handleResponse(response);
};

// ============ POST TYPES AND OPTIONS ============

export const POST_TYPES = [
    { value: 'image', label: 'Image' },
    { value: 'video', label: 'Video' },
    { value: 'reel', label: 'Reel' },
    { value: 'carousel', label: 'Carousel' },
];

export const VISIBILITY_OPTIONS = [
    { value: 'public', label: 'Public' },
    { value: 'followers', label: 'Followers Only' },
    { value: 'private', label: 'Private' },
];

export const REPORT_REASONS = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'nudity', label: 'Nudity or sexual content' },
    { value: 'violence', label: 'Violence or harmful content' },
    { value: 'hate_speech', label: 'Hate speech' },
    { value: 'copyright', label: 'Copyright infringement' },
    { value: 'other', label: 'Other' },
];

// ============ HELPER FUNCTIONS ============

// Format post data for display with full image URLs
export const formatPostData = (post) => {
    return {
        id: post.id,
        user: {
            id: post.user.id,
            username: post.user.username,
            email: post.user.email,
            full_name: post.user.full_name,
            bio: post.user.bio,
            profile_picture: getFullImageUrl(post.user.profile_picture_url) || '/default-avatar.png',
            profile_picture_url: getFullImageUrl(post.user.profile_picture_url),
            cover_photo_url: getFullImageUrl(post.user.cover_photo_url),
            phone_number: post.user.phone_number,
            country: post.user.country,
            city: post.user.city,
            date_of_birth: post.user.date_of_birth,
            age: post.user.age,
            is_age_verified: post.user.is_age_verified,
            is_verified: post.user.is_verified,
            date_joined: post.user.date_joined
        },
        type: post.post_type,
        caption: post.caption,
        mediaUrl: getFullImageUrl(post.media_url),
        thumbnailUrl: getFullImageUrl(post.thumbnail_url),
        isCarousel: post.is_carousel,
        carouselImages: (post.carousel_images || []).map(img => ({
            ...img,
            image: getFullImageUrl(img.image)
        })),
        location: {
            name: post.location_name,
            country: post.location_country,
            city: post.location_city,
            lat: post.location_lat,
            lng: post.location_lng
        },
        stats: {
            likes: post.likes_count || 0,
            comments: post.comments_count || 0,
            shares: post.shares_count || 0,
            saves: post.saves_count || 0
        },
        interactions: {
            isLiked: post.is_liked || false,
            isSaved: post.is_saved || false,
            isFollowing: post.is_following || false
        },
        settings: {
            visibility: post.visibility,
            allowComments: post.allow_comments,
            allowSharing: post.allow_sharing
        },
        createdAt: new Date(post.created_at),
        updatedAt: new Date(post.updated_at),
        formattedDate: new Date(post.created_at).toLocaleDateString(),
        formattedTime: new Date(post.created_at).toLocaleTimeString()
    };
};

// Format comment data for display with full image URLs
export const formatCommentData = (comment) => {
    return {
        id: comment.id,
        user: {
            id: comment.user.id,
            username: comment.user.username,
            full_name: comment.user.full_name,
            profile_picture: getFullImageUrl(comment.user.profile_picture_url) || '/default-avatar.png',
            profile_picture_url: getFullImageUrl(comment.user.profile_picture_url)
        },
        content: comment.content,
        likesCount: comment.likes_count || 0,
        repliesCount: comment.replies_count || 0,
        isLiked: comment.is_liked || false,
        parentId: comment.parent,
        createdAt: new Date(comment.created_at),
        formattedDate: new Date(comment.created_at).toLocaleDateString()
    };
};

// Format collection data for display with full image URLs
export const formatCollectionData = (collection) => {
    return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        coverImage: getFullImageUrl(collection.cover_image_url),
        cover_image_url: getFullImageUrl(collection.cover_image_url),
        visibility: collection.visibility,
        postsCount: collection.posts_count || 0,
        createdAt: new Date(collection.created_at),
        updatedAt: new Date(collection.updated_at)
    };
};

// Export the image URL helper for use in components
export const getImageUrl = getFullImageUrl;

// ============ API CLASS FOR EASY USE ============

export class PostsAPI {
    constructor() {
        this.cache = new Map();
    }
    
    async loadFeed(page = 1, pageSize = 20) {
        try {
            const data = await getFeed(page, pageSize);
            return {
                posts: (data.results || []).map(formatPostData),
                next: data.next,
                previous: data.previous,
                total: data.count || 0,
                page: page,
                pageSize: pageSize
            };
        } catch (error) {
            console.error('Error loading feed:', error);
            throw error;
        }
    }
    
    async loadExplore(page = 1, pageSize = 20) {
        try {
            const data = await getExplore(page, pageSize);
            return {
                posts: (data.results || []).map(formatPostData),
                next: data.next,
                previous: data.previous,
                total: data.count || 0
            };
        } catch (error) {
            console.error('Error loading explore:', error);
            throw error;
        }
    }
    
    async loadUserPosts(username, page = 1, pageSize = 20) {
        try {
            const data = await getUserPosts(username, page, pageSize);
            return {
                posts: (data.results || []).map(formatPostData),
                total: data.count || 0
            };
        } catch (error) {
            console.error('Error loading user posts:', error);
            throw error;
        }
    }
    
    async likePost(postId) {
        try {
            return await toggleLike(postId);
        } catch (error) {
            console.error('Error toggling like:', error);
            throw error;
        }
    }
    
    async createNewPost(formData) {
        try {
            const post = await createPost(formData);
            return formatPostData(post);
        } catch (error) {
            console.error('Error creating post:', error);
            throw error;
        }
    }
    
    async addCommentToPost(postId, content, parentId = null) {
        try {
            const comment = await addComment(postId, content, parentId);
            return formatCommentData(comment);
        } catch (error) {
            console.error('Error adding comment:', error);
            throw error;
        }
    }
    
    async savePostToCollection(postId, collectionId = null) {
        try {
            return await savePost(postId, collectionId);
        } catch (error) {
            console.error('Error saving post:', error);
            throw error;
        }
    }
    
    async getUserCollections() {
        try {
            const data = await getCollections();
            return (data.results || []).map(formatCollectionData);
        } catch (error) {
            console.error('Error loading collections:', error);
            throw error;
        }
    }
}

// Create and export a singleton instance
export const postsAPI = new PostsAPI();

// Default export
export default {
    createPost,
    getFeed,
    getExplore,
    getUserPosts,
    getPost,
    updatePost,
    deletePost,
    toggleLike,
    getPostLikes,
    addComment,
    getComments,
    updateComment,
    deleteComment,
    toggleCommentLike,
    getCommentReplies,
    savePost,
    unsavePost,
    getSavedPosts,
    createCollection,
    getCollections,
    getCollection,
    getCollectionPosts,
    removePostFromCollection,
    updateCollection,
    deleteCollection,
    reportPost,
    reportComment,
    formatPostData,
    formatCommentData,
    formatCollectionData,
    getImageUrl,
    POST_TYPES,
    VISIBILITY_OPTIONS,
    REPORT_REASONS,
    PostsAPI,
    postsAPI
};