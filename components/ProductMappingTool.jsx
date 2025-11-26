import React, { useState, useEffect } from 'react';
import axios from 'axios';

/**
 * Product Mapping Tool
 * Maps internal products to Best Buy Marketplace (Mirakl)
 */

const ProductMappingTool = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [filterUnmapped, setFilterUnmapped] = useState(true);
  const [editedProducts, setEditedProducts] = useState({});
  const [saving, setSaving] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`${API_BASE_URL}/api/product-mapping`);

      if (response.data.success) {
        setProducts(response.data.products);
      }
    } catch (err) {
      setError('Failed to fetch products: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (productId, field, value) => {
    setEditedProducts(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value,
      },
    }));
  };

  const handleSaveProduct = async (product) => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const updates = editedProducts[product.id] || {};
      const payload = {
        mirakl_sku: updates.mirakl_sku !== undefined ? updates.mirakl_sku : product.mirakl_sku,
        bestbuy_category_id: updates.bestbuy_category_id !== undefined
          ? updates.bestbuy_category_id
          : product.bestbuy_category_id,
      };

      const response = await axios.put(
        `${API_BASE_URL}/api/product-mapping/${product.id}`,
        payload
      );

      if (response.data.success) {
        setMessage(`✅ Updated product: ${product.sku}`);

        // Update local state
        setProducts(prev => prev.map(p =>
          p.id === product.id ? response.data.product : p
        ));

        // Clear edited state for this product
        setEditedProducts(prev => {
          const updated = { ...prev };
          delete updated[product.id];
          return updated;
        });

        // Auto-dismiss message
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      setError('Failed to save product: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const updates = Object.entries(editedProducts).map(([productId, changes]) => {
        const product = products.find(p => p.id === parseInt(productId));
        return {
          id: parseInt(productId),
          mirakl_sku: changes.mirakl_sku !== undefined ? changes.mirakl_sku : product?.mirakl_sku,
          bestbuy_category_id: changes.bestbuy_category_id !== undefined
            ? changes.bestbuy_category_id
            : product?.bestbuy_category_id,
        };
      });

      if (updates.length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }

      const response = await axios.post(`${API_BASE_URL}/api/product-mapping/bulk`, {
        products: updates,
      });

      if (response.data.success) {
        setMessage(`✅ Bulk updated ${response.data.updated} products`);
        setEditedProducts({});
        fetchProducts(); // Refresh list
      }
    } catch (err) {
      setError('Failed to bulk save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const exportToCSV = () => {
    try {
      const filteredProducts = filterUnmapped
        ? products.filter(p => !p.mirakl_sku)
        : products;

      // CSV headers
      const headers = ['ID', 'SKU', 'Product Name', 'Price', 'Mirakl SKU', 'Best Buy Category ID'];

      // CSV rows
      const rows = filteredProducts.map(product => [
        product.id,
        product.sku || '',
        `"${(product.name || '').replace(/"/g, '""')}"`, // Escape quotes
        formatPrice(product.price),
        product.mirakl_sku || '',
        product.bestbuy_category_id || '',
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      // Create blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `product-mapping-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setMessage(`✅ Exported ${filteredProducts.length} products to CSV`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setError('Failed to export CSV: ' + err.message);
    }
  };

  const formatPrice = (cents) => {
    if (!cents && cents !== 0) return 'N/A';
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getDisplayValue = (product, field) => {
    if (editedProducts[product.id]?.[field] !== undefined) {
      return editedProducts[product.id][field];
    }
    return product[field] || '';
  };

  const hasChanges = (productId) => {
    return editedProducts[productId] !== undefined;
  };

  const filteredProducts = filterUnmapped
    ? products.filter(p => !p.mirakl_sku)
    : products;

  const editedCount = Object.keys(editedProducts).length;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Product Mapping Tool</h2>
        <p style={styles.subtitle}>
          Map internal products to Best Buy Marketplace SKUs
        </p>
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

      {/* Controls */}
      <div style={styles.controls}>
        <label style={styles.checkbox}>
          <input
            type="checkbox"
            checked={filterUnmapped}
            onChange={(e) => setFilterUnmapped(e.target.checked)}
          />
          <span style={{ marginLeft: '8px' }}>Show only unmapped products</span>
        </label>

        <div style={styles.buttonGroup}>
          <button onClick={fetchProducts} style={styles.refreshButton}>
            🔃 Refresh
          </button>

          <button onClick={exportToCSV} style={styles.exportButton}>
            📥 Export to CSV
          </button>

          {editedCount > 0 && (
            <button
              onClick={handleBulkSave}
              disabled={saving}
              style={{
                ...styles.bulkSaveButton,
                ...(saving ? styles.buttonDisabled : {}),
              }}
            >
              {saving ? 'Saving...' : `💾 Bulk Save (${editedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Total Products:</span>
          <span style={styles.statValue}>{products.length}</span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Unmapped:</span>
          <span style={styles.statValue}>
            {products.filter(p => !p.mirakl_sku).length}
          </span>
        </div>
        <div style={styles.stat}>
          <span style={styles.statLabel}>Mapped:</span>
          <span style={styles.statValue}>
            {products.filter(p => p.mirakl_sku).length}
          </span>
        </div>
        {editedCount > 0 && (
          <div style={styles.stat}>
            <span style={styles.statLabel}>Pending Changes:</span>
            <span style={{ ...styles.statValue, color: '#ffc107' }}>{editedCount}</span>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={styles.loading}>Loading products...</div>
      ) : filteredProducts.length === 0 ? (
        <div style={styles.emptyState}>
          <p>
            {filterUnmapped
              ? 'All products are mapped! 🎉'
              : 'No products found.'}
          </p>
        </div>
      ) : (
        <div style={styles.tableContainer}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeader}>
                <th style={styles.th}>ID</th>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Product Name</th>
                <th style={styles.th}>Price</th>
                <th style={styles.th}>Mirakl SKU</th>
                <th style={styles.th}>Category ID</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  style={{
                    ...styles.tableRow,
                    ...(hasChanges(product.id) ? styles.tableRowEdited : {}),
                  }}
                >
                  <td style={styles.td}>{product.id}</td>
                  <td style={styles.td}>
                    <span style={styles.sku}>{product.sku}</span>
                  </td>
                  <td style={styles.td}>{product.name || 'N/A'}</td>
                  <td style={styles.td}>
                    <strong>{formatPrice(product.price)}</strong>
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={getDisplayValue(product, 'mirakl_sku')}
                      onChange={(e) => handleInputChange(product.id, 'mirakl_sku', e.target.value)}
                      placeholder="Enter Mirakl SKU"
                      style={styles.input}
                    />
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      value={getDisplayValue(product, 'bestbuy_category_id')}
                      onChange={(e) => handleInputChange(product.id, 'bestbuy_category_id', e.target.value)}
                      placeholder="Category ID"
                      style={styles.input}
                    />
                  </td>
                  <td style={styles.td}>
                    <button
                      onClick={() => handleSaveProduct(product)}
                      disabled={saving || !hasChanges(product.id)}
                      style={{
                        ...styles.saveButton,
                        ...(saving || !hasChanges(product.id) ? styles.buttonDisabled : {}),
                      }}
                    >
                      💾 Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#333',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0,
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
  controls: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '14px',
    color: '#495057',
    cursor: 'pointer',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
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
  exportButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#17a2b8',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  bulkSaveButton: {
    padding: '8px 16px',
    fontSize: '14px',
    backgroundColor: '#28a745',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  stats: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    flexWrap: 'wrap',
  },
  stat: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: '14px',
    color: '#666',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#007bff',
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
    whiteSpace: 'nowrap',
  },
  tableRow: {
    borderBottom: '1px solid #dee2e6',
    transition: 'background-color 0.2s',
  },
  tableRowEdited: {
    backgroundColor: '#fff3cd',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#495057',
  },
  sku: {
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#007bff',
  },
  input: {
    width: '100%',
    padding: '6px 10px',
    fontSize: '13px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    backgroundColor: '#fff',
  },
  saveButton: {
    padding: '6px 12px',
    fontSize: '12px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
  },
};

export default ProductMappingTool;
