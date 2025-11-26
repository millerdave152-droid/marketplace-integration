/**
 * Master Test Runner
 * Runs all marketplace integration tests in sequence
 */

const { execSync } = require('child_process');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('   MARKETPLACE INTEGRATION - COMPLETE TEST SUITE');
console.log('═══════════════════════════════════════════════════════════\n');

const tests = [
  {
    name: 'Migration Test',
    command: 'node test-migration.js',
    description: 'Verifies database tables and schema'
  },
  {
    name: 'Mirakl Service Test',
    command: 'node test-mirakl-service.js',
    description: 'Tests price conversions and service methods'
  },
  {
    name: 'Background Jobs Test',
    command: 'node test-jobs.js',
    description: 'Tests inventory sync and order pull jobs'
  },
  {
    name: 'Scheduler Test',
    command: 'node test-scheduler.js',
    description: 'Tests cron job scheduler functionality'
  }
];

let passed = 0;
let failed = 0;

async function runTests() {
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];

    console.log(`\n[${ i + 1}/${tests.length}] Running: ${test.name}`);
    console.log(`Description: ${test.description}`);
    console.log('─'.repeat(60));

    try {
      execSync(test.command, { stdio: 'inherit', cwd: __dirname });
      console.log(`\n✅ ${test.name} - PASSED\n`);
      passed++;
    } catch (error) {
      console.log(`\n❌ ${test.name} - FAILED\n`);
      failed++;
    }
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('   TEST SUITE SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);

  if (failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED!\n');
  } else {
    console.log(`\n⚠️  ${failed} test(s) failed. Review logs above.\n`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  // Manual Test Instructions
  console.log('📋 MANUAL TESTING INSTRUCTIONS:\n');
  console.log('1. Start test server:');
  console.log('   node test-server.js\n');
  console.log('2. Test endpoints with curl:');
  console.log('   curl http://localhost:3002/health');
  console.log('   curl http://localhost:3002/api/marketplace/sync-status\n');
  console.log('3. See README.md for complete API testing guide\n');
}

runTests();
