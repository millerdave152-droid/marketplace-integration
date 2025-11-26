import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Marketplace Manager Dashboard
 * Shows sync status and provides controls for syncing inventory and pulling orders
 */

const MarketplaceManager = () => {
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Fetch sync status on component mount
  useEffect(() => {
    fetchSyncStatus();
  }, []);

  const fetchSyncStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/api/marketplace/sync-status`);
      setSyncStatus(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch sync status: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncInventory = async () => {
    try {
      setSyncing(true);
      setMessage(null);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/marketplace/sync-offers`);

      if (response.data.success) {
        setMessage(`✅ Successfully synced ${response.data.synced} products to marketplace`);
        fetchSyncStatus(); // Refresh status
      } else {
        setError('Sync completed with issues');
      }
    } catch (err) {
      setError('Failed to sync inventory: ' + (err.response?.data?.error || err.message));
    } finally {
      setSyncing(false);
    }
  };

  const handlePullOrders = async () => {
    try {
      setPulling(true);
      setMessage(null);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/marketplace/pull-orders`);

      if (response.data.success) {
        setMessage(`✅ Successfully imported ${response.data.imported} orders from marketplace`);
        fetchSyncStatus(); // Refresh status
      } else {
        setError('Order pull completed with issues');
      }
    } catch (err) {
      setError('Failed to pull orders: ' + (err.response?.data?.error || err.message));
    } finally {
      setPulling(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading marketplace status...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Best Buy Marketplace Dashboard</h1>

      {/* Messages */}
      {message && (
        <div style={styles.successMessage}>
          {message}
          <button style={styles.closeButton} onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {error && (
        <div style={styles.errorMessage}>
          {error}
          <button style={styles.closeButton} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Sync Status Cards */}
      <div style={styles.cardsContainer}>
        {/* Pending Orders Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Pending Orders</h3>
          <div style={styles.cardValue}>
            {syncStatus?.pendingOrders || 0}
          </div>
          <div style={styles.cardSubtext}>Orders awaiting action</div>
        </div>

        {/* Offers Sync Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Inventory Sync</h3>
          <div style={styles.cardSubtext}>
            Last: {formatDate(syncStatus?.syncStatus?.offers?.lastSync)}
          </div>
          <div style={{
            ...styles.statusBadge,
            backgroundColor: syncStatus?.syncStatus?.offers?.lastStatus === 'success' ? '#d4edda' : '#f8d7da'
          }}>
            {syncStatus?.syncStatus?.offers?.lastStatus || 'unknown'}
          </div>
        </div>

        {/* Orders Pull Card */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Order Pull</h3>
          <div style={styles.cardSubtext}>
            Last: {formatDate(syncStatus?.syncStatus?.orders?.lastSync)}
          </div>
          <div style={{
            ...styles.statusBadge,
            backgroundColor: syncStatus?.syncStatus?.orders?.lastStatus === 'success' ? '#d4edda' : '#f8d7da'
          }}>
            {syncStatus?.syncStatus?.orders?.lastStatus || 'unknown'}
          </div>
        </div>
      </div>

      {/* Orders by State */}
      {syncStatus?.ordersByState && Object.keys(syncStatus.ordersByState).length > 0 && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Orders by State</h3>
          <div style={styles.statesGrid}>
            {Object.entries(syncStatus.ordersByState).map(([state, count]) => (
              <div key={state} style={styles.stateItem}>
                <span style={styles.stateName}>{state.replace(/_/g, ' ')}</span>
                <span style={styles.stateCount}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={styles.actionsContainer}>
        <button
          style={{
            ...styles.button,
            ...styles.primaryButton,
            ...(syncing ? styles.buttonDisabled : {})
          }}
          onClick={handleSyncInventory}
          disabled={syncing}
        >
          {syncing ? 'Syncing...' : '🔄 Sync Inventory'}
        </button>

        <button
          style={{
            ...styles.button,
            ...styles.secondaryButton,
            ...(pulling ? styles.buttonDisabled : {})
          }}
          onClick={handlePullOrders}
          disabled={pulling}
        >
          {pulling ? 'Pulling...' : '📥 Pull Orders'}
        </button>

        <button
          style={{
            ...styles.button,
            ...styles.tertiaryButton
          }}
          onClick={fetchSyncStatus}
        >
          🔃 Refresh Status
        </button>
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    marginBottom: '20px',
    color: '#333',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '18px',
    color: '#666',
  },
  successMessage: {
    backgroundColor: '#d4edda',
    color: '#155724',
    padding: '12px 16px',
    borderRadius: '4px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #c3e6cb',
  },
  errorMessage: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    padding: '12px 16px',
    borderRadius: '4px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: '1px solid #f5c6cb',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0 8px',
    opacity: 0.7,
  },
  cardsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px',
  },
  card: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '12px',
    color: '#555',
  },
  cardValue: {
    fontSize: '36px',
    fontWeight: 'bold',
    color: '#007bff',
    marginBottom: '8px',
  },
  cardSubtext: {
    fontSize: '14px',
    color: '#777',
    marginBottom: '8px',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginTop: '8px',
  },
  section: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333',
  },
  statesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '12px',
  },
  stateItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
  },
  stateName: {
    fontSize: '14px',
    color: '#495057',
    textTransform: 'capitalize',
  },
  stateCount: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#007bff',
  },
  actionsContainer: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 'bold',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  primaryButton: {
    backgroundColor: '#007bff',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#28a745',
    color: '#fff',
  },
  tertiaryButton: {
    backgroundColor: '#6c757d',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default MarketplaceManager;
