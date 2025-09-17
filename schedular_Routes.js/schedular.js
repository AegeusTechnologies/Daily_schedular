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
