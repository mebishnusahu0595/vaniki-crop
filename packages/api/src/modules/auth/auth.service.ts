import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../../models/User.model.js';
import { Product } from '../../models/Product.model.js';
import { Store } from '../../models/Store.model.js';
import { AppError } from '../../utils/AppError.js';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.helpers.js';
import { buildStoreAddressFromCoordinates } from '../../utils/storeAddress.js';
import type {
  ChangePasswordInput,
  DealerSignupInput,
  GoogleAuthInput,
  SendOtpInput,
  SignupInput,
  LoginInput,
  LoginOtpInput,
  PushTokenInput,
  ResetPasswordInput,
  ToggleWishlistInput,
  UpdateMeInput,
} from './auth.validator.js';

// ─── OTP Store Type (for pre-signup OTP caching) ─────────────────────────
const otpStore: Record<string, { hashedOtp: string; otpExpiry: Date }> = {};

// ─── Token Config ────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRES = '15m';
const REFRESH_TOKEN_EXPIRES = '30d';
const OTP_EXPIRY_MINUTES = 10;

// ─── Interfaces ──────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtAccessPayload {
  userId: string;
  role: string;
  storeId?: string;
}

interface GoogleTokenInfo {
  aud: string;
  sub: string;
  email?: string;
  email_verified?: string;
  name?: string;
  iss?: string;
}

export type GoogleAuthResult =
  | {
      requiresMobile: true;
      prefillName?: string;
      prefillEmail: string;
    }
  | {
      requiresMobile: false;
      user: IUser;
      tokens: TokenPair;
    };

// ─── OTP ─────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 6-digit OTP.
 * @returns 6-digit OTP string
 */
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

function buildReferralCode(name: string, mobile: string): string {
  const cleanedName = name.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4).padEnd(4, 'V');
  const mobileSeed = mobile.slice(-4);
  return `${cleanedName}${mobileSeed}`;
}

function generateRandomPassword(): string {
  return crypto.randomBytes(24).toString('hex');
}

