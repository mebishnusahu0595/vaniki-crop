import mongoose from 'mongoose';

export function buildReferralCode(name: string, mobile?: string): string {
  const initial = name ? name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1) : 'V';
  const firstLetter = initial || 'V';
  
  if (mobile && mobile.length >= 3) {
    const mobileSeed = mobile.slice(-3);
    return `${firstLetter}${mobileSeed}`;
  }
  
  const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digits
  return `${firstLetter}${randomSuffix}`;
}

export async function generateUniqueReferralCode(name: string, mobile?: string): Promise<string> {
  let candidate = buildReferralCode(name, mobile);
  let attempt = 0;

  while (true) {
    // Dynamically get models to avoid circular dependencies
    const User = mongoose.models.User;
    const Staff = mongoose.models.Staff;
    
    const userExists = User ? await User.exists({ referralCode: candidate }) : false;
    const staffExists = Staff ? await Staff.exists({ referralCode: candidate }) : false;

    if (!userExists && !staffExists) {
      break;
    }

    attempt += 1;
    const initial = name ? name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 1) : 'V';
    const firstLetter = initial || 'V';
    const randomSuffix = Math.floor(100 + Math.random() * 900); // 3 digits
    candidate = `${firstLetter}${randomSuffix}`;
    
    if (attempt > 20) break; // Safety break
  }

  return candidate;
}

export async function generateUniqueDealerCode(prefix = 'VKD'): Promise<string> {
  const User = mongoose.models.User;
  const count = User ? await User.countDocuments({ role: 'storeAdmin' }) : 0;
  let candidateNumber = 1000 + count + 1;
  let candidate = `${prefix}${candidateNumber}`;
  let attempts = 0;

  while (User && (await User.exists({ dealerCode: candidate }))) {
    candidateNumber += 1;
    candidate = `${prefix}${candidateNumber}`;
    attempts++;
    if (attempts > 500) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      candidate = `${prefix}${rand}`;
      if (!(await User.exists({ dealerCode: candidate }))) break;
    }
  }

  return candidate;
}
