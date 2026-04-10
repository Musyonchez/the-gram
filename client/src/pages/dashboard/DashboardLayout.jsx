// pages/dashboard/DashboardLayout.jsx
import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Sidebar from '../../components/Layout/Sidebar';

const DashboardLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab based on current path
  const getActiveTabFromPath = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/dashboard/feed') return 'feed';
    if (path === '/dashboard/create') return 'create';
    if (path === '/dashboard/my-posts') return 'my-posts';
    if (path === '/dashboard/donations') return 'donations';
    return 'feed';
  };

  const [activeTab, setActiveTab] = useState(getActiveTabFromPath());

  const handleLogout = () => {
    localStorage.clear();
    navigate('/auth');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/dashboard/${tabId === 'feed' ? '' : tabId}`);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
      />
      
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={handleTabChange} 
        onLogout={handleLogout} 
      />
      
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
};

export default DashboardLayout;