# Marketplace React Components

React components for managing Best Buy Marketplace integration.

## Components

### 1. MarketplaceManager.jsx
Dashboard showing sync status and manual sync controls.

**Features:**
- Last sync times for inventory and orders
- Pending order count
- Orders by state summary
- Manual sync inventory button
- Manual pull orders button
- Success/error messaging

**Usage:**
```jsx
import MarketplaceManager from './components/MarketplaceManager';

function App() {
  return <MarketplaceManager />;
}
```

**API Endpoints Used:**
- `GET /api/marketplace/sync-status`
- `POST /api/marketplace/sync-offers`
- `GET /api/marketplace/pull-orders`

---

### 2. MarketplaceOrders.jsx
Table view of all marketplace orders with filtering.

**Features:**
- Paginated order list
- Filter by order state
- Clickable rows for detail view
- Refresh button
- Formatted prices and dates

**Props:**
- `onOrderClick(order)` - Callback when order row is clicked

**Usage:**
```jsx
import MarketplaceOrders from './components/MarketplaceOrders';

function App() {
  const handleOrderClick = (order) => {
    console.log('Order clicked:', order);
    // Navigate to detail view
  };

  return <MarketplaceOrders onOrderClick={handleOrderClick} />;
}
```

**API Endpoints Used:**
- `GET /api/marketplace/orders?state=&limit=&offset=`

---

### 3. MarketplaceOrderDetail.jsx
Detailed view of a single order with accept/ship functionality.

**Features:**
- Order summary and customer info
- Shipping address display
- Order line items table
- Accept order button (if WAITING_ACCEPTANCE)
- Ship order form (if SHIPPING)
- Shipment history
- Success/error messaging

**Props:**
- `orderId` - ID of the order to display
- `onBack()` - Callback for back button

**Usage:**
```jsx
import MarketplaceOrderDetail from './components/MarketplaceOrderDetail';

function App() {
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  return (
    <>
      {selectedOrderId ? (
        <MarketplaceOrderDetail
          orderId={selectedOrderId}
          onBack={() => setSelectedOrderId(null)}
        />
      ) : (
        <div>Select an order</div>
      )}
    </>
  );
}
```

**API Endpoints Used:**
- `GET /api/marketplace/orders/:id`
- `POST /api/marketplace/orders/:id/accept`
- `POST /api/marketplace/orders/:id/ship`

---

### 4. MarketplaceApp.jsx
Complete example showing all components integrated with navigation.

**Features:**
- Tab navigation (Dashboard / Orders)
- Route handling between views
- State management for selected order
- Complete workflow example

**Usage:**
```jsx
import MarketplaceApp from './components/MarketplaceApp';

function App() {
  return <MarketplaceApp />;
}
```

---

### 5. ProductMappingTool.jsx
Utility for mapping internal products to Best Buy Marketplace.

**Features:**
- Product listing table with editable fields
- Filter to show only unmapped products
- Individual save per row
- Bulk save for multiple products
- Export to CSV
- Real-time stats (total, mapped, unmapped)
- Pending changes indicator

**Editable Fields:**
- `mirakl_sku` - Mirakl product SKU
- `bestbuy_category_id` - Best Buy category identifier

**Usage:**
```jsx
import ProductMappingTool from './components/ProductMappingTool';

function App() {
  return <ProductMappingTool />;
}
```

**API Endpoints Used:**
- `GET /api/product-mapping` - Get all products with mapping fields
- `PUT /api/product-mapping/:id` - Update single product
- `POST /api/product-mapping/bulk` - Bulk update products

**CSV Export:**
Exports filtered products with columns: ID, SKU, Product Name, Price, Mirakl SKU, Best Buy Category ID

---

## Installation

### 1. Install Dependencies

```bash
npm install axios
```

### 2. Set Environment Variable

Create `.env` file in your React app:

```env
REACT_APP_API_URL=http://localhost:3001
```

Or use the default `http://localhost:3001` if not set.

### 3. Import Components

Copy the components folder to your React project:

```
your-react-app/
├── src/
│   ├── components/
│   │   ├── MarketplaceManager.jsx
│   │   ├── MarketplaceOrders.jsx
│   │   ├── MarketplaceOrderDetail.jsx
│   │   └── MarketplaceApp.jsx
│   └── App.js
```

### 4. Use in Your App

