# Mirakl API Implementation Review

## Current Implementation Analysis

### ✅ What's Correct

1. **API Endpoints** - All endpoints match Mirakl's official API:
   - `POST /api/offers` - Create/update offers ✅
   - `GET /api/orders` - Fetch orders ✅
   - `PUT /api/orders/{order_id}/accept` - Accept order ✅
   - `POST /api/shipments` - Create shipment ✅

2. **Headers** - Properly configured:
   - `Authorization: {API_KEY}` ✅
   - `Content-Type: application/json` ✅
   - `Accept: application/json` ✅

3. **Request Structure** - Correct format for:
   - Offer objects with required fields
   - Order line acceptance
   - Shipment creation

---

## ⚠️ Issues Found

### 1. **Pagination Not Fully Implemented** (CRITICAL)

**Current Code (Line 91):**
```javascript
const params = {
  'order_state_codes': 'WAITING_ACCEPTANCE,SHIPPING,SHIPPED,TO_COLLECT',
  'sort': 'dateCreated',
  'max': 100  // ← Only fetches first 100 orders
};
```

**Problem:**
- Mirakl API returns maximum 100 orders per request
- If you have 250 orders, you'll only fetch 100
- Missing orders = unfulfilled customer orders!

**Mirakl Pagination:**
- Uses `offset` parameter: `?max=100&offset=0`, `?max=100&offset=100`, etc.
- OR use `Link` header with `rel="next"` URL
- Response includes `total_count` to know how many iterations needed

**Required Fix:**
Add pagination loop to fetch all orders.

---

### 2. **No Rate Limit Handling** (HIGH PRIORITY)

**Current Code:**
- No handling for HTTP 429 (Too Many Requests)
- Will crash/fail if rate limit hit

**Mirakl Rate Limits:**
- Typical: 10 requests/second per shop
- Returns HTTP 429 with `Retry-After` header
- Should implement exponential backoff

**Required Fix:**
Add retry logic with exponential backoff for 429 errors.

---

### 3. **Error Handling Too Generic** (MEDIUM)

**Current Code (Line 74-75):**
```javascript
catch (error) {
  console.error('❌ Error syncing offers to Mirakl:', error.response?.data || error.message);
  throw new Error(`Mirakl offer sync failed: ${error.response?.data?.message || error.message}`);
}
```

**Problems:**
- Doesn't differentiate error types
- 401 (auth failed) vs 429 (rate limit) vs 500 (server error) all treated the same
- No specific handling for retryable vs non-retryable errors

**Required Fix:**
Enhanced error handling with specific error codes.

---

### 4. **Shipment Payload May Be Incomplete** (LOW)

**Current Code (Line 152-162):**
```javascript
const payload = {
  'order_id': orderId,
  'tracking_number': trackingNumber,
  'carrier_code': carrierCode,
  'carrier_name': carrierCode,  // ← Using code as name
  'shipping_date': new Date().toISOString(),
  'order_lines': orderLines.map(...)
};
```

**Issue:**
- `carrier_name` should be full name (e.g., "United Parcel Service"), not code ("UPS")
- Best Buy may have specific carrier requirements

**Required Fix:**
Add carrier code to name mapping.

---

## 🔧 Required Changes

### Change 1: Implement Full Pagination

**File:** `services/miraklService.js`
**Function:** `fetchOrders()`
**Lines:** 84-109

**Current:**
```javascript
async fetchOrders(lastUpdated = null) {
  const params = {
    'order_state_codes': 'WAITING_ACCEPTANCE,SHIPPING,SHIPPED,TO_COLLECT',
    'sort': 'dateCreated',
    'max': 100
  };

  const response = await this.axiosInstance.get('/api/orders', { params });
  return response.data.orders || [];
}
```

**Recommended:**
```javascript
async fetchOrders(lastUpdated = null) {
  try {
    console.log(`📥 Fetching orders from Mirakl...`);

    let allOrders = [];
    let offset = 0;
    const maxPerPage = 100;
    let hasMore = true;

    while (hasMore) {
      const params = {
        'order_state_codes': 'WAITING_ACCEPTANCE,SHIPPING,SHIPPED,TO_COLLECT',
        'sort': 'dateCreated',
        'max': maxPerPage,
        'offset': offset
      };

      if (lastUpdated) {
        params['start_update_date'] = new Date(lastUpdated).toISOString();
      }

      const response = await this.axiosInstance.get('/api/orders', { params });
      const orders = response.data.orders || [];

      allOrders = allOrders.concat(orders);

      // Check if there are more orders
      const totalCount = response.data.total_count || 0;
      offset += maxPerPage;
      hasMore = offset < totalCount && orders.length === maxPerPage;

      console.log(`📥 Fetched ${orders.length} orders (${allOrders.length}/${totalCount} total)`);

      // Add delay between paginated requests to avoid rate limits
      if (hasMore) {
        await this.delay(200); // 200ms delay = max 5 requests/second
      }
    }

    console.log(`✅ Fetched ${allOrders.length} orders total from Mirakl`);
    return allOrders;

  } catch (error) {
    console.error('❌ Error fetching orders from Mirakl:', error.response?.data || error.message);
    throw new Error(`Mirakl order fetch failed: ${error.response?.data?.message || error.message}`);
  }
}
```

---

### Change 2: Add Rate Limit Handling

**File:** `services/miraklService.js`
**Location:** Add new helper method in class

