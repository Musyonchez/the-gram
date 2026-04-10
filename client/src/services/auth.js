// services/auth.js
const API_BASE_URL = 'http://localhost:8000/api/auth';

// Helper function to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();
  
  if (!response.ok) {
    // Throw error with message from server or default message
    const error = new Error(data.message || data.errors || data.error || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  
  return data;
};

// Store tokens in localStorage
const storeTokens = (accessToken, refreshToken) => {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
};

// Store user data
const storeUser = (userData) => {
  localStorage.setItem('user', JSON.stringify(userData));
};

// Clear all auth data
const clearAuthData = () => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

// Get stored tokens
export const getAccessToken = () => localStorage.getItem('access_token');
export const getRefreshToken = () => localStorage.getItem('refresh_token');
export const getUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = getAccessToken();
  return !!token && !isTokenExpired(token);
};

// Check if token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expirationTime = payload.exp * 1000;
    return Date.now() >= expirationTime;
  } catch (error) {
    return true;
  }
};

// Refresh the access token
export const refreshAccessToken = async () => {
  const refreshToken = getRefreshToken();
  
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/refresh-token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    
    const data = await handleResponse(response);
    
    if (data.access) {
      localStorage.setItem('access_token', data.access);
      return data.access;
    }
    
    throw new Error('Failed to refresh token');
  } catch (error) {
    clearAuthData();
    throw error;
  }
};

// API request wrapper with automatic token refresh
export const apiRequest = async (endpoint, options = {}) => {
  const accessToken = getAccessToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  
  const makeRequest = async () => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    if (response.status === 401 && getRefreshToken()) {
      try {
        const newAccessToken = await refreshAccessToken();
        headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
          ...options,
          headers,
        });
        
        return handleResponse(retryResponse);
      } catch (refreshError) {
        clearAuthData();
        window.location.href = '/auth';
        throw refreshError;
      }
    }
    
    return handleResponse(response);
  };
  
  return makeRequest();
};

// Register a new user
export const register = async (userData) => {
  const response = await fetch(`${API_BASE_URL}/register/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  
  const data = await handleResponse(response);
  
  if (data.access_token && data.refresh_token) {
    storeTokens(data.access_token, data.refresh_token);
    storeUser(data.user);
  }
  
  return data;
};

// Login user
export const login = async (credentials) => {
  const response = await fetch(`${API_BASE_URL}/login/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  
  const data = await handleResponse(response);
  
  if (data.access_token && data.refresh_token) {
    storeTokens(data.access_token, data.refresh_token);
    storeUser(data.user);
  }
  
  return data;
};

// Logout user
export const logout = async () => {
  const refreshToken = getRefreshToken();
  
  if (refreshToken) {
    try {
      await apiRequest('/logout/', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  clearAuthData();
};

// Get current user profile
export const getProfile = async () => {
  return apiRequest('/profile/', {
    method: 'GET',
  });
};

// Get user profile by username
export const getUserProfile = async (username) => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/profile/${username}/`, {
    method: 'GET',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  
  return handleResponse(response);
};

// Update user profile
export const updateProfile = async (profileData) => {
  const data = await apiRequest('/profile/', {
    method: 'PATCH',
    body: JSON.stringify(profileData),
  });
  
  if (data.user) {
    storeUser(data.user);
  }
  
  return data;
};

// Change password
export const changePassword = async (passwordData) => {
  return apiRequest('/change-password/', {
    method: 'POST',
    body: JSON.stringify(passwordData),
  });
};

// Check if username is available
export const checkUsername = async (username) => {
  const response = await fetch(`${API_BASE_URL}/check-username/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username }),
  });
  
  return handleResponse(response);
};

