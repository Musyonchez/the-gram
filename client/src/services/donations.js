// services/donations.js
// API service for handling M-Pesa donations
import { useState, useEffect, useRef } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
};

// Helper for handling API responses
const handleResponse = async (response) => {
    if (response.status === 401) {
        // Token expired - redirect to login
        localStorage.clear();
        window.location.href = '/auth';
        throw new Error('Session expired. Please login again.');
    }
    
    const data = await response.json();
    
    if (!response.ok) {
        const error = new Error(data.message || data.error || data.detail || 'API request failed');
        error.status = response.status;
        error.data = data;
        throw error;
    }
    
    return data;
};

// Helper to format phone number
export const formatPhoneNumber = (phone) => {
    // Remove any non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Remove leading 0 or + if present
    if (cleaned.startsWith('0')) {
        cleaned = '254' + cleaned.substring(1);
    } else if (cleaned.startsWith('254')) {
        // Already in correct format
        return cleaned;
    } else if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    } else if (!cleaned.startsWith('254')) {
        cleaned = '254' + cleaned;
    }
    
    return cleaned;
};

// ============ DONATION ENDPOINTS ============

// Initiate M-Pesa STK Push donation - POST request only
export const initiateMpesaDonation = async (donationData) => {
    const response = await fetch(`${API_BASE_URL}/payments/donate/mpesa/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(donationData)
    });
    return handleResponse(response);
};

// Tip a creator directly
export const tipCreator = async (tipData) => {
    const response = await fetch(`${API_BASE_URL}/payments/donate/tip/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(tipData)
    });
    return handleResponse(response);
};

// Get donation history for current user
export const getDonationHistory = async (type = 'all', page = 1, pageSize = 20) => {
    const response = await fetch(
        `${API_BASE_URL}/payments/history/?type=${type}&page=${page}&page_size=${pageSize}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
};

// Get donations for a specific post
export const getPostDonations = async (postId, page = 1, pageSize = 20) => {
    const response = await fetch(
        `${API_BASE_URL}/payments/post/${postId}/donations/?page=${page}&page_size=${pageSize}`,
        { headers: getAuthHeaders() }
    );
    return handleResponse(response);
};

// Get donation statistics for a user or post
export const getDonationStats = async (params) => {
    let url = `${API_BASE_URL}/payments/stats/`;
    const queryParams = new URLSearchParams();
    
    if (params.userId) {
        queryParams.append('user_id', params.userId);
    }
    if (params.postId) {
        queryParams.append('post_id', params.postId);
    }
    
    if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
    }
    
    const response = await fetch(url, {
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// Check transaction status - GET request
export const getTransactionStatus = async (checkoutRequestId) => {
    const response = await fetch(`${API_BASE_URL}/payments/transaction/${checkoutRequestId}/status/`, {
        method: 'GET',
        headers: getAuthHeaders()
    });
    return handleResponse(response);
};

// ============ HELPER FUNCTIONS ============

// Format donation data for display
export const formatDonationData = (donation) => {
    return {
        id: donation.id,
        donor: donation.donor_info ? {
            id: donation.donor_info.id,
            username: donation.donor_info.username,
            full_name: donation.donor_info.full_name,
            profile_picture: donation.donor_info.profile_picture_url || '/default-avatar.png'
        } : null,
        recipient: donation.recipient_info ? {
            id: donation.recipient_info.id,
            username: donation.recipient_info.username,
            full_name: donation.recipient_info.full_name,
            profile_picture: donation.recipient_info.profile_picture_url || '/default-avatar.png'
        } : null,
        post: donation.post_info ? {
            id: donation.post_info.id,
            caption: donation.post_info.caption,
            media_url: donation.post_info.media_url
        } : null,
        donationType: donation.donation_type,
        amount: parseFloat(donation.amount),
        formattedAmount: donation.formatted_amount,
        currency: donation.currency,
        message: donation.message,
        isAnonymous: donation.is_anonymous,
        status: donation.status,
        channel: donation.channel,
        createdAt: new Date(donation.created_at),
        formattedDate: donation.formatted_date,
        completedAt: donation.completed_at ? new Date(donation.completed_at) : null,
        displayName: donation.is_anonymous ? 'Anonymous' : (donation.donor_info?.full_name || donation.donor_info?.username || 'Someone'),
        isCompleted: donation.status === 'completed',
        isPending: donation.status === 'pending',
        isFailed: donation.status === 'failed'
    };
};

// Format donation stats for display
export const formatDonationStats = (stats) => {
    return {
        totalDonations: stats.total_donations || 0,
        totalAmount: parseFloat(stats.total_amount || 0),
        formattedTotalAmount: `KES ${(stats.total_amount || 0).toLocaleString()}`,
        recentDonations: (stats.recent_donations || []).map(formatDonationData),
        donationsCount: stats.donations_count || 0,
        totalDonationsAmount: parseFloat(stats.total_donations_amount || 0),
        averageAmount: stats.total_donations > 0 ? stats.total_amount / stats.total_donations : 0
    };
};

// ============ VALIDATION FUNCTIONS ============

// Validate donation amount
export const validateDonationAmount = (amount) => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount)) {
        return { valid: false, message: 'Please enter a valid amount' };
    }
    if (numAmount < 1) {
        return { valid: false, message: 'Minimum donation amount is 1 KES' };
    }
    if (numAmount > 100000) {
        return { valid: false, message: 'Maximum donation amount is 100,000 KES' };
    }
    return { valid: true, message: null };
};

// Validate phone number
export const validatePhoneNumber = (phone) => {
    const formatted = formatPhoneNumber(phone);
    if (!formatted || formatted.length !== 12) {
        return { valid: false, message: 'Please enter a valid phone number (e.g., 0712345678)' };
    }
    if (!formatted.startsWith('254')) {
        return { valid: false, message: 'Phone number must start with 254' };
    }
    return { valid: true, message: null, formatted };
};

// ============ REACT HOOKS ============

export const useTransactionStatus = (checkoutRequestId, onStatusChange) => {
    const [status, setStatus] = useState(null);
    const intervalRef = useRef(null);
    const callbackRef = useRef(onStatusChange);
    callbackRef.current = onStatusChange;

    useEffect(() => {
        if (!checkoutRequestId) return;

        const poll = async () => {
            try {
                const result = await getTransactionStatus(checkoutRequestId);
                setStatus(result.status);
                if (result.status === 'completed' || result.status === 'failed' || result.status === 'cancelled') {
                    clearInterval(intervalRef.current);
                    if (callbackRef.current) callbackRef.current(result);
                }
            } catch {
                // keep polling on transient errors
            }
        };

        poll();
        intervalRef.current = setInterval(poll, 5000);

        return () => clearInterval(intervalRef.current);
    }, [checkoutRequestId]);

    return { status };
};

// ============ DEFAULT EXPORT ============

export default {
    initiateMpesaDonation,
    tipCreator,
    getDonationHistory,
    getPostDonations,
    getDonationStats,
    getTransactionStatus,
    formatDonationData,
    formatDonationStats,
    formatPhoneNumber,
    validateDonationAmount,
    validatePhoneNumber
};