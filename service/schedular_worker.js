const { Worker } = require('bullmq');
const redisClient = require('../config/redisConfig');
const { CheckWeatherData, triggerAllDaily } = require('./triggerAllDaily');
//const redisClient = require('../config/redisConnection');

const schedulerWorker = new Worker(
  'schedulerQueue',
  async (job) => {
    console.log(`🕒 Running job ${job.id} at ${job.data.time}, data: ${job.data.data}`);

    //   if( await CheckWeatherData()){
    //     console.log("weather conditions met, proceeding to trigger multicast groups");
    //     await triggerAllDaily(job.data.data);
    //   }
    console.log("this is to check the weather the data group is updating or not",job.data.group)
         await triggerAllDaily(job.data.data, job,job.data.group);
  },
  {
    connection: redisClient, 
  }
);


schedulerWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

schedulerWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err.message);
});