// Check if email is available
export const checkEmail = async (email) => {
  const response = await fetch(`${API_BASE_URL}/check-email/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email }),
  });
  
  return handleResponse(response);
};

// Follow a user
export const followUser = async (userId) => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/follow/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  return handleResponse(response);
};

// Unfollow a user
export const unfollowUser = async (userId) => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/unfollow/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: userId }),
  });
  
  return handleResponse(response);
};

// Check if following a user
export const checkFollowStatus = async (username) => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/check-follow/${username}/`, {
    method: 'GET',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  
  return handleResponse(response);
};

// Get followers list
export const getFollowers = async (username, page = 1) => {
  const response = await fetch(`${API_BASE_URL}/followers/${username}/?page=${page}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return handleResponse(response);
};

// Get following list
export const getFollowing = async (username, page = 1) => {
  const response = await fetch(`${API_BASE_URL}/following/${username}/?page=${page}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  return handleResponse(response);
};

// Get suggestions
export const getSuggestions = async () => {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/suggestions/`, {
    method: 'GET',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
  });
  
  return handleResponse(response);
};

// Helper function to format user data for forms
export const formatUserData = (user) => {
  return {
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    bio: user.bio || '',
    date_of_birth: user.date_of_birth,
    phone_number: user.phone_number,
    country: user.country,
    city: user.city,
  };
};

// Helper function to calculate age
export const calculateAge = (birthDate) => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
};

// Helper function to validate registration form
export const validateRegistration = (formData) => {
  const errors = {};
  
  if (!formData.username) {
    errors.username = 'Username is required';
  } else if (formData.username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
    errors.username = 'Username can only contain letters, numbers, and underscores';
  }
  
  if (!formData.email) {
    errors.email = 'Email is required';
  } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
    errors.email = 'Email is invalid';
  }
  
  if (!formData.password) {
    errors.password = 'Password is required';
  } else if (formData.password.length < 8) {
    errors.password = 'Password must be at least 8 characters';
  }
  
  if (formData.password !== formData.confirm_password) {
    errors.confirm_password = 'Passwords do not match';
  }
  
  if (!formData.full_name) {
    errors.full_name = 'Full name is required';
  }
  
  if (!formData.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required';
  } else {
    const age = calculateAge(new Date(formData.date_of_birth));
    if (age < 13) {
      errors.date_of_birth = 'You must be at least 13 years old';
    }
  }
  
  if (!formData.phone_number) {
    errors.phone_number = 'Phone number is required';
  }
  
  if (!formData.country) {
    errors.country = 'Country is required';
  }
  
  if (!formData.city) {
    errors.city = 'City is required';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

// Axios interceptor setup (if using Axios)
export const setupAxiosInterceptors = (axios) => {
  axios.interceptors.request.use(
    async (config) => {
      const token = getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );
  
  axios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      
      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;
        
        try {
          const newToken = await refreshAccessToken();
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axios(originalRequest);
        } catch (refreshError) {
          clearAuthData();
          window.location.href = '/auth';
          return Promise.reject(refreshError);
        }
      }
      
      return Promise.reject(error);
    }
  );
};

// React Hook for auth state
export const useAuth = () => {
  const [user, setUser] = React.useState(getUser());
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  const loginUser = async (credentials) => {
    setLoading(true);
    setError(null);
    try {
      const data = await login(credentials);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const registerUser = async (userData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await register(userData);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  const logoutUser = async () => {
    setLoading(true);
    try {
      await logout();
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const updateUserProfile = async (profileData) => {
    setLoading(true);
    setError(null);
    try {
      const data = await updateProfile(profileData);
      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };
  
  return {
    user,
    loading,
    error,
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
    updateProfile: updateUserProfile,
    isAuthenticated: isAuthenticated(),
  };
};

export default {
  register,
  login,
  logout,
  getProfile,
  getUserProfile,
  updateProfile,
  changePassword,
  checkUsername,
  checkEmail,
  followUser,
  unfollowUser,
  checkFollowStatus,
  getFollowers,
  getFollowing,
  getSuggestions,
  getAccessToken,
  getRefreshToken,
  getUser,
  isAuthenticated,
  refreshAccessToken,
  apiRequest,
  useAuth,
};