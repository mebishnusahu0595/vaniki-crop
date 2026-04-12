import { Store, type IStore } from '../../models/Store.model.js';
import { User } from '../../models/User.model.js';
import { AppError } from '../../utils/AppError.js';

const PLACEHOLDER_ADDRESS_VALUES = new Set(['pending', 'na', 'n/a', 'none', 'null', 'undefined']);

function normalizeAddressValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function hasMeaningfulPickupAddress(address: IStore['address'] | undefined | null): boolean {
  if (!address) return false;

  const street = normalizeAddressValue(address.street);
  const city = normalizeAddressValue(address.city);
  const state = normalizeAddressValue(address.state);
  const pincode = normalizeAddressValue(address.pincode);

  if (!street || !city || !state || !pincode) {
    return false;
  }

  if (PLACEHOLDER_ADDRESS_VALUES.has(city) || PLACEHOLDER_ADDRESS_VALUES.has(state)) {
    return false;
  }

  if (pincode === '000000') {
    return false;
  }

  return true;
}

async function getApprovedActiveStoreAdminIds() {
  const approvedAdmins = await User.find({
    role: 'storeAdmin',
    isActive: true,
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false } },
      { approvalStatus: null },
    ],
  }).select('_id');

  return approvedAdmins.map((admin) => admin._id);
}

async function isSelectableStoreForPickup(store: Pick<IStore, 'adminId' | 'address'>): Promise<boolean> {
  if (!hasMeaningfulPickupAddress(store.address)) {
    return false;
  }

  const approvedAdmin = await User.findOne({
    _id: store.adminId,
    role: 'storeAdmin',
    isActive: true,
    $or: [
      { approvalStatus: 'approved' },
      { approvalStatus: { $exists: false } },
      { approvalStatus: null },
    ],
  }).select('_id');

  return Boolean(approvedAdmin);
}

async function resolveStoreAdminScope(userStoreId?: string, userId?: string): Promise<string | undefined> {
  if (userStoreId) return userStoreId;
  if (!userId) return undefined;

  const ownedStore = await Store.findOne({ adminId: userId }).select('_id');
  return ownedStore?._id.toString();
}

/**
 * Public listing of all active stores for store selection.
 */
export async function listActiveStores() {
  const approvedAdminIds = await getApprovedActiveStoreAdminIds();
  if (!approvedAdminIds.length) {
    return [];
  }

  const stores = await Store.find({
    isActive: true,
    adminId: { $in: approvedAdminIds },
  })
    .select('name address phone location openHours')
    .sort({ name: 1 });

  return stores.filter((store) => hasMeaningfulPickupAddress(store.address));
}

/**
 * Detail of a specific store.
 */
export async function getStoreDetail(id: string) {
  const store = await Store.findById(id);
  if (!store || !store.isActive || !(await isSelectableStoreForPickup(store))) {
    throw new AppError('Store not found or inactive', 404);
  }
  return store;
}

/**
 * Creates a new store (SuperAdmin).
 */
export async function createStore(data: any) {
  // Check if admin user exists and is a storeAdmin
  const admin = await User.findById(data.adminId);
  if (!admin) {
    throw new AppError('Assigned admin user not found', 404);
  }
  if (admin.role !== 'storeAdmin') {
    throw new AppError('Assigned user must have "storeAdmin" role', 400);
  }

  const store = await Store.create(data);
  return store;
}

/**
 * Updates store information.
 */
export async function updateStore(id: string, data: any) {
  if (data.adminId) {
    const admin = await User.findById(data.adminId);
    if (!admin || admin.role !== 'storeAdmin') {
      throw new AppError('Invalid admin assigned to store', 400);
    }
  }

  const store = await Store.findByIdAndUpdate(id, data, { new: true, runValidators: true });
  if (!store) {
    throw new AppError('Store not found', 404);
  }
  return store;
}

/**
 * Soft-deactivates a store.
 */
export async function deactivateStore(id: string) {
  const store = await Store.findByIdAndUpdate(id, { isActive: false }, { new: true });
  if (!store) {
    throw new AppError('Store not found', 404);
  }
  return store;
}

/**
 * Persists the user's selected store in the database.
 */
export async function selectStoreForUser(userId: string, storeId: string) {
  const store = await Store.findOne({ _id: storeId, isActive: true }).select('name address adminId');
  if (!store || !(await isSelectableStoreForPickup(store))) {
    throw new AppError('Cannot select an invalid or inactive store', 400);
  }

  await User.findByIdAndUpdate(userId, { selectedStore: storeId });
  return { success: true, storeName: store.name };
}

export async function getAdminOwnStore(userStoreId?: string, userId?: string) {
  const resolvedStoreId = await resolveStoreAdminScope(userStoreId, userId);
  if (!resolvedStoreId) {
    throw new AppError('No store assigned to this admin account', 400);
  }

  const store = await Store.findById(resolvedStoreId).populate('adminId', 'name email mobile');
  if (!store) {
    throw new AppError('Store not found', 404);
  }
  return store;
}

export async function updateAdminOwnStore(userStoreId: string | undefined, userId: string | undefined, data: any) {
  const resolvedStoreId = await resolveStoreAdminScope(userStoreId, userId);
  if (!resolvedStoreId) {
    throw new AppError('No store assigned to this admin account', 400);
  }

  const store = await Store.findByIdAndUpdate(resolvedStoreId, data, {
    new: true,
    runValidators: true,
  }).populate('adminId', 'name email mobile');

  if (!store) {
    throw new AppError('Store not found', 404);
  }

  return store;
}
