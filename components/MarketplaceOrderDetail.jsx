import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Marketplace Order Detail View
 * Shows full order details, allows accepting and shipping orders
 */

const MarketplaceOrderDetail = ({ orderId, onBack }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [accepting, setAccepting] = useState(false);
  const [shipping, setShipping] = useState(false);

  // Shipping form state
  const [trackingNumber, setTrackingNumber] = useState('');
  const [carrierCode, setCarrierCode] = useState('UPS');

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  const CARRIERS = [
    { code: 'UPS', name: 'UPS' },
    { code: 'USPS', name: 'USPS' },
    { code: 'FEDEX', name: 'FedEx' },
    { code: 'DHL', name: 'DHL' },
  ];

  useEffect(() => {
    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/marketplace/orders/${orderId}`);

      if (response.data.success) {
        setOrder(response.data.order);
      }
    } catch (err) {
      setError('Failed to fetch order details: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOrder = async () => {
    try {
      setAccepting(true);
      setMessage(null);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/marketplace/orders/${orderId}/accept`);

      if (response.data.success) {
        setMessage('✅ Order accepted successfully');
        setOrder(response.data.order);
      }
    } catch (err) {
      setError('Failed to accept order: ' + (err.response?.data?.error || err.message));
    } finally {
      setAccepting(false);
    }
  };

  const handleShipOrder = async (e) => {
    e.preventDefault();

    if (!trackingNumber.trim()) {
      setError('Please enter a tracking number');
      return;
    }

    try {
      setShipping(true);
      setMessage(null);
      setError(null);

      const response = await axios.post(`${API_BASE_URL}/api/marketplace/orders/${orderId}/ship`, {
        trackingNumber,
        carrierCode,
      });

      if (response.data.success) {
        setMessage('✅ Order shipped successfully');
        setTrackingNumber('');
        fetchOrderDetails(); // Refresh to show shipment
      }
    } catch (err) {
      setError('Failed to ship order: ' + (err.response?.data?.error || err.message));
    } finally {
      setShipping(false);
    }
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading order details...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Order not found</div>
        {onBack && (
          <button onClick={onBack} style={styles.backButton}>
            ← Back to Orders
          </button>
        )}
      </div>
    );
  }

  const shippingAddress = typeof order.shipping_address === 'string'
    ? JSON.parse(order.shipping_address)
    : order.shipping_address;

  const orderLines = typeof order.order_lines === 'string'
    ? JSON.parse(order.order_lines)
    : order.order_lines;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {onBack && (
          <button onClick={onBack} style={styles.backButton}>
            ← Back to Orders
          </button>
        )}
        <h2 style={styles.title}>Order Details: {order.mirakl_order_id}</h2>
      </div>

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

      {/* Order Info Grid */}
      <div style={styles.grid}>
        {/* Order Summary */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Order Summary</h3>
          <div style={styles.infoRow}>
            <span style={styles.label}>Order ID:</span>
            <span style={styles.value}>{order.mirakl_order_id}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>State:</span>
            <span style={{
              ...styles.stateBadge,
              backgroundColor: getStateColor(order.order_state),
            }}>
              {order.order_state.replace(/_/g, ' ')}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Total:</span>
            <span style={{ ...styles.value, fontWeight: 'bold', fontSize: '18px' }}>
              {formatPrice(order.total_price)}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.label}>Created:</span>
            <span style={styles.value}>{formatDate(order.created_at)}</span>
          </div>
          {order.accepted_at && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Accepted:</span>
              <span style={styles.value}>{formatDate(order.accepted_at)}</span>
            </div>
          )}
          {order.shipped_at && (
            <div style={styles.infoRow}>
              <span style={styles.label}>Shipped:</span>
              <span style={styles.value}>{formatDate(order.shipped_at)}</span>
            </div>
          )}
        </div>

        {/* Customer Info */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Customer Information</h3>
          <div style={styles.infoRow}>
            <span style={styles.label}>Name:</span>
            <span style={styles.value}>{order.customer_name || 'N/A'}</span>
          </div>
          {shippingAddress && (
            <>
              <h4 style={{ marginTop: '16px', marginBottom: '8px', fontSize: '14px' }}>Shipping Address:</h4>
              <div style={styles.address}>
                {shippingAddress.street && <div>{shippingAddress.street}</div>}
                {shippingAddress.street2 && <div>{shippingAddress.street2}</div>}
                {shippingAddress.city && shippingAddress.state && (
                  <div>{shippingAddress.city}, {shippingAddress.state} {shippingAddress.zip}</div>
                )}
                {shippingAddress.country && <div>{shippingAddress.country}</div>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Order Line Items */}
      <div style={styles.card}>
        <h3 style={styles.cardTitle}>Order Items</h3>
        {orderLines && orderLines.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Price</th>
                <th style={styles.th}>Total</th>
              </tr>
            </thead>
            <tbody>
              {orderLines.map((line, index) => (
                <tr key={index} style={styles.tableRow}>
                  <td style={styles.td}>{line.product_title || line.offer_sku || 'N/A'}</td>
                  <td style={styles.td}>{line.offer_sku || line.sku || 'N/A'}</td>
                  <td style={styles.td}>{line.quantity || 1}</td>
                  <td style={styles.td}>{line.price ? formatPrice(line.price * 100) : 'N/A'}</td>
                  <td style={styles.td}>
                    {line.price && line.quantity
                      ? formatPrice(line.price * line.quantity * 100)
                      : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No order items found</p>
        )}
      </div>

      {/* Accept Order Button */}
      {order.order_state === 'WAITING_ACCEPTANCE' && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Accept Order</h3>
          <p style={{ marginBottom: '16px', color: '#666' }}>
            This order is waiting for acceptance. Click the button below to accept it.
          </p>
          <button
            onClick={handleAcceptOrder}
            disabled={accepting}
            style={{
              ...styles.button,
              ...styles.acceptButton,
              ...(accepting ? styles.buttonDisabled : {}),
            }}
          >
            {accepting ? 'Accepting...' : '✅ Accept Order'}
          </button>
        </div>
      )}

      {/* Ship Order Form */}
      {order.order_state === 'SHIPPING' && !order.shipped_at && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Ship Order</h3>
          <p style={{ marginBottom: '16px', color: '#666' }}>
            Enter tracking information to mark this order as shipped.
          </p>
          <form onSubmit={handleShipOrder} style={styles.form}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Carrier:</label>
              <select
                value={carrierCode}
                onChange={(e) => setCarrierCode(e.target.value)}
                style={styles.select}
              >
                {CARRIERS.map(carrier => (
                  <option key={carrier.code} value={carrier.code}>
                    {carrier.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Tracking Number:</label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
                style={styles.input}
                required
              />
            </div>

            <button
              type="submit"
              disabled={shipping}
              style={{
                ...styles.button,
                ...styles.shipButton,
                ...(shipping ? styles.buttonDisabled : {}),
              }}
            >
              {shipping ? 'Shipping...' : '📦 Ship Order'}
            </button>
          </form>
        </div>
      )}

      {/* Shipment History */}
      {order.shipments && order.shipments.length > 0 && (
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Shipment History</h3>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>Tracking Number</th>
                <th style={styles.th}>Carrier</th>
                <th style={styles.th}>Shipped At</th>
              </tr>
            </thead>
            <tbody>
              {order.shipments.map((shipment) => (
                <tr key={shipment.id} style={styles.tableRow}>
                  <td style={styles.td}>
                    <span style={styles.trackingNumber}>{shipment.tracking_number}</span>
                  </td>
                  <td style={styles.td}>{shipment.carrier_code}</td>
                  <td style={styles.td}>{formatDate(shipment.shipped_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// Helper function
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

// Styles
const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'Arial, sans-serif',
  },
  header: {
    marginBottom: '20px',
  },
  backButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#6c757d',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginBottom: '12px',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#333',
    margin: 0,
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '16px',
    color: '#666',
  },
  error: {
    textAlign: 'center',
    padding: '40px',
    fontSize: '16px',
    color: '#dc3545',
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: '20px',
    marginBottom: '20px',
  },
  card: {
    backgroundColor: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '20px',
    marginBottom: '20px',
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    marginBottom: '16px',
    color: '#333',
    borderBottom: '2px solid #007bff',
    paddingBottom: '8px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f0f0f0',
  },
  label: {
    fontSize: '14px',
    color: '#666',
    fontWeight: 'bold',
  },
  value: {
    fontSize: '14px',
    color: '#333',
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
  address: {
    fontSize: '14px',
    color: '#495057',
    lineHeight: '1.6',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
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
    padding: '12px',
    textAlign: 'left',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
  },
  tableRow: {
    borderBottom: '1px solid #dee2e6',
  },
  td: {
    padding: '12px',
    fontSize: '14px',
    color: '#495057',
  },
  trackingNumber: {
    fontFamily: 'monospace',
    fontSize: '13px',
    color: '#007bff',
    fontWeight: 'bold',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  formLabel: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
  },
  input: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: '#fff',
  },
  select: {
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
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
  acceptButton: {
    backgroundColor: '#28a745',
    color: '#fff',
  },
  shipButton: {
    backgroundColor: '#007bff',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
};

export default MarketplaceOrderDetail;
