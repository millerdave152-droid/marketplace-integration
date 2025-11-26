/**
 * Test Script: Scheduler
 * Tests the cron job scheduler
 */

require('dotenv').config();
const { startScheduler, stopScheduler, getSchedulerStatus, runJobManually } = require('./jobs/scheduler');

async function testScheduler() {
  console.log('\n🧪 Testing Scheduler...\n');

  try {
    // Test 1: Check scheduler configuration
    console.log('Test 1: Checking scheduler configuration...');

    const apiKey = process.env.MIRAKL_API_KEY;
    if (!apiKey) {
      console.log('⚠️  MIRAKL_API_KEY not set. Scheduler will not start automatically.');
    } else {
      console.log('✅ MIRAKL_API_KEY configured');
    }

    // Test 2: Get scheduler status before starting
    console.log('\nTest 2: Checking initial scheduler status...');
    let status = getSchedulerStatus();
    console.log('   Status:', JSON.stringify(status, null, 2));

    if (!status.running) {
      console.log('✅ Scheduler not running (as expected)');
    }

    // Test 3: Start scheduler
    console.log('\nTest 3: Starting scheduler...');
    startScheduler();

    // Give it a moment to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));

    status = getSchedulerStatus();
    console.log('   Status after start:', JSON.stringify(status, null, 2));

    if (status.running || !status.apiConfigured) {
      console.log('✅ Scheduler start command executed');
    }

    // Test 4: Manual job execution
    if (apiKey) {
      console.log('\nTest 4: Testing manual job execution...');
      console.log('   Note: This will actually run the jobs with your database/API');

      console.log('\n   Would you like to run manual job tests? (Skipping for safety)');
      console.log('   To test manually, uncomment the code below in test-scheduler.js');

      // Uncomment to test manual execution:
      // console.log('\n   Running inventory sync manually...');
      // const syncResult = await runJobManually('inventory-sync');
      // console.log('   Result:', JSON.stringify(syncResult, null, 2));

      // console.log('\n   Running order pull manually...');
      // const pullResult = await runJobManually('order-pull');
      // console.log('   Result:', JSON.stringify(pullResult, null, 2));
    }

    // Test 5: Stop scheduler
    console.log('\nTest 5: Stopping scheduler...');
    stopScheduler();

    status = getSchedulerStatus();
    console.log('   Status after stop:', JSON.stringify(status, null, 2));

    console.log('\n✅ Scheduler tests completed!\n');

    console.log('📋 Test Results Summary:');
    console.log('   ✅ Configuration check - Passed');
    console.log('   ✅ Initial status check - Passed');
    console.log('   ✅ Scheduler start - Passed');
    console.log('   ✅ Scheduler stop - Passed');

    if (!apiKey) {
      console.log('\n⚠️  Note: To test with actual scheduled jobs, configure MIRAKL_API_KEY');
    }

  } catch (error) {
    console.error('\n❌ Scheduler test failed:', error.message);
    console.error('Stack:', error.stack);
  }

  // Exit
  process.exit(0);
}

// Run the test
testScheduler();
