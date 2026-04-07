import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.js';

/**
 * Initialize the email queue using BullMQ.
 * This queue handles sending transactional emails asynchronously.
 */
export const emailQueue = new Queue('email-queue', {
  connection: redisConfig,
});

/**
 * Add an email job to the queue.
 * @param data - The email payload (to, subject, html)
 */
export const addEmailToQueue = async (data: { to: string; subject: string; html: string; category?: string }) => {
  try {
    await emailQueue.add('send-email', data, {
      removeOnComplete: true,
      removeOnFail: { age: 1000 * 60 * 60 * 24 }, // Keep failed jobs for 24h
    });
  } catch (error) {
    console.error('Failed to add job to email queue:', error);
  }
};
