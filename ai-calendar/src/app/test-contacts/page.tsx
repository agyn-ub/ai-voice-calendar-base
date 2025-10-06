'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';

interface StoredContact {
  email: string;
  name: string | null;
}

interface SyncResult {
  success: boolean;
  action?: string;
  error?: string;
  message?: string;
  summary?: {
    totalContacts: number;
    inserted?: number;
    withNames: number;
    withoutNames: number;
  };
}

export default function TestContactsPage() {
  const router = useRouter();
  const { address: addr, isConnected } = useAccount();

  // State
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'not_connected'>('checking');
  const [storedContacts, setStoredContacts] = useState<StoredContact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<StoredContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'loading'>('idle');
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  // Check connection and load contacts on mount
  useEffect(() => {
    if (addr) {
      checkConnection();
      loadStoredContacts();
    }
  }, [addr]);

  // Filter contacts when search query changes
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredContacts(storedContacts);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = storedContacts.filter(contact =>
        (contact.name && contact.name.toLowerCase().includes(query)) ||
        contact.email.toLowerCase().includes(query)
      );
      setFilteredContacts(filtered);
    }
    // Reset to first page when search changes
    setCurrentPage(1);
  }, [searchQuery, storedContacts]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 7;
    const halfRange = Math.floor(maxPagesToShow / 2);

    let startPage = Math.max(1, currentPage - halfRange);
    let endPage = Math.min(totalPages, currentPage + halfRange);

    // Adjust if we're near the beginning or end
    if (currentPage <= halfRange) {
      endPage = Math.min(totalPages, maxPagesToShow);
    }
    if (currentPage > totalPages - halfRange) {
      startPage = Math.max(1, totalPages - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  };

  const checkConnection = async () => {
    if (!addr) {
      setConnectionStatus('not_connected');
      return;
    }

    try {
      const response = await fetch(`/api/calendar/status?wallet_address=${addr}`);
      const data = await response.json();
      setConnectionStatus(data.connected ? 'connected' : 'not_connected');
    } catch (error) {
      setConnectionStatus('not_connected');
    }
  };

  const loadStoredContacts = async () => {
    if (!addr) return;

    setSyncStatus('loading');
    try {
      const response = await fetch(
        `/api/calendar/google/sync-contacts?wallet_address=${addr}`
      );
      const data = await response.json();

      if (data.success && data.contacts) {
        setStoredContacts(data.contacts);
        setFilteredContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setSyncStatus('idle');
    }
  };

  const syncGmailContacts = async () => {
    if (!addr) return;

    setSyncStatus('syncing');
    setSyncResult(null);

    try {
      const response = await fetch('/api/calendar/google/sync-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: addr,
          action: 'sync',
          maxPages: 10  // Will process up to 5,000 messages (500 per page * 10 pages) - safer for rate limits
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncResult({ success: true, action: data.action, summary: data.summary });
        // Reload contacts after sync
        await loadStoredContacts();
      } else {
        setSyncResult({ success: false, error: data.error || 'Failed to sync contacts' });
      }
    } catch (error) {
      console.error('Error syncing contacts:', error);
      setSyncResult({ success: false, error: 'Failed to sync Gmail contacts' });
    } finally {
      setSyncStatus('idle');
    }
  };

  const clearStoredContacts = async () => {
    if (!addr) return;

    setSyncStatus('syncing');
    setSyncResult(null);

    try {
      const response = await fetch('/api/calendar/google/sync-contacts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: addr,
          action: 'clear'
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSyncResult({ success: true, message: 'Contacts cleared successfully' });
        setStoredContacts([]);
        setFilteredContacts([]);
      } else {
        setSyncResult({ success: false, error: data.error || 'Failed to clear contacts' });
      }
    } catch (error) {
      console.error('Error clearing contacts:', error);
      setSyncResult({ success: false, error: 'Failed to clear contacts' });
    } finally {
      setSyncStatus('idle');
    }
  };

  if (!addr) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto bg-gray-800 rounded-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Your Wallet</h1>
          <p className="text-gray-400 mb-6">Please connect your wallet to manage contacts</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Contact Management</h1>
          <p className="text-gray-400">
            Sync contacts from Gmail for easy calendar invitations
          </p>
        </div>

        {/* Connection Status */}
        {connectionStatus === 'not_connected' && (
          <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4 mb-6">
            <p className="text-yellow-400">
              ⚠️ Google Calendar not connected.
              <button
                onClick={() => router.push('/')}
                className="ml-2 underline hover:text-yellow-300"
              >
                Connect Calendar
              </button>
            </p>
          </div>
        )}

        {/* Sync Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Gmail Contact Sync</h2>
              <p className="text-gray-400 text-sm mt-1">
                Extract email addresses from your Gmail and store them locally
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-400">{storedContacts.length}</p>
              <p className="text-gray-400 text-sm">Total Contacts</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={syncGmailContacts}
              disabled={!addr || syncStatus === 'syncing' || connectionStatus === 'not_connected'}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {syncStatus === 'syncing' ? 'Syncing (this may take 1-2 minutes)...' : 'Sync Contacts from Gmail'}
            </button>

            {storedContacts.length > 0 && (
              <button
                onClick={clearStoredContacts}
                disabled={syncStatus === 'syncing'}
                className="px-6 py-2 bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Clear All Contacts
              </button>
            )}
          </div>

          {/* Sync Result */}
          {syncResult && (
            <div className={`mt-4 p-4 rounded-lg ${
              syncResult.success
                ? 'bg-green-900/20 border border-green-600'
                : 'bg-red-900/20 border border-red-600'
            }`}>
              {syncResult.success ? (
                <>
                  {syncResult.action === 'sync' && syncResult.summary && (
                    <>
                      <p className="text-green-400 font-semibold">✅ Sync Complete!</p>
                      <div className="text-gray-300 text-sm mt-2 grid grid-cols-3 gap-4">
                        <div>
                          <span className="text-gray-400">Total:</span> {syncResult.summary.totalContacts}
                        </div>
                        <div>
                          <span className="text-gray-400">With names:</span> {syncResult.summary.withNames}
                        </div>
                        <div>
                          <span className="text-gray-400">Email only:</span> {syncResult.summary.withoutNames}
                        </div>
                      </div>
                    </>
                  )}
                  {syncResult.message && (
                    <p className="text-green-400 font-semibold">✅ {syncResult.message}</p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-red-400 font-semibold">❌ Error</p>
                  <p className="text-red-300 mt-2">{syncResult.error}</p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Contacts Table */}
        {storedContacts.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            {/* Search Bar and Controls */}
            <div className="mb-6">
              <div className="flex gap-4 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search contacts by name or email..."
                  className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white placeholder-gray-400"
                />
                <select
                  value={itemsPerPage}
                  onChange={(e) => {
                    setItemsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={200}>200 per page</option>
                </select>
              </div>

              <div className="flex justify-between items-center text-sm text-gray-400">
                <p>
                  {searchQuery && `Found ${filteredContacts.length} of ${storedContacts.length} contacts`}
                  {!searchQuery && `Total: ${storedContacts.length} contacts`}
                </p>
                {filteredContacts.length > 0 && (
                  <p>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredContacts.length)} of {filteredContacts.length}
                  </p>
                )}
              </div>
            </div>

            {/* Contacts Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-700">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-300">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContacts.length > 0 ? (
                    paginatedContacts.map((contact, index) => (
                      <tr
                        key={startIndex + index}
                        className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="py-3 px-4">
                          {contact.name ? (
                            <span className="text-gray-200">{contact.name}</span>
                          ) : (
                            <span className="text-gray-500 italic">No name</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-blue-400">{contact.email}</span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="py-8 text-center text-gray-500">
                        {searchQuery ? 'No contacts match your search' : 'No contacts found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Page Numbers */}
                {currentPage > 4 && totalPages > 7 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors min-w-[40px]"
                    >
                      1
                    </button>
                    <span className="text-gray-500">...</span>
                  </>
                )}

                {getPageNumbers().map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg transition-colors min-w-[40px] ${
                      currentPage === page
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    {page}
                  </button>
                ))}

                {currentPage < totalPages - 3 && totalPages > 7 && (
                  <>
                    <span className="text-gray-500">...</span>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors min-w-[40px]"
                    >
                      {totalPages}
                    </button>
                  </>
                )}

                {/* Next Button */}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {storedContacts.length === 0 && syncStatus === 'idle' && (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">No contacts synced yet</p>
            <p className="text-gray-500 text-sm">
              Click "Sync Contacts from Gmail" to extract email addresses from your Gmail
            </p>
          </div>
        )}
      </div>
    </div>
  );
}