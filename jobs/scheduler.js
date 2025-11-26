const cron = require('node-cron');
const { syncInventoryJob, pullOrdersJob } = require('./marketplaceJobs');

/**
 * Marketplace Job Scheduler
 * Schedules background tasks for inventory sync and order processing
 */

let inventorySyncTask = null;
let orderPullTask = null;

/**
 * Start the scheduled jobs
 */
function startScheduler() {
  // Check if Mirakl API credentials are configured
  if (!process.env.MIRAKL_API_KEY) {
    console.log('⚠️  Mirakl API key not configured. Marketplace jobs will not be scheduled.');
    console.log('   Set MIRAKL_API_KEY, MIRAKL_API_URL, and MIRAKL_SHOP_ID to enable.');
    return;
  }

  console.log('\n🚀 Starting Marketplace Job Scheduler...\n');

  // Schedule inventory sync every 30 minutes
  inventorySyncTask = cron.schedule('*/30 * * * *', async () => {
    console.log('🔄 Triggered: Inventory Sync Job');
    try {
      await syncInventoryJob();
    } catch (error) {
      console.error('❌ Inventory sync job crashed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust timezone as needed
  });

  console.log('✅ Scheduled: Inventory Sync Job - Every 30 minutes (*/30 * * * *)');

  // Schedule order pull every 15 minutes
  orderPullTask = cron.schedule('*/15 * * * *', async () => {
    console.log('🔄 Triggered: Order Pull Job');
    try {
      await pullOrdersJob();
    } catch (error) {
      console.error('❌ Order pull job crashed:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York' // Adjust timezone as needed
  });

  console.log('✅ Scheduled: Order Pull Job - Every 15 minutes (*/15 * * * *)');

  console.log('\n📅 Marketplace jobs are now running on schedule.');
  console.log('   Next inventory sync: ' + getNextRunTime(inventorySyncTask));
  console.log('   Next order pull: ' + getNextRunTime(orderPullTask));
  console.log('');

  // Run initial sync on startup (optional - uncomment if desired)
  // console.log('🏃 Running initial sync on startup...\n');
  // setTimeout(async () => {
  //   await pullOrdersJob();
  //   await syncInventoryJob();
  // }, 5000); // Wait 5 seconds after startup
}

/**
 * Stop all scheduled jobs
 */
function stopScheduler() {
  console.log('\n⏹️  Stopping Marketplace Job Scheduler...\n');

  if (inventorySyncTask) {
    inventorySyncTask.stop();
    console.log('⏹️  Stopped: Inventory Sync Job');
  }

  if (orderPullTask) {
    orderPullTask.stop();
    console.log('⏹️  Stopped: Order Pull Job');
  }

  console.log('\n✅ All marketplace jobs stopped.\n');
}

/**
 * Get next scheduled run time (helper function)
 */
function getNextRunTime(task) {
  if (!task) return 'N/A';

  // node-cron doesn't expose next run time directly
  // This is a placeholder - you can use a library like 'cron-parser' for precise times
  return 'Next scheduled run';
}

/**
 * Run a specific job manually
 */
async function runJobManually(jobName) {
  console.log(`\n🏃 Manually running: ${jobName}\n`);

  try {
    if (jobName === 'inventory-sync' || jobName === 'sync') {
      return await syncInventoryJob();
    } else if (jobName === 'order-pull' || jobName === 'orders') {
      return await pullOrdersJob();
    } else {
      throw new Error(`Unknown job: ${jobName}. Use 'inventory-sync' or 'order-pull'`);
    }
  } catch (error) {
    console.error(`❌ Manual job execution failed:`, error.message);
    throw error;
  }
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    running: !!(inventorySyncTask || orderPullTask),
    inventorySyncActive: inventorySyncTask ? true : false,
    orderPullActive: orderPullTask ? true : false,
    apiConfigured: !!process.env.MIRAKL_API_KEY
  };
}

module.exports = {
  startScheduler,
  stopScheduler,
  runJobManually,
  getSchedulerStatus
};