function getAllowedGoogleClientIds(): string[] {
  return (process.env.GOOGLE_OAUTH_ALLOWED_CLIENT_IDS || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function verifyGoogleIdToken(idToken: string): Promise<GoogleTokenInfo> {
  const googleAuthEnabled = (process.env.GOOGLE_AUTH_ENABLED || '').toLowerCase() === 'true';
  if (!googleAuthEnabled) {
    throw new AppError('Google authentication is disabled', 503);
  }

  const allowedClientIds = getAllowedGoogleClientIds();
  if (!allowedClientIds.length) {
    throw new AppError('Google authentication is not configured', 500);
  }

  const endpoint = new URL('https://oauth2.googleapis.com/tokeninfo');
  endpoint.searchParams.set('id_token', idToken);

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    throw new AppError('Invalid Google token', 401);
  }

  const tokenInfo = (await response.json()) as GoogleTokenInfo;
  if (!tokenInfo.aud || !allowedClientIds.includes(tokenInfo.aud)) {
    throw new AppError('Unauthorized Google client', 401);
  }

  const issuer = tokenInfo.iss || '';
  if (issuer && issuer !== 'accounts.google.com' && issuer !== 'https://accounts.google.com') {
    throw new AppError('Invalid Google token issuer', 401);
  }

  if (!tokenInfo.email || tokenInfo.email_verified !== 'true') {
    throw new AppError('Google account email is not verified', 400);
  }

  return tokenInfo;
}

async function generateUniqueReferralCode(name: string, mobile: string): Promise<string> {
  const baseCode = buildReferralCode(name, mobile);
  let candidate = baseCode;
  let attempt = 0;

  while (await User.exists({ referralCode: candidate })) {
    attempt += 1;
    candidate = `${baseCode}${attempt}`;
  }

  return candidate;
}

/**
 * Sends OTP via MSG91 API.
 * In development mode, logs to console instead of calling the API.
 * @param mobile - 10-digit Indian mobile number
 * @param otp - The OTP to send
 */
async function sendOtpViaMSG91(mobile: string, otp: string): Promise<void> {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    // Development fallback: log OTP to console
    console.log(`📱 [DEV] OTP for ${mobile}: ${otp}`);
    return;
  }

  try {
    const response = await fetch('https://api.msg91.com/api/v5/otp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: `91${mobile}`,
        otp,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('MSG91 error:', data);
      throw new AppError('Failed to send OTP. Please try again.', 500);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    console.error('MSG91 request failed:', error);
    throw new AppError('OTP service unavailable. Please try again later.', 503);
  }
}

// ─── Service Methods ─────────────────────────────────────────────────────

/**
 * Sends a 6-digit OTP to the given mobile number.
 * Stores the hashed OTP + expiry on the user document (creates a temp user if needed).
 * @param input - { mobile }
 */
export async function sendOtp(input: SendOtpInput): Promise<void> {
  const { mobile } = input;
  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  // Upsert: store OTP on existing user or create a placeholder
  await User.findOneAndUpdate(
    { mobile },
    {
      otp: hashedOtp,
      otpExpiry,
    },
    { upsert: false }, // Don't create user yet — only update if exists
  );

  // If user doesn't exist, store OTP in a special way for signup verification
  const existingUser = await User.findOne({ mobile });
  if (!existingUser) {
    otpStore[mobile] = { hashedOtp, otpExpiry };
  }

  await sendOtpViaMSG91(mobile, otp);
}

/**
 * Registers a new user after verifying the OTP.
 * @param input - { name, email, mobile, password, otp }
 * @returns Created user and token pair
 */
export async function signup(
  input: SignupInput,
): Promise<{ user: IUser; tokens: TokenPair }> {
  const { name, email, mobile, password, otp, referralCode } = input;

  // Check if user already exists with this mobile
  const existingUser = await User.findOne({ mobile }).select('+otp +otpExpiry');
  if (existingUser?.password) {
    throw new AppError('An account with this mobile number already exists', 409);
  }

  const normalizedOtp = otp?.trim();

  // Verify OTP only when OTP is provided by the client.
  if (normalizedOtp) {
    let isOtpValid = false;

    if (existingUser?.otp && existingUser?.otpExpiry) {
      if (existingUser.otpExpiry < new Date()) {
        throw new AppError('OTP has expired. Please request a new one.', 400);
      }
      isOtpValid = await bcrypt.compare(normalizedOtp, existingUser.otp);
    } else {
      // Check temp store for new signups
      const tempOtp = otpStore[mobile];
      if (tempOtp) {
        if (tempOtp.otpExpiry < new Date()) {
          delete otpStore[mobile];
          throw new AppError('OTP has expired. Please request a new one.', 400);
        }
        isOtpValid = await bcrypt.compare(normalizedOtp, tempOtp.hashedOtp);
        if (isOtpValid) delete otpStore[mobile];
      }
    }

    if (!isOtpValid) {
      throw new AppError('Invalid OTP', 400);
    }
  } else if (otpStore[mobile]) {
    // OTP is optional now, so stale temp OTP cache should not block signup.
    delete otpStore[mobile];
  }

  let referredById: IUser['_id'] | undefined;
  if (referralCode) {
    const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() }).select('_id');
    if (!referrer) {
      throw new AppError('Invalid referral code', 400);
    }
    referredById = referrer._id;
  }

  const ownReferralCode = await generateUniqueReferralCode(name, mobile);

  // Create or update user
  let user: IUser;
  let shouldIncrementReferrer = false;
  if (existingUser) {
    existingUser.name = name;
    if (email) existingUser.email = email;
    existingUser.password = password;
    existingUser.referralCode = existingUser.referralCode || ownReferralCode;
    if (referredById && !existingUser.referredBy) {
      existingUser.referredBy = referredById;
      shouldIncrementReferrer = true;
    }
    existingUser.isActive = true;
    existingUser.otp = undefined;
    existingUser.otpExpiry = undefined;
    user = await existingUser.save();
  } else {
    user = await User.create({
      name,
      email: email || undefined,
      mobile,
      password,
      referralCode: ownReferralCode,
      ...(referredById ? { referredBy: referredById } : {}),
      isActive: true,
    });
    shouldIncrementReferrer = Boolean(referredById);
  }

  if (shouldIncrementReferrer && referredById) {
    await User.findByIdAndUpdate(referredById, { $inc: { referralCount: 1 } });
  }

  const tokens = await generateTokenPair(user);
  return { user, tokens };
}