**Add:**
```javascript
/**
 * Helper to delay execution (for rate limiting)
 */
delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry logic with exponential backoff for rate limits
 */
async retryWithBackoff(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Handle rate limit (429)
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        const waitTime = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, attempt) * 1000; // Exponential: 2s, 4s, 8s

        if (attempt < maxRetries) {
          console.warn(`⚠️  Rate limit hit. Retrying after ${waitTime/1000}s... (Attempt ${attempt}/${maxRetries})`);
          await this.delay(waitTime);
          continue;
        }
      }

      // Handle server errors (5xx) - retry
      if (error.response?.status >= 500 && attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️  Server error. Retrying after ${waitTime/1000}s... (Attempt ${attempt}/${maxRetries})`);
        await this.delay(waitTime);
        continue;
      }

      // Don't retry client errors (4xx except 429)
      throw error;
    }
  }
}
```

**Update all API calls to use retry:**
```javascript
// Example for syncOffers
async syncOffers(products) {
  return this.retryWithBackoff(async () => {
    console.log(`📤 Syncing ${products.length} offers to Mirakl...`);

    const offers = products.map(product => ({ ... }));

    const response = await this.axiosInstance.post('/api/offers', {
      offers: offers
    });

    console.log(`✅ Offer sync successful`);
    return response.data;
  });
}
```

---

### Change 3: Enhanced Error Handling

**Add error categorization:**
```javascript
/**
 * Handle Mirakl API errors with specific messages
 */
handleMiraklError(error, operation) {
  const status = error.response?.status;
  const data = error.response?.data;

  switch (status) {
    case 401:
      throw new Error(`Mirakl authentication failed: Invalid API key`);

    case 403:
      throw new Error(`Mirakl access denied: Check shop permissions`);

    case 404:
      throw new Error(`Mirakl resource not found: ${data?.message || operation}`);

    case 429:
      throw new Error(`Mirakl rate limit exceeded. Try again later.`);

    case 400:
      throw new Error(`Mirakl bad request: ${data?.message || 'Invalid data format'}`);

    case 500:
    case 502:
    case 503:
      throw new Error(`Mirakl server error: ${data?.message || 'Service temporarily unavailable'}`);

    default:
      throw new Error(`Mirakl ${operation} failed: ${data?.message || error.message}`);
  }
}
```

**Use in catch blocks:**
```javascript
catch (error) {
  console.error('❌ Error syncing offers:', error.response?.data || error.message);
  this.handleMiraklError(error, 'offer sync');
}
```

---

### Change 4: Carrier Name Mapping

**Add carrier mapping:**
```javascript
/**
 * Map carrier codes to full names for Mirakl
 */
getCarrierName(carrierCode) {
  const carriers = {
    'UPS': 'United Parcel Service',
    'USPS': 'United States Postal Service',
    'FEDEX': 'FedEx',
    'DHL': 'DHL Express',
  };

  return carriers[carrierCode] || carrierCode;
}
```

**Update createShipment:**
```javascript
async createShipment(orderId, trackingNumber, carrierCode, orderLines) {
  return this.retryWithBackoff(async () => {
    console.log(`📦 Creating shipment for order ${orderId}...`);

    const payload = {
      'order_id': orderId,
      'tracking_number': trackingNumber,
      'carrier_code': carrierCode,
      'carrier_name': this.getCarrierName(carrierCode), // ← Use proper name
      'shipping_date': new Date().toISOString(),
      'order_lines': orderLines.map(line => ({
        'order_line_id': line.order_line_id || line.id,
        'quantity': line.quantity || 1
      }))
    };

    const response = await this.axiosInstance.post('/api/shipments', payload);
    console.log(`✅ Shipment created for order ${orderId}`);
    return response.data;
  });
}
```

---

## 📋 Implementation Priority

### P0 - Critical (Do Immediately)
1. ✅ **Pagination** - You're missing orders!
   - Risk: Unfulfilled customer orders
   - Impact: Lost sales, poor customer experience

### P1 - High (Do Soon)
2. ✅ **Rate Limit Handling** - Prevents failures
   - Risk: Service crashes during high volume
   - Impact: Sync failures, manual intervention needed

### P2 - Medium (Do This Week)
3. ✅ **Error Handling** - Better debugging
   - Risk: Hard to diagnose issues
   - Impact: Slower troubleshooting

### P3 - Low (Nice to Have)
4. ✅ **Carrier Names** - Better data quality
   - Risk: Mirakl may reject or warn
   - Impact: Cleaner data, better reports

---

## 🧪 Testing Recommendations

### 1. Test Pagination
```javascript
// Create 250+ test orders in Mirakl sandbox
// Verify all orders are fetched
const orders = await miraklService.fetchOrders();
console.log(`Fetched ${orders.length} orders`); // Should be 250+, not 100
```

### 2. Test Rate Limiting
```javascript
// Make 20 rapid requests
for (let i = 0; i < 20; i++) {
  await miraklService.fetchOrders();
}
// Should succeed with retries, not fail
```

### 3. Test Error Scenarios
```javascript
// Test with invalid API key
process.env.MIRAKL_API_KEY = 'invalid';
// Should get clear "authentication failed" message

// Test with invalid order ID
await miraklService.acceptOrder('FAKE-123', []);
// Should get clear "not found" message
```

---

## 📊 Summary

| Issue | Severity | Current | Recommended |
|-------|----------|---------|-------------|
| Pagination | CRITICAL | Only first 100 orders | Fetch all with offset loop |
| Rate Limits | HIGH | No handling | Exponential backoff + retry |
| Error Messages | MEDIUM | Generic | Status-code specific |
| Carrier Names | LOW | Uses code | Maps to full names |

**Estimated Fix Time:** 2-3 hours
**Testing Time:** 1 hour
**Risk if Not Fixed:** Lost orders, service failures

---

## 🎯 Next Steps

1. Review recommendations
2. Create updated `miraklService.js` with fixes
3. Test in sandbox environment
4. Deploy to production
5. Monitor for 24 hours

Would you like me to create the updated `miraklService.js` file with all these fixes implemented?