**Option A: Use Complete App**
```jsx
// src/App.js
import MarketplaceApp from './components/MarketplaceApp';

function App() {
  return (
    <div className="App">
      <MarketplaceApp />
    </div>
  );
}

export default App;
```

**Option B: Use Individual Components**
```jsx
// src/App.js
import { useState } from 'react';
import MarketplaceManager from './components/MarketplaceManager';
import MarketplaceOrders from './components/MarketplaceOrders';
import MarketplaceOrderDetail from './components/MarketplaceOrderDetail';

function App() {
  const [view, setView] = useState('dashboard');
  const [orderId, setOrderId] = useState(null);

  return (
    <div className="App">
      {/* Navigation */}
      <nav>
        <button onClick={() => setView('dashboard')}>Dashboard</button>
        <button onClick={() => setView('orders')}>Orders</button>
      </nav>

      {/* Content */}
      {view === 'dashboard' && <MarketplaceManager />}

      {view === 'orders' && !orderId && (
        <MarketplaceOrders onOrderClick={(order) => setOrderId(order.id)} />
      )}

      {view === 'orders' && orderId && (
        <MarketplaceOrderDetail
          orderId={orderId}
          onBack={() => setOrderId(null)}
        />
      )}
    </div>
  );
}

export default App;
```

---

## Styling

All components use inline styles for easy customization. To customize:

### 1. Override Inline Styles
```jsx
<MarketplaceManager style={{ backgroundColor: 'white' }} />
```

### 2. Use CSS Classes
Add className props and style with CSS:

```jsx
// Modify component
<div style={styles.container} className="marketplace-manager">

// Add CSS
.marketplace-manager {
  background-color: white;
  border-radius: 8px;
}
```

### 3. Replace Styles Object
Copy the `styles` object from any component and modify:

```jsx
const customStyles = {
  ...styles,
  button: {
    ...styles.button,
    backgroundColor: 'purple',
  },
};

// Use customStyles instead of styles
```

---

## API Configuration

### Backend Server

Ensure your backend server is running:

```bash
cd backend
npm start
```

Server should be running on `http://localhost:3001` (or your configured port).

### CORS Setup

Make sure your backend allows CORS from your React app:

```javascript
// backend/server.js
const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:3000', // Your React app URL
  credentials: true
}));
```

---

## Features by Component

| Feature | Manager | Orders | Detail | Mapping |
|---------|---------|--------|--------|---------|
| View sync status | ✅ | | | |
| Sync inventory | ✅ | | | |
| Pull orders | ✅ | | | |
| List orders | | ✅ | | |
| Filter orders | | ✅ | | |
| View order detail | | | ✅ | |
| Accept order | | | ✅ | |
| Ship order | | | ✅ | |
| View shipments | | | ✅ | |
| Map products | | | | ✅ |
| Bulk updates | | | | ✅ |
| Export CSV | | | | ✅ |

---

## Example Workflow

1. **Dashboard View**
   - Check sync status
   - See pending orders count
   - Click "Sync Inventory" or "Pull Orders"

2. **Orders List**
   - View all orders
   - Filter by state (WAITING_ACCEPTANCE, SHIPPING, etc.)
   - Click an order to view details

3. **Order Detail**
   - View customer and shipping info
   - Accept order (if pending)
   - Enter tracking info and ship order
   - View shipment history

---

## Troubleshooting

### API Connection Issues

**Problem:** "Failed to fetch..."

**Solutions:**
- Verify backend server is running
- Check `REACT_APP_API_URL` is correct
- Ensure CORS is configured
- Check browser console for errors

### Empty Order List

**Problem:** No orders showing

**Solutions:**
- Click "Pull Orders" on dashboard
- Verify database has orders
- Check filter dropdown (try "All Orders")
- Verify API endpoint returns data

### Ship Order Not Working

**Problem:** Can't ship order

**Solutions:**
- Ensure order state is "SHIPPING"
- Verify order has been accepted
- Enter valid tracking number
- Check carrier is selected

---

## Testing

### Test with Mock Data

```javascript
// Create test component
const TestMarketplace = () => {
  return (
    <div>
      <h1>Testing Marketplace Components</h1>
      <MarketplaceManager />
    </div>
  );
};
```

### Test API Calls

```javascript
// Use browser console
fetch('http://localhost:3001/api/marketplace/sync-status')
  .then(r => r.json())
  .then(data => console.log(data));
```

---

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

---

## Dependencies

- React 16.8+ (hooks required)
- axios (HTTP client)

---

## License

ISC