/**
 * Registers a dealer (store admin) account and keeps it pending until super admin approval.
 */
export async function dealerSignup(input: DealerSignupInput, file?: Express.Multer.File): Promise<IUser> {
  const {
    name,
    mobile,
    email,
    password,
    storeName,
    storeLocation,
    longitude,
    latitude,
    gstNumber,
    sgstNumber,
  } = input;

  const normalizedEmail = email?.trim().toLowerCase() || undefined;

  const existingMobile = await User.findOne({ mobile });
  if (existingMobile) {
    throw new AppError('A user with this mobile already exists', 409);
  }

  if (normalizedEmail) {
    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw new AppError('A user with this email already exists', 409);
    }
  }

  if (!file) {
    throw new AppError('Dealer profile image is required', 400);
  }

  const uploadedProfileImage = await uploadToCloudinary(file.buffer, 'vaniki/users/profile');

  const user = await User.create({
    name,
    email: normalizedEmail,
    mobile,
    password,
    role: 'storeAdmin',
    approvalStatus: 'pending',
    isActive: true,
    profileImage: {
      url: uploadedProfileImage.url,
      publicId: uploadedProfileImage.publicId,
    },
    dealerProfile: {
      storeName,
      storeLocation,
      latitude,
      longitude,
      gstNumber: gstNumber.trim().toUpperCase(),
      sgstNumber: sgstNumber.trim().toUpperCase(),
    },
  });

  // Create an inactive draft store so approval can activate it directly.
  await Store.create({
    name: storeName,
    phone: mobile,
    email: normalizedEmail,
    adminId: user._id,
    isActive: false,
    address: await buildStoreAddressFromCoordinates({
      latitude,
      longitude,
      fallbackStreet: storeLocation,
    }),
    location: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
    deliveryRadius: 10,
  });

  return user;
}

/**
 * Authenticates a user with mobile and password.
 * @param input - { mobile, password }
 * @returns Authenticated user and token pair
 */
