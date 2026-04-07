import { Worker, type Job } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import { transporter } from '../config/mail.js';

/**
 * Worker to process jobs from the email queue.
 */
const emailWorker = new Worker(
  'email-queue',
  async (job: Job) => {
    const { to, subject, html } = job.data;
    
    try {
      console.log(`[EMAIL WORKER] Processing job ${job.id} for ${to}`);
      
      const info = await transporter.sendMail({
        from: `"${process.env.STORE_NAME || 'Vaniki Crop'}" <${process.env.SMTP_FROM || 'no-reply@vanikicrop.com'}>`,
        to,
        subject,
        html,
      });
      
      console.log(`[EMAIL WORKER] Email sent: ${info.messageId}`);
    } catch (error) {
      console.error(`[EMAIL WORKER] Job ${job.id} failed:`, error);
      throw error; // Let BullMQ handle re-attempts if needed
    }
  },
  {
    connection: redisConfig,
    concurrency: 5,
  }
);

emailWorker.on('completed', (job) => {
  console.log(`[EMAIL WORKER] Job ${job.id} completed successfully`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`[EMAIL WORKER] Job ${job?.id} failed:`, err);
});

export { emailWorker };
