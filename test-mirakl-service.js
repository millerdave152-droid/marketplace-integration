/**
 * Test Script: Mirakl Service
 * Tests price conversion and service initialization
 */

require('dotenv').config();
const miraklService = require('./services/miraklService');

async function testMiraklService() {
  console.log('\n🧪 Testing Mirakl Service...\n');

  try {
    // Test 1: Check configuration
    console.log('Test 1: Checking Mirakl configuration...');
    const apiUrl = process.env.MIRAKL_API_URL;
    const apiKey = process.env.MIRAKL_API_KEY;
    const shopId = process.env.MIRAKL_SHOP_ID;

    if (!apiUrl || !apiKey || !shopId) {
      console.log('⚠️  Mirakl credentials not configured in .env file');
      console.log('   Set MIRAKL_API_URL, MIRAKL_API_KEY, and MIRAKL_SHOP_ID to test API calls');
    } else {
      console.log('✅ Mirakl credentials configured:');
      console.log(`   - API URL: ${apiUrl}`);
      console.log(`   - API Key: ${apiKey.substring(0, 10)}...`);
      console.log(`   - Shop ID: ${shopId}`);
    }

    // Test 2: Price conversion - cents to dollars
    console.log('\nTest 2: Testing centsToDollars conversion...');
    const testCases = [
      { cents: 0, expected: '0.00' },
      { cents: 100, expected: '1.00' },
      { cents: 9999, expected: '99.99' },
      { cents: 12345, expected: '123.45' },
      { cents: 1, expected: '0.01' },
    ];

    let conversionPassed = true;
    testCases.forEach(test => {
      const result = miraklService.centsToDollars(test.cents);
      if (result === test.expected) {
        console.log(`   ✅ ${test.cents} cents → $${result}`);
      } else {
        console.log(`   ❌ ${test.cents} cents → $${result} (expected $${test.expected})`);
        conversionPassed = false;
      }
    });

    if (conversionPassed) {
      console.log('✅ All centsToDollars conversions passed');
    } else {
      console.log('❌ Some centsToDollars conversions failed');
    }

    // Test 3: Price conversion - dollars to cents
    console.log('\nTest 3: Testing dollarsToCents conversion...');
    const dollarTestCases = [
      { dollars: '0.00', expected: 0 },
      { dollars: '1.00', expected: 100 },
      { dollars: '99.99', expected: 9999 },
      { dollars: '123.45', expected: 12345 },
      { dollars: '0.01', expected: 1 },
      { dollars: 99.99, expected: 9999 }, // Test number input
    ];

    let dollarConversionPassed = true;
    dollarTestCases.forEach(test => {
      const result = miraklService.dollarsToCents(test.dollars);
      if (result === test.expected) {
        console.log(`   ✅ $${test.dollars} → ${result} cents`);
      } else {
        console.log(`   ❌ $${test.dollars} → ${result} cents (expected ${test.expected})`);
        dollarConversionPassed = false;
      }
    });

    if (dollarConversionPassed) {
      console.log('✅ All dollarsToCents conversions passed');
    } else {
      console.log('❌ Some dollarsToCents conversions failed');
    }

    // Test 4: Round-trip conversion
    console.log('\nTest 4: Testing round-trip conversion (cents → dollars → cents)...');
    const roundTripTests = [100, 9999, 12345, 1, 50000];

    let roundTripPassed = true;
    roundTripTests.forEach(originalCents => {
      const dollars = miraklService.centsToDollars(originalCents);
      const backToCents = miraklService.dollarsToCents(dollars);
      if (backToCents === originalCents) {
        console.log(`   ✅ ${originalCents} → $${dollars} → ${backToCents}`);
      } else {
        console.log(`   ❌ ${originalCents} → $${dollars} → ${backToCents} (not equal)`);
        roundTripPassed = false;
      }
    });

    if (roundTripPassed) {
      console.log('✅ All round-trip conversions passed');
    } else {
      console.log('❌ Some round-trip conversions failed');
    }

    // Test 5: Service methods exist
    console.log('\nTest 5: Checking service methods...');
    const requiredMethods = [
      'syncOffers',
      'fetchOrders',
      'acceptOrder',
      'createShipment',
      'getOfferBySku',
      'updateInventory'
    ];

    let methodsPassed = true;
    requiredMethods.forEach(method => {
      if (typeof miraklService[method] === 'function') {
        console.log(`   ✅ ${method}() method exists`);
      } else {
        console.log(`   ❌ ${method}() method not found`);
        methodsPassed = false;
      }
    });

    if (methodsPassed) {
      console.log('✅ All required methods exist');
    } else {
      console.log('❌ Some required methods missing');
    }

    if (!apiUrl || !apiKey || !shopId) {
      console.log('\n⚠️  To test API calls, configure Mirakl credentials in .env');
      console.log('   Add:');
      console.log('   MIRAKL_API_URL=https://bestbuy-us-sandbox.mirakl.net');
      console.log('   MIRAKL_API_KEY=your_api_key');
      console.log('   MIRAKL_SHOP_ID=your_shop_id');
    }

    console.log('\n✅ Mirakl Service tests completed!\n');

  } catch (error) {
    console.error('\n❌ Mirakl Service test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testMiraklService();
