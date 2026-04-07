import nodemailer from 'nodemailer';

/**
 * Initialize Nodemailer transport based on environment variables.
 */
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

/**
 * Verify transport connection at startup.
 */
transporter.verify((error, success) => {
  if (error) {
    console.warn('Mail transporter verification failed:', error.message);
  } else {
    console.log('Mail transporter is ready to send messages');
  }
});

export { transporter };
