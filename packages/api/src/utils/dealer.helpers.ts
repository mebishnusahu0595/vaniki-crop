import mongoose from 'mongoose';
import { User } from '../models/User.model.js';
import { Store } from '../models/Store.model.js';
import { generateUniqueDealerCode } from './referral.helpers.js';

/**
 * Backfill unique dealer codes for any existing dealers or stores that lack one.
 */
export async function backfillDealerCodes(): Promise<void> {
  try {
    const dealers = await User.find({ role: 'storeAdmin' });

    for (const dealer of dealers) {
      let code = dealer.dealerCode;
      if (!code) {
        code = await generateUniqueDealerCode();
        dealer.dealerCode = code;
      }

      // Extract 4-digit ID
      const match = code.match(/\d{4}$/) || code.match(/\d+/);
      const fourDigitId = match ? match[0] : code;
      dealer.shortCode = fourDigitId;

      // Ensure name has [ID] in front of it so dealer sees it directly in existing app
      const rawName = dealer.name || 'Dealer';
      const cleanName = rawName.replace(/^\[\d+\]\s*/, '').replace(/^\d+\s*-\s*/, '').trim();
      const newName = `[${fourDigitId}] ${cleanName}`;

      if (dealer.name !== newName) {
        dealer.name = newName;
      }

      await dealer.save({ validateBeforeSave: false });

      if (dealer.selectedStore) {
        await Store.findByIdAndUpdate(dealer.selectedStore, { dealerCode: code, shortCode: fourDigitId });
      } else {
        await Store.findOneAndUpdate({ adminId: dealer._id }, { dealerCode: code, shortCode: fourDigitId });
      }

      console.log(`[DEALER-CODE] Dealer: ${dealer.name} | Short ID: ${fourDigitId} | Code: ${code}`);
    }

    const storesWithoutCode = await Store.find({
      $or: [
        { dealerCode: { $exists: false } },
        { dealerCode: null },
        { dealerCode: '' },
        { shortCode: { $exists: false } },
        { shortCode: null },
      ],
    });

    for (const store of storesWithoutCode) {
      if (store.adminId) {
        const admin = await User.findById(store.adminId);
        if (admin?.dealerCode) {
          store.dealerCode = admin.dealerCode;
          store.shortCode = admin.shortCode;
          await store.save();
        }
      }
    }
  } catch (err) {
    console.error('[DEALER-CODE] Error in backfillDealerCodes:', err);
  }
}
