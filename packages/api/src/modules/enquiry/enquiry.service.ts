import { Enquiry } from '../../models/Enquiry.model.js';
import { triggerEnquiryNotifications } from '../../utils/pushNotifications.js';

export interface CreateEnquiryInput {
  name: string;
  mobile: string;
  category: string;
  ipAddress?: string;
}

export async function submitEnquiry(input: CreateEnquiryInput): Promise<any> {
  const enquiry = new Enquiry({
    name: input.name,
    mobile: input.mobile,
    category: input.category,
    ipAddress: input.ipAddress,
  });

  const saved = await enquiry.save();
  
  // Trigger notifications asynchronously
  triggerEnquiryNotifications(saved).catch(err => {
    console.error('[PUSH] Failed to trigger enquiry notifications:', err);
  });

  return saved;
}