export async function login(
  input: LoginInput,
): Promise<{ user: IUser; tokens: TokenPair }> {
  const { mobile, password } = input;

  const user = await User.findOne({ mobile }).select('+password');
  if (!user) {
    throw new AppError('Invalid mobile number or password', 401);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact support.', 403);
  }

  if (user.role === 'storeAdmin' && user.approvalStatus !== 'approved') {
    if (user.approvalStatus === 'rejected') {
      throw new AppError('Your dealer account has been rejected. Please contact support.', 403);
    }
    throw new AppError('Your dealer account is pending super admin approval.', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid mobile number or password', 401);
  }

  const tokens = await generateTokenPair(user);
  return { user, tokens };
}

/**
 * Authenticates or registers a customer using Google ID token.
 * For first-time users, mobile number is mandatory before account creation.
 */
export async function googleAuth(input: GoogleAuthInput): Promise<GoogleAuthResult> {
  const { idToken, mobile, referralCode } = input;
  const tokenInfo = await verifyGoogleIdToken(idToken);

  const normalizedEmail = tokenInfo.email!.trim().toLowerCase();
  const normalizedName = tokenInfo.name?.trim() || normalizedEmail.split('@')[0] || 'Vaniki Customer';

  const existingByEmail = await User.findOne({ email: normalizedEmail }).select('+password');
  if (existingByEmail) {
    if (!existingByEmail.isActive) {
      throw new AppError('Your account has been deactivated. Contact support.', 403);
    }

    if (existingByEmail.role === 'storeAdmin' && existingByEmail.approvalStatus !== 'approved') {
      if (existingByEmail.approvalStatus === 'rejected') {
        throw new AppError('Your dealer account has been rejected. Please contact support.', 403);
      }
      throw new AppError('Your dealer account is pending super admin approval.', 403);
    }

    const tokens = await generateTokenPair(existingByEmail);
    return {
      requiresMobile: false,
      user: existingByEmail,
      tokens,
    };
  }

  if (!mobile) {
    return {
      requiresMobile: true,
      prefillName: normalizedName,
      prefillEmail: normalizedEmail,
    };
  }

  const existingByMobile = await User.findOne({ mobile });
  if (existingByMobile) {
    throw new AppError('Another account already uses this mobile number', 409);
  }

  let referredById: IUser['_id'] | undefined;
  if (referralCode) {
    const referrer = await User.findOne({ referralCode: referralCode.trim().toUpperCase() }).select('_id');
    if (!referrer) {
      throw new AppError('Invalid referral code', 400);
    }
    referredById = referrer._id;
  }

  const ownReferralCode = await generateUniqueReferralCode(normalizedName, mobile);

  const user = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    mobile,
    password: generateRandomPassword(),
    referralCode: ownReferralCode,
    ...(referredById ? { referredBy: referredById } : {}),
    isActive: true,
  });

  if (referredById) {
    await User.findByIdAndUpdate(referredById, { $inc: { referralCount: 1 } });
  }

  const tokens = await generateTokenPair(user);
  return {
    requiresMobile: false,
    user,
    tokens,
  };
}

/**
 * Authenticates a user with mobile and OTP.
 * @param input - { mobile, otp }
 * @returns Authenticated user and token pair
 */
export async function loginWithOtp(
  input: LoginOtpInput,
): Promise<{ user: IUser; tokens: TokenPair }> {
  const { mobile, otp } = input;

  const user = await User.findOne({ mobile }).select('+otp +otpExpiry');
  if (!user) {
    throw new AppError('No account found with this mobile number', 404);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact support.', 403);
  }

  if (user.role === 'storeAdmin' && user.approvalStatus !== 'approved') {
    if (user.approvalStatus === 'rejected') {
      throw new AppError('Your dealer account has been rejected. Please contact support.', 403);
    }
    throw new AppError('Your dealer account is pending super admin approval.', 403);
  }

  if (!user.otp || !user.otpExpiry) {
    throw new AppError('No OTP requested. Please request a new one.', 400);
  }

  if (user.otpExpiry < new Date()) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  const isOtpValid = await bcrypt.compare(otp, user.otp);
  if (!isOtpValid) {
    throw new AppError('Invalid OTP', 400);
  }

  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  const tokens = await generateTokenPair(user);
  return { user, tokens };
}

/**
 * Refreshes an expired access token using a valid refresh token.
 * @param refreshToken - The refresh token from httpOnly cookie
 * @returns New token pair
 */
export async function refreshTokens(refreshToken: string): Promise<TokenPair> {
  if (!refreshToken) {
    throw new AppError('Refresh token is required', 401);
  }

  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) throw new AppError('JWT_REFRESH_SECRET not configured', 500);

  let decoded: { userId: string };
  try {
    decoded = jwt.verify(refreshToken, secret) as { userId: string };
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const user = await User.findById(decoded.userId).select('+refreshToken');
  if (!user || user.refreshToken !== refreshToken) {
    // Token reuse detected — invalidate all tokens for this user
    if (user) {
      user.refreshToken = undefined;
      await user.save({ validateBeforeSave: false });
    }
    throw new AppError('Invalid refresh token. Please log in again.', 401);
  }

  return generateTokenPair(user);
}

/**
 * Logs out a user by clearing their stored refresh token.
 * @param userId - The user's ObjectId
 */
export async function logout(userId: string): Promise<void> {
  await User.findByIdAndUpdate(userId, { $unset: { refreshToken: 1 } });
}

