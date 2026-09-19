import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import { Store } from '../models/Store.model.js';
import { generateUniqueDealerCode } from './referral.helpers.js';

/**
 * Backfill unique dealer codes for any existing dealers or stores that lack one.
 */
export async function backfillDealerCodes(): Promise<void> {
  try {
    const dealersWithoutCode = await User.find({
      role: 'storeAdmin',
      $or: [{ dealerCode: { $exists: false } }, { dealerCode: null }, { dealerCode: '' }],
    });

    for (const dealer of dealersWithoutCode) {
      const code = await generateUniqueDealerCode();
      dealer.dealerCode = code;
      await dealer.save({ validateBeforeSave: false });

      if (dealer.selectedStore) {
        await Store.findByIdAndUpdate(dealer.selectedStore, { dealerCode: code });
      }
      console.log(`[DEALER-CODE] Assigned code ${code} to dealer ${dealer.name} (${dealer.mobile})`);
    }

    const storesWithoutCode = await Store.find({
      $or: [{ dealerCode: { $exists: false } }, { dealerCode: null }, { dealerCode: '' }],
    });

    for (const store of storesWithoutCode) {
      if (store.adminId) {
        const admin = await User.findById(store.adminId);
        if (admin?.dealerCode) {
          store.dealerCode = admin.dealerCode;
          await store.save();
        }
      }
    }
  } catch (err) {
    console.error('[DEALER-CODE] Error in backfillDealerCodes:', err);
  }
}
