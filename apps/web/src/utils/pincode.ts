export interface PincodeData {
  district: string;
  state: string;
  area: string;
  block: string;
}

export async function lookupPincode(pincode: string): Promise<PincodeData | null> {
  if (!/^\d{6}$/.test(pincode)) return null;

  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
    const data = await response.json();

    if (data[0]?.Status === 'Success') {
      const postOffice = data[0].PostOffice[0];
      return {
        district: postOffice.District,
        state: postOffice.State,
        area: postOffice.Name,
        block: postOffice.Block,
      };
    }
  } catch (error) {
    console.error('Error looking up pincode:', error);
  }

  return null;
}
