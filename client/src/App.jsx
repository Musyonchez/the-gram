// App.js
import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import HomePage from './pages/HomePage';
import DashboardLayout from './pages/dashboard/DashboardLayout';
import FeedPage from './pages/dashboard/FeedPage';
import CreatePostPage from './pages/dashboard/CreatePostPage';
import MyPostsPage from './pages/dashboard/MyPosts';
import DonationsPage from './pages/dashboard/DonationsPage';
import ProfilePage from './pages/dashboard/ProfilePage';
import AuthPage from './pages/AuthPage';
import { isAuthenticated, getAccessToken, refreshAccessToken } from './services/auth';

// Protected Route Component - for routes that require authentication
const ProtectedRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        let token = getAccessToken();
        
        if (token && isTokenExpired(token)) {
          try {
            await refreshAccessToken();
            token = getAccessToken();
          } catch (error) {
            console.error('Token refresh failed:', error);
            token = null;
          }
        }
        
        setIsAuth(!!token);
      } catch (error) {
        console.error('Auth check error:', error);
        setIsAuth(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff7b57] border-t-transparent"></div>
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuth ? children : <Navigate to="/auth" replace />;
};

// Public Route Component
const PublicRoute = ({ children }) => {
  const [isAuth, setIsAuth] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    setIsAuth(!!token);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff7b57] border-t-transparent"></div>
          <p className="text-white mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  return !isAuth ? children : <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<HomePage />} />
        
        {/* Auth Route */}
        <Route 
          path="/auth" 
          element={
            <PublicRoute>
              <AuthPage />
            </PublicRoute>
          } 
        />
        
        {/* Dashboard Nested Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<FeedPage />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="create" element={<CreatePostPage />} />
          <Route path="my-posts" element={<MyPostsPage />} />
          <Route path="donations" element={<DonationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/:username" element={<ProfilePage />} />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;