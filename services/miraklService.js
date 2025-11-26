const axios = require('axios');

/**
 * Best Buy Marketplace (Mirakl) Integration Service
 * Handles offers, orders, and shipment management
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
  }

  /**
   * Convert cents (database) to dollars (Mirakl)
   */
  centsToDollars(cents) {
    return (cents / 100).toFixed(2);
  }

  /**
   * Convert dollars (Mirakl) to cents (database)
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

      console.log(`✅ Offer sync successful. Response:`, response.data);
      return response.data;

    } catch (error) {
      console.error('❌ Error syncing offers to Mirakl:', error.response?.data || error.message);
      throw new Error(`Mirakl offer sync failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Fetch orders from Mirakl
   * @param {Date|String} lastUpdated - ISO timestamp of last sync
   * @returns {Promise<Array>} Array of orders
   */
  async fetchOrders(lastUpdated = null) {
    try {
      console.log(`📥 Fetching orders from Mirakl...`);

      const params = {
        'order_state_codes': 'WAITING_ACCEPTANCE,SHIPPING,SHIPPED,TO_COLLECT',
        'sort': 'dateCreated',
        'max': 100
      };

      if (lastUpdated) {
        params['start_update_date'] = new Date(lastUpdated).toISOString();
      }

      const response = await this.axiosInstance.get('/api/orders', { params });

      const orders = response.data.orders || [];
      console.log(`✅ Fetched ${orders.length} orders from Mirakl`);

      return orders;

    } catch (error) {
      console.error('❌ Error fetching orders from Mirakl:', error.response?.data || error.message);
      throw new Error(`Mirakl order fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Accept an order
   * @param {String} orderId - Mirakl order ID
   * @param {Array} orderLines - Array of order line objects to accept
   * @returns {Promise<Object>} Response from Mirakl API
   */
  async acceptOrder(orderId, orderLines) {
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
      throw new Error(`Mirakl order acceptance failed: ${error.response?.data?.message || error.message}`);
    }
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
    try {
      console.log(`📦 Creating shipment for order ${orderId}...`);

      const payload = {
        'order_id': orderId,
        'tracking_number': trackingNumber,
        'carrier_code': carrierCode,
        'carrier_name': carrierCode,
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
      throw new Error(`Mirakl shipment creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get offer details by SKU
   * @param {String} sku - Product SKU
   * @returns {Promise<Object>} Offer details
   */
  async getOfferBySku(sku) {
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
      throw new Error(`Mirakl offer fetch failed: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Update offer inventory
   * @param {String} offerId - Mirakl offer ID
   * @param {Number} quantity - New quantity
   * @returns {Promise<Object>} Response from Mirakl API
   */
  async updateInventory(offerId, quantity) {
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
      throw new Error(`Mirakl inventory update failed: ${error.response?.data?.message || error.message}`);
    }
  }
}

module.exports = new MiraklService();
