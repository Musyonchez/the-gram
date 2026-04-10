// pages/dashboard/DonationsPage.jsx
import React, { useState, useEffect } from 'react';
import { FiDollarSign, FiUser } from 'react-icons/fi';
import { getAccessToken } from '../../services/auth';

const DonationsPage = () => {
  const [donations, setDonations] = useState([]);
  const [totalDonations, setTotalDonations] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDonations();
  }, []);

  const fetchDonations = async () => {
    try {
      const token = getAccessToken();
      const response = await fetch('http://localhost:8000/api/donations/my-donations/', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDonations(data.results || []);
        const total = data.results.reduce((sum, donation) => sum + donation.amount, 0);
        setTotalDonations(total);
      }
    } catch (error) {
      console.error('Error fetching donations:', error);
      // Mock data
      const mockDonations = [
        {
          id: 1,
          post_title: 'Beautiful African Art',
          donor_name: 'John Doe',
          amount: 50,
          currency: 'USD',
          message: 'Love this artwork!',
          created_at: '2024-01-12T14:30:00Z',
        },
      ];
      setDonations(mockDonations);
      setTotalDonations(50);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#ff7b57] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Donations</h2>
        <div className="bg-linear-to-r from-green-600 to-emerald-500 rounded-2xl p-6">
          <p className="text-white/80 text-sm mb-2">Total Donations Received</p>
          <p className="text-4xl font-bold text-white flex items-center gap-2">
            <FiDollarSign className="text-3xl" />
            {totalDonations}
          </p>
        </div>
      </div>

      {donations.length === 0 ? (
        <div className="bg-[#131313] rounded-2xl border border-zinc-800 p-8 text-center">
          <FiDollarSign className="text-4xl text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No donations received yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {donations.map((donation) => (
            <div key={donation.id} className="bg-[#131313] rounded-2xl border border-zinc-800 p-6">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-white font-semibold flex items-center gap-2">
                    <FiUser className="text-green-500" />
                    From: {donation.donor_name}
                  </p>
                  <p className="text-zinc-400 text-sm mt-1">For: {donation.post_title}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-500 font-bold text-xl flex items-center gap-1">
                    <FiDollarSign className="text-xl" />
                    {donation.amount}
                  </p>
                  <p className="text-zinc-500 text-xs">{donation.currency}</p>
                </div>
              </div>
              {donation.message && (
                <p className="text-zinc-300 text-sm mt-2 italic border-l-2 border-green-500 pl-3">
                  "{donation.message}"
                </p>
              )}
              <p className="text-zinc-500 text-xs mt-3">
                {new Date(donation.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DonationsPage;