import { AppError } from './AppError.js';

export async function sendOtpViaMessageCentral(mobile: string): Promise<string> {
  const customerId = process.env.MESSAGECENTRAL_CUSTOMER_ID || 'C-4DFEBD5875D1428';
  const authToken = process.env.MESSAGECENTRAL_AUTH_TOKEN || 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLTRERkVCRDU4NzVEMTQyOCIsImlhdCI6MTc3OTI3MzI2NCwiZXhwIjoxOTM2OTUzMjY0fQ.qHz7wdMyrMGsOEuSNM0Ob1sEDEuQSr8b9U1wM6keTHmalnSFJtWpQoITfii3Fvh6A-6afqqS889ouqFLsD7pRA';
  const baseUrl = process.env.MESSAGECENTRAL_BASE_URL || 'https://cpaas.messagecentral.com';

  const url = `${baseUrl}/verification/v3/send?customerId=${customerId}&countryCode=91&flowType=SMS&mobileNumber=${mobile}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authToken': authToken,
        'accept': '*/*'
      }
    });

    const data = await response.json() as any;
    if (data.responseCode !== 200 || !data.data?.verificationId) {
      console.error('MessageCentral send OTP error:', data);
      throw new AppError(data.message || 'Failed to send OTP. Please try again.', 500);
    }

    return data.data.verificationId;
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('MessageCentral send request failed:', error);
    throw new AppError('OTP service currently unavailable. Please try again later.', 503);
  }
}

export async function validateOtpViaMessageCentral(verificationId: string, otp: string): Promise<boolean> {
  const authToken = process.env.MESSAGECENTRAL_AUTH_TOKEN || 'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJDLTRERkVCRDU4NzVEMTQyOCIsImlhdCI6MTc3OTI3MzI2NCwiZXhwIjoxOTM2OTUzMjY0fQ.qHz7wdMyrMGsOEuSNM0Ob1sEDEuQSr8b9U1wM6keTHmalnSFJtWpQoITfii3Fvh6A-6afqqS889ouqFLsD7pRA';
  const baseUrl = process.env.MESSAGECENTRAL_BASE_URL || 'https://cpaas.messagecentral.com';

  const url = `${baseUrl}/verification/v3/validateOtp?verificationId=${verificationId}&code=${otp}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'authToken': authToken,
        'accept': '*/*'
      }
    });

    const data = await response.json() as any;
    if (data.responseCode !== 200) {
      console.error('MessageCentral validate OTP error:', data);
      return false;
    }

    return data.data?.verificationStatus === 'VERIFICATION_COMPLETED';
  } catch (error) {
    console.error('MessageCentral validate request failed:', error);
    return false;
  }
}
