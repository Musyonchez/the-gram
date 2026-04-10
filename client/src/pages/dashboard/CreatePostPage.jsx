// pages/dashboard/CreatePostPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiImage, FiSend, FiVideo, FiGrid, FiEye, FiLock, FiUsers, FiMapPin } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { createPost, POST_TYPES, VISIBILITY_OPTIONS } from '../../services/posts';

const CreatePostPage = () => {
  const navigate = useNavigate();
  const [creatingPost, setCreatingPost] = useState(false);
  const [postData, setPostData] = useState({
    post_type: 'image',
    caption: '',
    media_file: null,
    carousel_images: [],
    visibility: 'public',
    allow_comments: true,
    allow_sharing: true,
    location_name: '',
    location_country: '',
    location_city: '',
  });
  
  const [previewUrl, setPreviewUrl] = useState(null);
  const [carouselPreviews, setCarouselPreviews] = useState([]);
  const [errors, setErrors] = useState({});

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setPostData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleMediaChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file size (max 100MB)
      if (file.size > 100 * 1024 * 1024) {
        toast.error('File size cannot exceed 100MB');
        return;
      }
      
      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/quicktime'];
      if (!validTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload an image or video.');
        return;
      }
      
      setPostData(prev => ({ ...prev, media_file: file }));
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleCarouselChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length < 2) {
      toast.error('Carousel posts require at least 2 images');
      return;
    }
    if (files.length > 10) {
      toast.error('Carousel posts cannot have more than 10 images');
      return;
    }
    
    setPostData(prev => ({ ...prev, carousel_images: files }));
    
    // Create preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setCarouselPreviews(previews);
  };

  const removeCarouselImage = (index) => {
    const newImages = [...postData.carousel_images];
    const newPreviews = [...carouselPreviews];
    
    // Revoke object URL to avoid memory leaks
    URL.revokeObjectURL(carouselPreviews[index]);
    
    newImages.splice(index, 1);
    newPreviews.splice(index, 1);
    
    setPostData(prev => ({ ...prev, carousel_images: newImages }));
    setCarouselPreviews(newPreviews);
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!postData.caption.trim()) {
      newErrors.caption = 'Please enter a caption';
    }
    
    if (postData.post_type === 'carousel') {
      if (postData.carousel_images.length < 2) {
        newErrors.carousel_images = 'Carousel posts require at least 2 images';
      }
    } else if (!postData.media_file) {
      newErrors.media_file = `Please select a ${postData.post_type} file`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }
    
    setCreatingPost(true);
    
    try {
      const formData = new FormData();
      
      // Add basic fields
      formData.append('post_type', postData.post_type);
      formData.append('caption', postData.caption);
      formData.append('visibility', postData.visibility);
      formData.append('allow_comments', postData.allow_comments);
      formData.append('allow_sharing', postData.allow_sharing);
      
      // Add location if provided
      if (postData.location_name) formData.append('location_name', postData.location_name);
      if (postData.location_country) formData.append('location_country', postData.location_country);
      if (postData.location_city) formData.append('location_city', postData.location_city);
      
      // Add media based on post type
      if (postData.post_type === 'carousel') {
        postData.carousel_images.forEach((image) => {
          formData.append('carousel_images', image);
        });
      } else if (postData.media_file) {
        formData.append('media_file', postData.media_file);
      }
      
      await createPost(formData);
      
      toast.success('Post created successfully! 🎉');
      
      // Clean up object URLs to avoid memory leaks
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      carouselPreviews.forEach(url => URL.revokeObjectURL(url));
      
      // Navigate to my-posts page
      navigate('/dashboard/my-posts');
      
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Failed to create post');
      
      // Handle specific error responses
      if (error.data) {
        if (error.data.carousel_images) {
          setErrors(prev => ({ ...prev, carousel_images: error.data.carousel_images[0] }));
        }
        if (error.data.media_file) {
          setErrors(prev => ({ ...prev, media_file: error.data.media_file[0] }));
        }
      }
    } finally {
      setCreatingPost(false);
    }
  };

  // Clean up object URLs on component unmount
  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      carouselPreviews.forEach(url => URL.revokeObjectURL(url));
    };
  }, [previewUrl, carouselPreviews]);

  const getPostTypeIcon = () => {
    switch (postData.post_type) {
      case 'video': return <FiVideo className="text-xl" />;
      case 'reel': return <FiVideo className="text-xl" />;
      case 'carousel': return <FiGrid className="text-xl" />;
      default: return <FiImage className="text-xl" />;
    }
  };



  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h2 className="text-2xl font-bold text-white mb-6">Create a Post</h2>
      
      <div className="bg-[#131313] rounded-2xl border border-zinc-800 p-6">
        <form onSubmit={handleCreatePost}>
          {/* Post Type Selection */}
          <div className="mb-6">
            <label className="block text-white text-sm font-semibold mb-2">Post Type</label>
            <div className="flex gap-3">
              {POST_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setPostData(prev => ({ ...prev, post_type: type.value, media_file: null, carousel_images: [] }));
                    setPreviewUrl(null);
                    setCarouselPreviews([]);
                  }}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    postData.post_type === type.value
                      ? 'bg-[#ff7b57] text-black'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  {type.value === 'image' && <FiImage />}
                  {type.value === 'video' && <FiVideo />}
                  {type.value === 'reel' && <FiVideo />}
                  {type.value === 'carousel' && <FiGrid />}
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Caption */}
          <div className="mb-6">
            <label className="block text-white text-sm font-semibold mb-2">Caption</label>
            <textarea
              name="caption"
              value={postData.caption}
              onChange={handleInputChange}
              placeholder="What's on your mind? Share your art, fashion, or culture..."
              className={`w-full bg-black/40 text-white border ${
                errors.caption ? 'border-red-500' : 'border-zinc-800'
              } rounded-xl px-4 py-3 focus:border-[#ff7b57] focus:outline-none resize-none`}
              rows="5"
            />
            {errors.caption && <p className="text-red-500 text-xs mt-1">{errors.caption}</p>}
            <p className="text-zinc-500 text-xs mt-1">{postData.caption.length}/2200 characters</p>
          </div>
          
          {/* Media Upload */}
          {postData.post_type !== 'carousel' ? (
            <div className="mb-6">
              <label className="block text-white text-sm font-semibold mb-2">
                {postData.post_type === 'video' ? 'Video' : 'Image'}
              </label>
              <div className={`border-2 border-dashed ${
                errors.media_file ? 'border-red-500' : 'border-zinc-700'
              } rounded-xl p-6 text-center hover:border-[#ff7b57] transition cursor-pointer`}>
                <input
                  type="file"
                  accept={postData.post_type === 'video' ? 'video/*' : 'image/*'}
                  onChange={handleMediaChange}
                  className="hidden"
                  id="media-file"
                />
                <label htmlFor="media-file" className="cursor-pointer block">
                  {previewUrl ? (
                    <div className="relative">
                      {postData.post_type === 'video' ? (
                        <video src={previewUrl} className="max-h-96 mx-auto rounded-lg" controls />
                      ) : (
                        <img src={previewUrl} alt="Preview" className="max-h-96 mx-auto rounded-lg" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setPreviewUrl(null);
                          setPostData(prev => ({ ...prev, media_file: null }));
                        }}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8">
                      {getPostTypeIcon()}
                      <p className="text-zinc-400">Click to upload {postData.post_type}</p>
                      <p className="text-zinc-500 text-xs">Max size: 100MB</p>
                    </div>
                  )}
                </label>
              </div>
              {errors.media_file && <p className="text-red-500 text-xs mt-1">{errors.media_file}</p>}
            </div>
          ) : (
            <div className="mb-6">
              <label className="block text-white text-sm font-semibold mb-2">Carousel Images (2-10 images)</label>
              <div className={`border-2 border-dashed ${
                errors.carousel_images ? 'border-red-500' : 'border-zinc-700'
              } rounded-xl p-6 text-center hover:border-[#ff7b57] transition`}>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleCarouselChange}
                  className="hidden"
                  id="carousel-images"
                />
                <label htmlFor="carousel-images" className="cursor-pointer block">
                  {carouselPreviews.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {carouselPreviews.map((url, index) => (
                        <div key={index} className="relative">
                          <img src={url} alt={`Carousel ${index + 1}`} className="w-full aspect-square object-cover rounded-lg" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              removeCarouselImage(index);
                            }}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <FiGrid className="text-4xl text-zinc-500" />
                      <p className="text-zinc-400">Click to upload carousel images</p>
                      <p className="text-zinc-500 text-xs">2-10 images, JPG/PNG/GIF</p>
                    </div>
                  )}
                </label>
              </div>
              {errors.carousel_images && <p className="text-red-500 text-xs mt-1">{errors.carousel_images}</p>}
              {carouselPreviews.length > 0 && (
                <p className="text-green-500 text-xs mt-1">{carouselPreviews.length} images selected</p>
              )}
            </div>
          )}
          
          {/* Visibility Settings */}
          <div className="mb-6">
            <label className="block text-white text-sm font-semibold mb-2">Visibility</label>
            <div className="flex gap-3">
              {VISIBILITY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostData(prev => ({ ...prev, visibility: option.value }))}
                  className={`px-4 py-2 rounded-lg transition flex items-center gap-2 ${
                    postData.visibility === option.value
                      ? 'bg-[#ff7b57] text-black'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700'
                  }`}
                >
                  {option.value === 'public' && <FiEye />}
                  {option.value === 'followers' && <FiUsers />}
                  {option.value === 'private' && <FiLock />}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Comment & Sharing Settings */}
          <div className="mb-6 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="allow_comments"
                checked={postData.allow_comments}
                onChange={handleInputChange}
                className="w-4 h-4 accent-[#ff7b57]"
              />
              <span className="text-white text-sm">Allow comments on this post</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="allow_sharing"
                checked={postData.allow_sharing}
                onChange={handleInputChange}
                className="w-4 h-4 accent-[#ff7b57]"
              />
              <span className="text-white text-sm">Allow sharing of this post</span>
            </label>
          </div>
          
          {/* Location (Optional) */}
          <div className="mb-6">
            <label className="flex items-center gap-2 text-white text-sm font-semibold mb-2">
              <FiMapPin /> Location (Optional)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="location_name"
                value={postData.location_name}
                onChange={handleInputChange}
                placeholder="Location name"
                className="bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
              />
              <input
                type="text"
                name="location_city"
                value={postData.location_city}
                onChange={handleInputChange}
                placeholder="City"
                className="bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
              />
              <input
                type="text"
                name="location_country"
                value={postData.location_country}
                onChange={handleInputChange}
                placeholder="Country"
                className="bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none col-span-2"
              />
            </div>
          </div>
          
          {/* Submit Button */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={creatingPost}
              className="flex-1 bg-[#ff7b57] hover:bg-[#e96e4c] text-black font-bold py-3 rounded-full transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <FiSend />
              {creatingPost ? 'Creating Post...' : 'Create Post'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/dashboard/my-posts')}
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-full transition"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePostPage;