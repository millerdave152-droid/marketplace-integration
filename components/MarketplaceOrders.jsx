import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Marketplace Orders Table
 * Lists all marketplace orders with filtering and detail view
 */

const MarketplaceOrders = ({ onOrderClick }) => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    hasMore: false,
  });

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Order state options for filter
  const ORDER_STATES = [
    { value: '', label: 'All Orders' },
    { value: 'WAITING_ACCEPTANCE', label: 'Waiting Acceptance' },
    { value: 'SHIPPING', label: 'Shipping' },
    { value: 'SHIPPED', label: 'Shipped' },
    { value: 'TO_COLLECT', label: 'To Collect' },
    { value: 'RECEIVED', label: 'Received' },
    { value: 'CLOSED', label: 'Closed' },
    { value: 'REFUSED', label: 'Refused' },
    { value: 'CANCELED', label: 'Canceled' },
  ];

  useEffect(() => {
    fetchOrders();
  }, [filter, pagination.offset]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit: pagination.limit,
        offset: pagination.offset,
      };

      if (filter) {
        params.state = filter;
      }

      const response = await axios.get(`${API_BASE_URL}/api/marketplace/orders`, { params });

      if (response.data.success) {
        setOrders(response.data.orders);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      setError('Failed to fetch orders: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
    setPagination({ ...pagination, offset: 0 }); // Reset to first page
  };

  const handleRowClick = (order) => {
    if (onOrderClick) {
      onOrderClick(order);
    }
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStateColor = (state) => {
    const colors = {
      'WAITING_ACCEPTANCE': '#ffc107',
      'SHIPPING': '#17a2b8',
      'SHIPPED': '#28a745',
      'TO_COLLECT': '#6c757d',
      'RECEIVED': '#20c997',
      'CLOSED': '#6c757d',
      'REFUSED': '#dc3545',
      'CANCELED': '#dc3545',
    };
    return colors[state] || '#6c757d';
  };

  const handleNextPage = () => {
    if (pagination.hasMore) {
      setPagination({ ...pagination, offset: pagination.offset + pagination.limit });
    }
  };

  const handlePrevPage = () => {
    if (pagination.offset > 0) {
      setPagination({ ...pagination, offset: Math.max(0, pagination.offset - pagination.limit) });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Marketplace Orders</h2>

        <div style={styles.controls}>
          <label style={styles.label}>
            Filter by State:
            <select
              value={filter}
              onChange={handleFilterChange}
              style={styles.select}
            >
              {ORDER_STATES.map(state => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </select>
          </label>

          <button onClick={fetchOrders} style={styles.refreshButton}>
            🔃 Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={styles.errorMessage}>
          {error}
          <button style={styles.closeButton} onClick={() => setError(null)}>×</button>
        </div>
      )}

      {loading ? (
        <div style={styles.loading}>Loading orders...</div>
      ) : orders.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No orders found.</p>
          {filter && <p>Try changing the filter or pull orders from marketplace.</p>}
        </div>
      ) : (
        <>
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.th}>Order ID</th>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Total</th>
                  <th style={styles.th}>State</th>
                  <th style={styles.th}>Created</th>
                  <th style={styles.th}>Accepted</th>
                  <th style={styles.th}>Shipped</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    style={styles.tableRow}
                    onClick={() => handleRowClick(order)}
                  >
                    <td style={styles.td}>
                      <span style={styles.orderId}>{order.mirakl_order_id}</span>
                    </td>
                    <td style={styles.td}>{order.customer_name || 'N/A'}</td>
                    <td style={styles.td}>
                      <strong>{formatPrice(order.total_price)}</strong>
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.stateBadge,
                          backgroundColor: getStateColor(order.order_state),
                        }}
                      >
                        {order.order_state.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={styles.td}>{formatDate(order.created_at)}</td>
                    <td style={styles.td}>
                      {order.accepted_at ? formatDate(order.accepted_at) : '-'}
                    </td>
                    <td style={styles.td}>
                      {order.shipped_at ? formatDate(order.shipped_at) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={styles.pagination}>
            <div style={styles.paginationInfo}>
              Showing {pagination.offset + 1} - {Math.min(pagination.offset + orders.length, pagination.total)} of {pagination.total} orders
            </div>
            <div style={styles.paginationButtons}>
              <button
                onClick={handlePrevPage}
                disabled={pagination.offset === 0}
                style={{
                  ...styles.paginationButton,
                  ...(pagination.offset === 0 ? styles.paginationButtonDisabled : {}),
                }}
              >
                ← Previous
              </button>
              <button
                onClick={handleNextPage}
                disabled={!pagination.hasMore}
                style={{
                  ...styles.paginationButton,
                  ...(!pagination.hasMore ? styles.paginationButtonDisabled : {}),
                }}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  controls: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  label: {
    fontSize: '14px',
    color: '#555',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  select: {
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
  },
  refreshButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
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
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '16px',
    color: '#666',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    color: '#666',
  },
  tableContainer: {
    overflowX: 'auto',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #ddd',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tableHeader: {
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
  },
  tableRow: {
    borderBottom: '1px solid #dee2e6',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#495057',
  },
  orderId: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#007bff',
    fontWeight: 'bold',
  },
  stateBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'capitalize',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '20px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  paginationInfo: {
    fontSize: '14px',
    color: '#495057',
  },
  paginationButtons: {
    display: 'flex',
    gap: '8px',
  },
  paginationButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  paginationButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default MarketplaceOrders;