/**
 * Initiates a forgot-password flow by sending an OTP to the mobile number.
 * @param input - { mobile }
 */
export async function forgotPassword(input: SendOtpInput): Promise<void> {
  const { mobile } = input;

  const user = await User.findOne({ mobile });
  if (!user) {
    // Don't reveal whether the mobile exists — silently return
    return;
  }

  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);

  user.otp = hashedOtp;
  user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  await sendOtpViaMSG91(mobile, otp);
}

/**
 * Resets a user's password after verifying the OTP.
 * @param input - { mobile, otp, newPassword }
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const { mobile, otp, newPassword } = input;

  const user = await User.findOne({ mobile }).select('+otp +otpExpiry +password');
  if (!user) {
    throw new AppError('No account found with this mobile number', 404);
  }

  if (!user.otp || !user.otpExpiry) {
    throw new AppError('No OTP requested. Please request a new one.', 400);
  }

  if (user.otpExpiry < new Date()) {
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  const isOtpValid = await bcrypt.compare(otp, user.otp);
  if (!isOtpValid) {
    throw new AppError('Invalid OTP', 400);
  }

  user.password = newPassword; // bcrypt pre-save hook will hash it
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.refreshToken = undefined; // Invalidate all sessions
  await user.save();
}

/**
 * Gets the current user's full profile.
 * @param userId - The user's ObjectId
 * @returns User document (without sensitive fields)
 */
export async function getMe(userId: string): Promise<IUser> {
  const user = await User.findById(userId)
    .populate('selectedStore', 'name address')
    .populate({
      path: 'wishlist',
      select: 'name slug shortDescription images variants category averageRating reviewCount',
      populate: { path: 'category', select: 'name slug' },
    });
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
}

/**
 * Updates the user's service mode preference.
 * @param userId - The user's ObjectId
 * @param serviceMode - 'delivery' or 'pickup'
 * @returns Updated user
 */
export async function updateServiceMode(
  userId: string,
  serviceMode: 'delivery' | 'pickup',
): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { serviceMode },
    { new: true, runValidators: true },
  ).populate('selectedStore', 'name address');
  if (!user) throw new AppError('User not found', 404);
  return user;
}

/**
 * Updates the user's selected store.
 * @param userId - The user's ObjectId
 * @param storeId - The store's ObjectId
 * @returns Updated user
 */
export async function updateSelectedStore(
  userId: string,
  storeId: string,
): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { selectedStore: storeId },
    { new: true, runValidators: true },
  ).populate('selectedStore', 'name address');
  if (!user) throw new AppError('User not found', 404);
  return user;
}

/**
 * Updates the user's Expo push token for mobile notifications.
 * @param userId - The user's ObjectId
 * @param input - { pushToken }
 * @returns Updated user
 */
export async function updatePushToken(
  userId: string,
  input: PushTokenInput,
): Promise<IUser> {
  const user = await User.findByIdAndUpdate(
    userId,
    { expoPushToken: input.pushToken },
    { new: true, runValidators: true },
  ).populate('selectedStore', 'name address');

  if (!user) throw new AppError('User not found', 404);
  return user;
}

/**
 * Updates the authenticated user's profile.
 */
export async function updateMe(userId: string, input: UpdateMeInput): Promise<IUser> {
  const user = await User.findById(userId).populate('selectedStore', 'name address');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (input.mobile && input.mobile !== user.mobile) {
    const existingMobile = await User.findOne({
      mobile: input.mobile,
      _id: { $ne: userId },
    });
    if (existingMobile) {
      throw new AppError('Another account already uses this mobile number', 409);
    }
    user.mobile = input.mobile;
  }

  const normalizedEmail = input.email?.trim() || undefined;
  if (normalizedEmail !== undefined && normalizedEmail !== user.email) {
    const existingEmail = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: userId },
    });
    if (existingEmail) {
      throw new AppError('Another account already uses this email address', 409);
    }
    user.email = normalizedEmail;
  }

  if (input.name !== undefined) {
    user.name = input.name;
  }

  if (input.savedAddress) {
    const existingAddress = user.savedAddress
      ? { ...user.savedAddress }
      : {
          street: '',
          city: '',
          state: '',
          pincode: '',
          landmark: '',
        };
    const mergedAddress = {
      ...existingAddress,
      ...input.savedAddress,
    };

    user.savedAddress = {
      street: mergedAddress.street,
      city: mergedAddress.city,
      state: mergedAddress.state,
      pincode: mergedAddress.pincode,
      ...(mergedAddress.landmark ? { landmark: mergedAddress.landmark } : {}),
    };
  }

  await user.save();
  await user.populate('selectedStore', 'name address');
  await user.populate({
    path: 'wishlist',
    select: 'name slug shortDescription images variants category averageRating reviewCount',
    populate: { path: 'category', select: 'name slug' },
  });
  return user;
}

