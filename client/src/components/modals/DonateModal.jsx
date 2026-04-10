// components/modals/DonateModal.jsx
import React, { useState, useEffect } from 'react';
import { FiX, FiHeart, FiSend, FiLock, FiUnlock, FiAlertCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { initiateMpesaDonation, validatePhoneNumber, validateDonationAmount, useTransactionStatus } from '../../services/donations';

const DonateModal = ({ post, onClose, onSuccess }) => {
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [_donationId, setDonationId] = useState(null);
  const [checkoutRequestId, setCheckoutRequestId] = useState(null);
  const [step, setStep] = useState('form'); // 'form', 'processing', 'success', 'error'
  const [errorMessage, setErrorMessage] = useState('');
  
  // Suggested donation amounts
  const suggestedAmounts = [50, 100, 200, 500, 1000];
  
  // Monitor transaction status
  useTransactionStatus(checkoutRequestId, (result) => {
    if (result.status === 'completed') {
      setStep('success');
      toast.success('Donation completed successfully! Thank you for your support!');
      if (onSuccess) onSuccess(result);
      setTimeout(() => {
        onClose();
      }, 3000);
    } else if (result.status === 'failed') {
      setStep('error');
      setErrorMessage('Payment failed. Please try again.');
      toast.error('Donation failed. Please try again.');
      setLoading(false);
    }
  });
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (checkoutRequestId) {
        // Cleanup if needed
      }
    };
  }, [checkoutRequestId]);
  
  const handleAmountSelect = (selectedAmount) => {
    setAmount(selectedAmount.toString());
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate amount
    const amountValidation = validateDonationAmount(amount);
    if (!amountValidation.valid) {
      toast.error(amountValidation.message);
      return;
    }
    
    // Validate phone number
    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (!phoneValidation.valid) {
      toast.error(phoneValidation.message);
      return;
    }
    
    setLoading(true);
    setErrorMessage('');
    
    try {
      const result = await initiateMpesaDonation({
        post_id: post.id,
        amount: parseFloat(amount),
        phone_number: phoneValidation.formatted,
        message: message,
        is_anonymous: isAnonymous
      });
      
      if (result.success) {
        setDonationId(result.donation_id);
        setCheckoutRequestId(result.checkout_request_id);
        setStep('processing');
        toast.success(result.message);
      } else {
        setStep('error');
        setErrorMessage(result.message || 'Failed to initiate donation');
        toast.error(result.message || 'Failed to initiate donation');
        setLoading(false);
      }
    } catch (error) {
      console.error('Donation error:', error);
      setStep('error');
      setErrorMessage(error.message || 'Failed to process donation');
      toast.error(error.message || 'Failed to process donation');
      setLoading(false);
    }
  };
  
  const resetForm = () => {
    setAmount('');
    setPhoneNumber('');
    setMessage('');
    setIsAnonymous(false);
    setStep('form');
    setErrorMessage('');
    setDonationId(null);
    setCheckoutRequestId(null);
  };
  
  const renderForm = () => (
    <form onSubmit={handleSubmit}>
      {/* Donation Amount */}
      <div className="mb-6">
        <label className="block text-white text-sm font-semibold mb-3">
          Donation Amount (KES)
        </label>
        
        {/* Suggested amounts */}
        <div className="grid grid-cols-5 gap-2 mb-3">
          {suggestedAmounts.map((suggested) => (
            <button
              key={suggested}
              type="button"
              onClick={() => handleAmountSelect(suggested)}
              className={`py-2 rounded-lg text-sm font-semibold transition ${
                amount === suggested.toString()
                  ? 'bg-[#ff7b57] text-black'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              KES {suggested}
            </button>
          ))}
        </div>
        
        {/* Custom amount */}
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Or enter custom amount (min. 1 KES)"
          className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
          min="1"
          max="100000"
          step="1"
          required
        />
        <p className="text-zinc-500 text-xs mt-2">
          Minimum: 1 KES | Maximum: 100,000 KES
        </p>
      </div>
      
      {/* Phone Number */}
      <div className="mb-6">
        <label className="block text-white text-sm font-semibold mb-2">
          M-Pesa Phone Number
        </label>
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="0712345678"
          className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none"
          required
        />
        <p className="text-zinc-500 text-xs mt-2 flex items-center gap-1">
          <FiLock size={12} />
          You'll receive a prompt on this number to complete payment
        </p>
      </div>
      
      {/* Message */}
      <div className="mb-6">
        <label className="block text-white text-sm font-semibold mb-2">
          Message (Optional)
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Leave an encouraging message for the creator..."
          rows="3"
          className="w-full bg-black/40 text-white border border-zinc-800 rounded-lg px-4 py-2 focus:border-[#ff7b57] focus:outline-none resize-none"
          maxLength="500"
        />
        <div className="text-right text-xs text-zinc-500 mt-1">
          {message.length}/500
        </div>
      </div>
      
      {/* Anonymous Toggle */}
      <div className="mb-6">
        <label className="flex items-center justify-between cursor-pointer p-3 bg-zinc-800/30 rounded-lg">
          <div className="flex items-center gap-3">
            {isAnonymous ? <FiLock size={18} className="text-zinc-400" /> : <FiUnlock size={18} className="text-zinc-400" />}
            <div>
              <span className="text-white text-sm font-semibold">Donate Anonymously</span>
              <p className="text-zinc-500 text-xs mt-0.5">Your name won't be shown publicly</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAnonymous(!isAnonymous)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              isAnonymous ? 'bg-[#ff7b57]' : 'bg-zinc-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                isAnonymous ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </label>
      </div>
      
      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-[#ff7b57] hover:bg-[#e96e4c] text-black font-bold py-3 rounded-full transition disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-black border-t-transparent"></div>
        ) : (
          <>
            <FiHeart size={18} />
            Donate Now
          </>
        )}
      </button>
    </form>
  );
  
  const renderProcessing = () => (
    <div className="text-center py-8">
      <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-[#ff7b57] border-t-transparent mb-4"></div>
      <h3 className="text-white text-xl font-bold mb-2">Processing Payment</h3>
      <p className="text-zinc-400 mb-4">
        Please check your phone and enter your M-Pesa PIN to complete the donation.
      </p>
      <div className="bg-zinc-800/50 rounded-lg p-4 mb-4">
        <p className="text-zinc-300 text-sm">Donation Amount: <span className="text-[#ff7b57] font-bold">KES {parseFloat(amount).toLocaleString()}</span></p>
        <p className="text-zinc-300 text-sm mt-1">Phone: <span className="text-white">{phoneNumber}</span></p>
      </div>
      <p className="text-zinc-500 text-xs">
        This may take a few moments. Please don't close this window.
      </p>
    </div>
  );
  
  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="text-white text-xl font-bold mb-2">Thank You for Your Support!</h3>
      <p className="text-zinc-400 mb-4">
        Your donation of <span className="text-[#ff7b57] font-bold">KES {parseFloat(amount).toLocaleString()}</span> has been successfully processed.
      </p>
      {message && (
        <div className="bg-zinc-800/50 rounded-lg p-3 mb-4">
          <p className="text-zinc-300 text-sm italic">"{message}"</p>
        </div>
      )}
      <p className="text-zinc-500 text-xs">
        A receipt has been sent to your phone. Closing in a few seconds...
      </p>
    </div>
  );
  
  const renderError = () => (
    <div className="text-center py-8">
      <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
        <FiAlertCircle className="w-10 h-10 text-red-500" />
      </div>
      <h3 className="text-white text-xl font-bold mb-2">Payment Failed</h3>
      <p className="text-red-400 mb-4">{errorMessage || 'Something went wrong. Please try again.'}</p>
      <button
        onClick={resetForm}
        className="bg-[#ff7b57] hover:bg-[#e96e4c] text-black font-bold px-6 py-2 rounded-full transition"
      >
        Try Again
      </button>
    </div>
  );
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#131313] rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-zinc-800 sticky top-0 bg-[#131313]">
          <div>
            <h2 className="text-xl font-bold text-white">Support This Post</h2>
            <p className="text-zinc-400 text-sm mt-1">Show your appreciation</p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition p-1 rounded-lg hover:bg-zinc-800"
          >
            <FiX size={24} />
          </button>
        </div>
        
        {/* Post Preview */}
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/30">
          <div className="flex items-start gap-3">
            <img
              src={post.user.profile_picture_url || `https://ui-avatars.com/api/?name=${post.user.username}&background=ff7b57&color=fff`}
              alt={post.user.username}
              className="w-10 h-10 rounded-full object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white font-semibold text-sm">
                  {post.user.full_name || post.user.username}
                </p>
                <p className="text-zinc-500 text-xs">@{post.user.username}</p>
              </div>
              {post.caption && (
                <p className="text-zinc-300 text-sm mt-1 line-clamp-2">{post.caption}</p>
              )}
            </div>
          </div>
        </div>
        
        {/* Modal Content */}
        <div className="p-6">
          {step === 'form' && renderForm()}
          {step === 'processing' && renderProcessing()}
          {step === 'success' && renderSuccess()}
          {step === 'error' && renderError()}
        </div>
        
        {/* Footer */}
        {step === 'form' && (
          <div className="p-6 border-t border-zinc-800 bg-zinc-900/20">
            <p className="text-zinc-500 text-xs text-center">
              Secure payment powered by M-Pesa. Your financial information is encrypted and secure.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonateModal;