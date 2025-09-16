const express = require('express');
const prisma = require('../config/prismaConfig');
const ScheduledTaskDatabase = require('../storingDataFunctions/daySchedular');
const dailySchedularRouter = express.Router();
const { Queue } = require('bullmq');
const { connection } = require('../config/redisConfig');
const schedulerQueue = new Queue('schedulerQueue', { connection });

dailySchedularRouter.post('/schedule', async (req, res) => {
  try {
    const count = await prisma.schedularData.count();

    if (count >= 5) {
      return res.status(400).json({
        success: false,
        message: "You can only schedule a maximum of 3 tasks per day.",
      });
    }

    const { data, time, group } = req.body;

    console.log("Received scheduling request:", { data, time });

    if (!data || !time) {
      return res.status(400).json({
        success: false,
        message: "Data and time are required.",
      });
    }

    const result = await prisma.schedularData.create({
      data: {
        data,
        time,
        group,
      },
    });

    res.status(201).json({
      success: true,
      message: "Task scheduled successfully.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error scheduling task.",
      error: error.message,
    });
  }
});

dailySchedularRouter.get("/schedule", async (req, res) => {
  try {
    const result = await prisma.schedularData.findMany({
      orderBy: {
        time: 'asc',
      },
    });

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No scheduled tasks found.",
      });
    }

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching scheduled tasks.",
      error: error.message,
    });
  }
});

dailySchedularRouter.delete('/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await prisma.schedularData.delete({
      where: {
        id: parseInt(id),
      },
    });

    // Remove job from BullMQ
    const jobs = await schedulerQueue.getRepeatableJobs();
    const job = jobs.find(j => j.id === jobId);
    if (job) await schedulerQueue.removeRepeatableByKey(job.key);

    res.status(200).json({
      success: true,
      message: "Scheduled task deleted successfully.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting scheduled task.",
      error: error.message,
    });
  }
});

dailySchedularRouter.put('/schedule/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, time ,group} = req.body;

    if (!data || !time) {
      return res.status(400).json({
        success: false,
        message: "Data and time are required.",
      });
    }

    const result = await prisma.schedularData.update({
      where: {
        id: parseInt(id),
      },
      data: {
        group,
        data,
        time,
      },
    });

       await ScheduledTaskDatabase() // update the 

    res.status(200).json({
      success: true,
      message: "Scheduled task updated successfully.",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating scheduled task.",
      error: error.message,
    });
  }
});

module.exports = dailySchedularRouter;



/// part 2

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

 /// part 3

 
const apiClient = require("../config/apiClient");
const prisma = require("../config/prismaConfig");
const { weatherData } = require("./weatherConfig");
require('dotenv').config();

async function triggerAllDaily(data,group) {
    try {
        // console.log('🔄 Triggering downlink to all multicast groups');
        // const groupResponse = await apiClient.get('/api/multicast-groups', {
        //     params: {
        //         limit: 100,
        //         applicationId: process.env.APPLICATION_ID,
        //     },
        // });
        // console.log(`Fetched ${groupResponse.data?.result?.length || 0} multicast groups`);

        // const groups = groupResponse.data?.result || [];
        if(!group || group.length ===0){
            console.log("No multicast groups provided to trigger downlink.");
            return;
        }
        console.log(`Proceeding to send downlink to ${group.length} provided multicast groups.`);

        for (const group of group) {
            console.log(`Sending downlink to devices in group: ${group.name} (${group.id})`);

            try {
                const deviceResponse = await apiClient.get('/api/devices', {
                    params: {
                        limit: 1000,
                        applicationId: process.env.APPLICATION_ID,
                        multicastGroupId: group.id,
                    },
                });

                const devices = deviceResponse.data?.result || [];

                console.log(`Fetched ${devices.length} devices from group: ${group.name}`);

                for (const device of devices) {
                    try {
                        await apiClient.post(`/api/devices/${device.devEui}/queue`, {
                            queueItem: {
                                data: data,
                                fCnt: 0,
                                fPort: 1,
                                confirmed: true,
                            },
                        });

                        console.log(`✅ Downlink sent to device ${device.devEui} successfully`);
                    } catch (error) {
                        console.error(`❌ Error sending downlink to device ${device.devEui}:`, error.response?.data || error.message);
                    }
                }

                // Add delay between groups to avoid server overload
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`❌ Error fetching devices for group ${group.name} (${group.id}):`, error.response?.data || error.message);
            }
        }
    } catch (error) {
        console.error('❌ Error fetching multicast groups:', error.response?.data || error.message);
    }
}

async function CheckWeatherData(){
    try {

        const result = await prisma.thresoldWeatherData.findMany({
            orderBy:{createdAt :"desc"},
            select:{
                rain_gauge:true ,
                wind_speed:true,
                wind_speed_level:true,
                wind_direction:true,
                wind_direction_angle:true}
        })

        if(!result ){
            throw new Error("No weather data found");
        }

        if(weatherData.rain_gauge > result.rain_gauge || weatherData.wind_speed > result.wind_speed){
            return false // condition failes not to trigger
        }
        return true // condition satisfies to trigger
        
    } catch (error) {
        console.log("Error on checking weather data:", error.message);
        throw error;
        
    }

}





module.exports= {
    triggerAllDaily,
    CheckWeatherData

};