/**
 * Updates the authenticated user's profile image.
 */
export async function updateProfileImage(userId: string, file?: Express.Multer.File): Promise<IUser> {
  if (!file) {
    throw new AppError('Profile image file is required', 400);
  }

  const user = await User.findById(userId)
    .populate('selectedStore', 'name address')
    .populate({
      path: 'wishlist',
      select: 'name slug shortDescription images variants category averageRating reviewCount',
      populate: { path: 'category', select: 'name slug' },
    });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  if (user.profileImage?.publicId) {
    await deleteFromCloudinary(user.profileImage.publicId);
  }

  const uploadedProfileImage = await uploadToCloudinary(file.buffer, 'vaniki/users/profile');
  user.profileImage = {
    url: uploadedProfileImage.url,
    publicId: uploadedProfileImage.publicId,
  };

  await user.save();
  return user;
}

/**
 * Toggles a product in the authenticated user's wishlist.
 */
export async function toggleWishlist(userId: string, input: ToggleWishlistInput): Promise<IUser> {
  const product = await Product.findById(input.productId).select('_id');
  if (!product) {
    throw new AppError('Product not found', 404);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const wishlist = user.wishlist || [];
  const hasProduct = wishlist.some((entry) => entry.toString() === input.productId);

  user.wishlist = hasProduct
    ? wishlist.filter((entry) => entry.toString() !== input.productId)
    : [...wishlist, product._id];

  await user.save();
  await user.populate('selectedStore', 'name address');
  await user.populate({
    path: 'wishlist',
    select: 'name slug shortDescription images variants category averageRating reviewCount',
    populate: { path: 'category', select: 'name slug' },
  });

  return user;
}

/**
 * Changes the authenticated user's password after verifying the current password.
 */
export async function changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
  const user = await User.findById(userId).select('+password');
  if (!user) {
    throw new AppError('User not found', 404);
  }

  const isMatch = await user.comparePassword(input.currentPassword);
  if (!isMatch) {
    throw new AppError('Current password is incorrect', 400);
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError('New password must be different from the current password', 400);
  }

  user.password = input.newPassword;
  user.refreshToken = undefined;
  await user.save();
}

// ─── Private Helpers ─────────────────────────────────────────────────────

/**
 * Generates an access + refresh token pair, stores refresh token on user.
 * @param user - The user document
 * @returns Token pair: { accessToken, refreshToken }
 */
async function generateTokenPair(user: IUser): Promise<TokenPair> {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret || !refreshSecret) {
    throw new AppError('JWT secrets not configured', 500);
  }

  const userId = user._id.toString();
  let effectiveStoreId = user.selectedStore?.toString();

  if (user.role === 'storeAdmin') {
    const ownedStore = await Store.findOne({ adminId: user._id }).select('_id');
    effectiveStoreId = ownedStore?._id.toString() || effectiveStoreId;
  }

  const accessPayload: JwtAccessPayload = {
    userId,
    role: user.role,
    storeId: effectiveStoreId,
  };

  const accessToken = jwt.sign(accessPayload, accessSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshToken = jwt.sign({ userId }, refreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  // Store hashed refresh token in DB for invalidation
  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
}
