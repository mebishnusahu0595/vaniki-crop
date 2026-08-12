import { transporter } from '../../config/mail.js';
import { AppError } from '../../utils/AppError.js';
import type { CreateContactInput } from './contact.validator.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function submitContact(input: CreateContactInput): Promise<void> {
  const defaultRecipient = 'vaniki.crop@gmail.com';
  const configuredFrom = process.env.SMTP_FROM || process.env.SMTP_USER || defaultRecipient;
  const recipients = process.env.SMTP_FROM ? [process.env.SMTP_FROM, defaultRecipient] : [defaultRecipient];

  const submittedAt = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  const detailRows = [
    ['Name', escapeHtml(input.name)],
    ['Email', escapeHtml(input.email)],
    ['Mobile', escapeHtml(input.mobile || 'Not provided')],
    ['Subject', escapeHtml(input.subject)],
    ['Submitted At', escapeHtml(submittedAt)],
  ]
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding: 10px 12px; border: 1px solid #dcefe4; font-weight: 700; width: 160px;">${label}</td>
          <td style="padding: 10px 12px; border: 1px solid #dcefe4;">${value}</td>
        </tr>
      `,
    )
    .join('');

  const escapedMessage = escapeHtml(input.message).replaceAll('\n', '<br />');

  try {
    await transporter.sendMail({
      from: configuredFrom,
      to: recipients.join(', '),
      replyTo: input.email,
      subject: `New Contact Form Submission: ${input.subject}`,
      text: [
        'New Contact Form Submission',
        `Name: ${input.name}`,
        `Email: ${input.email}`,
        `Mobile: ${input.mobile || 'Not provided'}`,
        `Subject: ${input.subject}`,
        `Submitted At: ${submittedAt}`,
        '',
        'Message:',
        input.message,
      ].join('\n'),
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #143d2e;">
          <h2 style="margin-bottom: 14px;">New Contact Form Submission</h2>
          <table style="border-collapse: collapse; width: 100%; margin-top: 12px;">
            <tbody>
              ${detailRows}
            </tbody>
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #f0faf5; border-radius: 12px; border: 1px solid #dcefe4;">
            <p style="margin: 0 0 8px; font-weight: 700;">Message</p>
            <p style="margin: 0;">${escapedMessage}</p>
          </div>
        </div>
      `,
    });
  } catch (error) {
    console.error('SMTP Mail Sending Error:', error);
    // If SMTP is not configured on local dev, log details cleanly without crashing user request
    console.log('--- CONTACT FORM SUBMISSION RECEIVED ---');
    console.log(`To: vaniki.crop@gmail.com | From: ${input.email}`);
    console.log(`Subject: ${input.subject}`);
    console.log(`Message: ${input.message}`);
    console.log('----------------------------------------');
  }
}
