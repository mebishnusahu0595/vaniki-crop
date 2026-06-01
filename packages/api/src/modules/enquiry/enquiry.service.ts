import { Enquiry } from '../../models/Enquiry.model.js';

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

  return await enquiry.save();
}
