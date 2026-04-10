// components/Layout/Sidebar.js
import React from 'react';
import { NavLink } from 'react-router-dom';
import { HiOutlineCurrencyDollar } from "react-icons/hi";
import { FaUserCircle } from "react-icons/fa";
import { AiOutlineLogout } from "react-icons/ai";
import { LuFilePenLine } from "react-icons/lu";
import { HiOutlinePencilAlt } from "react-icons/hi";
import { MdOutlineDynamicFeed } from "react-icons/md";

const Sidebar = ({ onLogout }) => {
  const menuItems = [
    { id: 'feed', label: 'Feed', icon: <MdOutlineDynamicFeed className="text-xl" />, path: '/dashboard/feed' },
    { id: 'create', label: 'Create Post', icon: <HiOutlinePencilAlt className="text-xl" />, path: '/dashboard/create' },
    { id: 'my-posts', label: 'My Posts', icon: <LuFilePenLine className="text-xl" />, path: '/dashboard/my-posts' },
    { id: 'donations', label: 'Donations', icon: <HiOutlineCurrencyDollar className="text-xl" />, path: '/dashboard/donations' },
    { id: 'profile', label: 'Profile', icon: <FaUserCircle className="text-xl" />, path: '/dashboard/profile' }, // Updated to /dashboard/profile
  ];

  return (
    <aside className="w-72 bg-[#131313] border-r border-zinc-800 min-h-screen sticky top-0">
      <div className="p-6 border-b border-zinc-800">
        <NavLink to="/" className="text-2xl font-bold text-white">
          Afriq
        </NavLink>
      </div>

      <nav className="p-4">
        <div className="space-y-2">
          {menuItems.map((item) => (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.id === 'feed'}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-[#ff7b57] text-black'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`
              }
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="absolute bottom-8 left-0 right-0 px-4">
        <button
          onClick={onLogout}
          className="flex items-center space-x-3 px-4 py-3 rounded-xl w-full text-red-500 hover:bg-red-500/10 transition-all duration-200"
        >
          <AiOutlineLogout className="text-xl" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;