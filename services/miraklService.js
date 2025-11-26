const axios = require('axios');

/**
 * Best Buy Marketplace (Mirakl) Integration Service
 * Handles offers, orders, and shipment management
 *
 * Updated with:
 * - Full pagination support for orders
 * - Rate limit handling with exponential backoff
 * - Enhanced error handling
 * - Carrier name mapping
 */

class MiraklService {
  constructor() {
    this.apiUrl = process.env.MIRAKL_API_URL;
    this.apiKey = process.env.MIRAKL_API_KEY;
    this.shopId = process.env.MIRAKL_SHOP_ID;

    if (!this.apiUrl || !this.apiKey || !this.shopId) {
      console.warn('⚠️  Mirakl API credentials not configured. Check environment variables.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    // Rate limiting settings
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1 second
  }

  /**
   * Helper to delay execution (for rate limiting)
   * @param {Number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry logic with exponential backoff for rate limits and server errors
   * @param {Function} fn - Async function to retry
   * @param {Number} maxRetries - Maximum retry attempts
   * @returns {Promise} Result of function
   */
  async retryWithBackoff(fn, maxRetries = this.maxRetries) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        const status = error.response?.status;

        // Handle rate limit (429)
        if (status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const waitTime = retryAfter
            ? parseInt(retryAfter) * 1000
            : Math.pow(2, attempt) * this.baseDelay; // Exponential: 2s, 4s, 8s

          if (attempt < maxRetries) {
            console.warn(`⚠️  Rate limit hit. Retrying after ${waitTime/1000}s... (Attempt ${attempt}/${maxRetries})`);
            await this.delay(waitTime);
            continue;
          }
        }

        // Handle server errors (5xx) - retry
        if (status >= 500 && status < 600 && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * this.baseDelay;
          console.warn(`⚠️  Server error (${status}). Retrying after ${waitTime/1000}s... (Attempt ${attempt}/${maxRetries})`);
          await this.delay(waitTime);
          continue;
        }

        // Don't retry client errors (4xx except 429)
        throw error;
      }
    }
  }

  /**
   * Handle Mirakl API errors with specific messages
   * @param {Error} error - Axios error object
   * @param {String} operation - Operation being performed
   */
  handleMiraklError(error, operation) {
    const status = error.response?.status;
    const data = error.response?.data;
    const message = data?.message || data?.error_message || error.message;

    switch (status) {
      case 401:
        throw new Error(`Mirakl authentication failed: Invalid API key for ${operation}`);

      case 403:
        throw new Error(`Mirakl access denied: Check shop permissions for ${operation}`);

      case 404:
        throw new Error(`Mirakl resource not found: ${message || operation}`);

      case 429:
        throw new Error(`Mirakl rate limit exceeded for ${operation}. Try again later.`);

      case 400:
        throw new Error(`Mirakl bad request (${operation}): ${message || 'Invalid data format'}`);

      case 422:
        throw new Error(`Mirakl validation error (${operation}): ${message || 'Data validation failed'}`);

      case 500:
      case 502:
      case 503:
      case 504:
        throw new Error(`Mirakl server error (${operation}): ${message || 'Service temporarily unavailable'}`);

      default:
        throw new Error(`Mirakl ${operation} failed: ${message}`);
    }
  }

  /**
   * Map carrier codes to full names for Mirakl
   * @param {String} carrierCode - Carrier code (e.g., 'UPS')
   * @returns {String} Full carrier name
   */
  getCarrierName(carrierCode) {
    const carriers = {
      'UPS': 'United Parcel Service',
      'USPS': 'United States Postal Service',
      'FEDEX': 'FedEx',
      'FEDEX_GROUND': 'FedEx Ground',
      'FEDEX_EXPRESS': 'FedEx Express',
      'DHL': 'DHL Express',
      'DHL_GLOBAL': 'DHL Global Mail',
      'ONTRAC': 'OnTrac',
      'LASERSHIP': 'LaserShip',
    };

    return carriers[carrierCode] || carrierCode;
  }

  /**
   * Convert cents (database) to dollars (Mirakl)
   * @param {Number} cents - Price in cents
   * @returns {String} Price in dollars formatted to 2 decimals
   */
  centsToDollars(cents) {
    return (cents / 100).toFixed(2);
  }

  /**
   * Convert dollars (Mirakl) to cents (database)
   * @param {Number|String} dollars - Price in dollars
   * @returns {Number} Price in cents
   */
  dollarsToCents(dollars) {
    return Math.round(parseFloat(dollars) * 100);
  }

  /**
   * Sync product offers to Mirakl
   * @param {Array} products - Array of product objects with pricing
   * @returns {Promise<Object>} Response from Mirakl API
   */
  async syncOffers(products) {
    return this.retryWithBackoff(async () => {
      try {
        console.log(`📤 Syncing ${products.length} offers to Mirakl...`);

        const offers = products.map(product => ({
          'product-id': product.mirakl_sku || product.sku,
          'product-id-type': 'SHOP_SKU',
          'offer-id': product.mirakl_offer_id || undefined,
          'shop-id': this.shopId,
          'price': this.centsToDollars(product.price),
          'quantity': product.quantity || 0,
          'state-code': product.quantity > 0 ? '11' : '21', // 11 = Available, 21 = Out of Stock
          'min-quantity-alert': product.min_quantity_alert || 5,
          'available-start-date': product.available_start_date || new Date().toISOString(),
          'description': product.description || '',
          'leadtime-to-ship': product.leadtime_to_ship || 2
        }));

        const response = await this.axiosInstance.post('/api/offers', {
          offers: offers
        });

        console.log(`✅ Offer sync successful. Synced ${products.length} offers.`);
        return response.data;

      } catch (error) {
        console.error('❌ Error syncing offers to Mirakl:', error.response?.data || error.message);
        this.handleMiraklError(error, 'offer sync');
      }
    });
  }

  /**
   * Fetch orders from Mirakl with full pagination support
   * @param {Date|String} lastUpdated - ISO timestamp of last sync
   * @returns {Promise<Array>} Array of all orders
   */
  async fetchOrders(lastUpdated = null) {
    try {
      console.log(`📥 Fetching orders from Mirakl...`);

      let allOrders = [];
      let offset = 0;
      const maxPerPage = 100;
      let hasMore = true;
      let pageNumber = 1;

      while (hasMore) {
        // Fetch page with retry logic
        const pageOrders = await this.retryWithBackoff(async () => {
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

          return {
            orders: response.data.orders || [],
            totalCount: response.data.total_count || 0
          };
        });

        const { orders, totalCount } = pageOrders;

        allOrders = allOrders.concat(orders);

        console.log(`📥 Page ${pageNumber}: Fetched ${orders.length} orders (${allOrders.length}/${totalCount} total)`);

        // Check if there are more orders to fetch
        offset += maxPerPage;
        hasMore = offset < totalCount && orders.length === maxPerPage;
        pageNumber++;

        // Add small delay between paginated requests to avoid rate limits
        if (hasMore) {
          await this.delay(200); // 200ms delay = max 5 requests/second
        }
      }

      console.log(`✅ Fetched ${allOrders.length} orders total from Mirakl`);
      return allOrders;

    } catch (error) {
      console.error('❌ Error fetching orders from Mirakl:', error.response?.data || error.message);
      this.handleMiraklError(error, 'order fetch');
    }
  }

  /**
   * Accept an order
   * @param {String} orderId - Mirakl order ID
   * @param {Array} orderLines - Array of order line objects to accept
   * @returns {Promise<Object>} Response from Mirakl API
   */
  async acceptOrder(orderId, orderLines) {
    return this.retryWithBackoff(async () => {
      try {
        console.log(`✅ Accepting order ${orderId}...`);

        const payload = {
          order_lines: orderLines.map(line => ({
            'order_line_id': line.order_line_id || line.id,
            'accepted': true,
            'can_ship': true
          }))
        };

        const response = await this.axiosInstance.put(`/api/orders/${orderId}/accept`, payload);

        console.log(`✅ Order ${orderId} accepted successfully`);
        return response.data;

      } catch (error) {
        console.error(`❌ Error accepting order ${orderId}:`, error.response?.data || error.message);
        this.handleMiraklError(error, `order acceptance (${orderId})`);
      }
    });
  }

  /**
   * Create a shipment for an order
   * @param {String} orderId - Mirakl order ID
   * @param {String} trackingNumber - Carrier tracking number
   * @param {String} carrierCode - Carrier code (e.g., 'UPS', 'FEDEX', 'USPS')
   * @param {Array} orderLines - Array of order line objects to ship
   * @returns {Promise<Object>} Response from Mirakl API
   */
  async createShipment(orderId, trackingNumber, carrierCode, orderLines) {
    return this.retryWithBackoff(async () => {
      try {
        console.log(`📦 Creating shipment for order ${orderId}...`);

        const payload = {
          'order_id': orderId,
          'tracking_number': trackingNumber,
          'carrier_code': carrierCode,
          'carrier_name': this.getCarrierName(carrierCode), // Use proper carrier name
          'shipping_date': new Date().toISOString(),
          'order_lines': orderLines.map(line => ({
            'order_line_id': line.order_line_id || line.id,
            'quantity': line.quantity || 1
          }))
        };

        const response = await this.axiosInstance.post('/api/shipments', payload);

        console.log(`✅ Shipment created for order ${orderId}. Tracking: ${trackingNumber}`);
        return response.data;

      } catch (error) {
        console.error(`❌ Error creating shipment for order ${orderId}:`, error.response?.data || error.message);
        this.handleMiraklError(error, `shipment creation (${orderId})`);
      }
    });
  }

  /**
   * Get offer details by SKU
   * @param {String} sku - Product SKU
   * @returns {Promise<Object>} Offer details
   */
  async getOfferBySku(sku) {
    return this.retryWithBackoff(async () => {
      try {
        const response = await this.axiosInstance.get('/api/offers', {
          params: {
            'product_id': sku,
            'product_id_type': 'SHOP_SKU'
          }
        });

        return response.data.offers?.[0] || null;

      } catch (error) {
        console.error(`❌ Error fetching offer for SKU ${sku}:`, error.response?.data || error.message);
        this.handleMiraklError(error, `offer fetch (SKU: ${sku})`);
      }
    });
  }

  /**
   * Update offer inventory
   * @param {String} offerId - Mirakl offer ID
   * @param {Number} quantity - New quantity
   * @returns {Promise<Object>} Response from Mirakl API
   */
  async updateInventory(offerId, quantity) {
    return this.retryWithBackoff(async () => {
      try {
        console.log(`📊 Updating inventory for offer ${offerId} to ${quantity}...`);

        const response = await this.axiosInstance.put(`/api/offers/${offerId}`, {
          'quantity': quantity,
          'state-code': quantity > 0 ? '11' : '21'
        });

        console.log(`✅ Inventory updated for offer ${offerId}`);
        return response.data;

      } catch (error) {
        console.error(`❌ Error updating inventory for offer ${offerId}:`, error.response?.data || error.message);
        this.handleMiraklError(error, `inventory update (${offerId})`);
      }
    });
  }

  /**
   * Get configuration info (for debugging)
   * @returns {Object} Configuration status
   */
  getConfig() {
    return {
      configured: !!(this.apiUrl && this.apiKey && this.shopId),
      apiUrl: this.apiUrl,
      shopId: this.shopId,
      hasApiKey: !!this.apiKey,
      maxRetries: this.maxRetries,
      baseDelay: this.baseDelay
    };
  }
}

module.exports = new MiraklService();
