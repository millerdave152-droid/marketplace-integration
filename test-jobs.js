/**
 * Test Script: Background Jobs
 * Tests marketplace jobs independently
 */

require('dotenv').config();
const { syncInventoryJob, pullOrdersJob } = require('./jobs/marketplaceJobs');

async function testJobs() {
  console.log('\n🧪 Testing Background Jobs...\n');

  try {
    // Test 1: Sync Inventory Job
    console.log('Test 1: Running syncInventoryJob()...');
    console.log('─'.repeat(60));

    const syncResult = await syncInventoryJob();

    console.log('\n📊 Sync Inventory Job Result:');
    console.log(JSON.stringify(syncResult, null, 2));

    if (syncResult.success) {
      console.log('✅ Sync Inventory Job completed successfully');
    } else {
      console.log('⚠️  Sync Inventory Job completed with issues');
    }

    // Test 2: Pull Orders Job
    console.log('\n\nTest 2: Running pullOrdersJob()...');
    console.log('─'.repeat(60));

    const pullResult = await pullOrdersJob();

    console.log('\n📊 Pull Orders Job Result:');
    console.log(JSON.stringify(pullResult, null, 2));

    if (pullResult.success) {
      console.log('✅ Pull Orders Job completed successfully');
    } else {
      console.log('⚠️  Pull Orders Job completed with issues');
    }

    // Summary
    console.log('\n\n📈 Test Summary:');
    console.log('─'.repeat(60));
    console.log(`Sync Inventory Job: ${syncResult.success ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Pull Orders Job: ${pullResult.success ? '✅ PASS' : '❌ FAIL'}`);

    if (syncResult.success && pullResult.success) {
      console.log('\n✅ All background job tests passed!\n');
    } else {
      console.log('\n⚠️  Some jobs encountered issues. Check logs above.\n');
    }

  } catch (error) {
    console.error('\n❌ Job test failed:', error.message);
    console.error('Stack:', error.stack);
  }

  // Exit after tests complete
  process.exit(0);
}

// Run the test
testJobs();
