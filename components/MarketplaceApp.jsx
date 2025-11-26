import React, { useState } from 'react';
import MarketplaceManager from './MarketplaceManager';
import MarketplaceOrders from './MarketplaceOrders';
import MarketplaceOrderDetail from './MarketplaceOrderDetail';

/**
 * Marketplace App - Main Container
 * Example of how to use the marketplace components together
 */

const MarketplaceApp = () => {
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard', 'orders', 'order-detail'
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const handleOrderClick = (order) => {
    setSelectedOrderId(order.id);
    setCurrentView('order-detail');
  };

  const handleBackToOrders = () => {
    setSelectedOrderId(null);
    setCurrentView('orders');
  };

  const handleBackToDashboard = () => {
    setSelectedOrderId(null);
    setCurrentView('dashboard');
  };

  return (
    <div style={styles.container}>
      {/* Navigation Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(currentView === 'dashboard' ? styles.tabActive : {}),
          }}
          onClick={handleBackToDashboard}
        >
          Dashboard
        </button>
        <button
          style={{
            ...styles.tab,
            ...(currentView === 'orders' || currentView === 'order-detail' ? styles.tabActive : {}),
          }}
          onClick={handleBackToOrders}
        >
          Orders
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {currentView === 'dashboard' && <MarketplaceManager />}

        {currentView === 'orders' && (
          <MarketplaceOrders onOrderClick={handleOrderClick} />
        )}

        {currentView === 'order-detail' && selectedOrderId && (
          <MarketplaceOrderDetail
            orderId={selectedOrderId}
            onBack={handleBackToOrders}
          />
        )}
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  tabs: {
    backgroundColor: '#fff',
    borderBottom: '2px solid #dee2e6',
    display: 'flex',
    gap: '0',
    padding: '0 20px',
  },
  tab: {
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: 'transparent',
    border: 'none',
    borderBottom: '3px solid transparent',
    cursor: 'pointer',
    color: '#6c757d',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: '#007bff',
    borderBottomColor: '#007bff',
  },
  content: {
    padding: '20px',
  },
};

export default MarketplaceApp;
