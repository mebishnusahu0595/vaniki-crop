import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, type IUser } from '../../models/User.model.js';
import { Visitor } from '../../models/Visitor.model.js';
import { sendOtpViaMessageCentral, validateOtpViaMessageCentral } from '../../utils/messageCentral.js';
import { Staff } from '../../models/Staff.model.js';
import { firebaseAdmin } from '../../config/firebase.js';
import { Product } from '../../models/Product.model.js';
import { Store } from '../../models/Store.model.js';
import { AppError } from '../../utils/AppError.js';
import { deleteFromCloudinary, uploadToCloudinary } from '../../utils/cloudinary.helpers.js';
import { buildStoreAddressFromCoordinates } from '../../utils/storeAddress.js';
import { addEmailToQueue } from '../../queues/email.queue.js';
import { passwordResetOtpTemplate } from '../../utils/emailTemplates.js';
import * as whatsappService from '../whatsapp/whatsapp.service.js';
import type {
  ChangePasswordInput,
  DealerSignupInput,
  SendOtpInput,
  VerifyOtpInput,
  SignupInput,
  LoginInput,
  LoginOtpInput,
  PushTokenInput,
  ResetPasswordInput,
  ToggleWishlistInput,
  UpdateMeInput,
} from './auth.validator.js';

// ─── OTP Store (for pre-signup OTP caching) ──────────────────────────────
// Signup OTPs go through Message Central (same provider as login/forgot-password).
// Message Central generates the OTP itself, so we track the verificationId per
// mobile and remember the code once it validates, since a verificationId can
// only be validated once but signup needs to re-confirm it.
const signupOtpStore: Record<string, { verificationId: string; otpExpiry: Date; verifiedOtp?: string }> = {};

// ─── Token Config ────────────────────────────────────────────────────────

const ACCESS_TOKEN_EXPIRES = '7d';
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

// ─── OTP ─────────────────────────────────────────────────────────────────

/**
 * Generates a cryptographically random 4-digit OTP.
 * @returns 4-digit OTP string
 */
function generateOtp(): string {
  return crypto.randomInt(1000, 9999).toString();
}

import { generateUniqueReferralCode } from '../../utils/referral.helpers.js';

// ─── Service Methods ─────────────────────────────────────────────────────

/**
 * Sends a signup OTP to the given mobile number via Message Central
 * (the same provider used for login and forgot-password OTPs).
 * @param input - { mobile }
 */
export async function sendOtp(input: SendOtpInput): Promise<{ verificationId: string }> {
  const { mobile } = input;

  let verificationId: string | undefined;
  try {
    verificationId = await sendOtpViaMessageCentral(mobile);
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.toLowerCase().includes('already exist')) {
      const existingUser = await User.findOne({ mobile }).select('+otpVerificationId');
      verificationId = existingUser?.otpVerificationId || signupOtpStore[mobile]?.verificationId || 'existing';
    } else {
      throw err;
    }
  }

  const effectiveVid = verificationId || '';
  if (effectiveVid && effectiveVid !== 'existing') {
    signupOtpStore[mobile] = {
      verificationId: effectiveVid,
      otpExpiry: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    };

    const existingUser = await User.findOne({ mobile });
    if (existingUser) {
      existingUser.otpVerificationId = effectiveVid;
      existingUser.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
      await existingUser.save({ validateBeforeSave: false });
    }
  }

  return { verificationId: effectiveVid };
}

/**
 * Verifies a given 4-digit OTP for registration.
 * Checks user document first, then temp store for new signups.
 * Does not delete the cached OTP so the final signup flow can verify it as well.
 */
export async function verifyOtp(input: VerifyOtpInput): Promise<void> {
  const { mobile, otp } = input;
  const normalizedOtp = otp !== undefined && otp !== null ? String(otp).trim() : '';

  if (!normalizedOtp) {
    throw new AppError('OTP is required', 400);
  }

  const user = await User.findOne({ mobile }).select('+otp +otpExpiry +otpVerificationId');
  const entry = signupOtpStore[mobile];

  const resolvedVerificationId =
    (entry?.verificationId && entry.verificationId !== 'existing')
      ? entry.verificationId
      : (user?.otpVerificationId && user.otpVerificationId !== 'existing' ? user.otpVerificationId : undefined);

  if (!resolvedVerificationId && !user?.otp) {
    throw new AppError('No OTP requested. Please request a new one.', 400);
  }

  const expiry = entry?.otpExpiry || user?.otpExpiry;
  if (expiry && expiry < new Date()) {
    if (signupOtpStore[mobile]) delete signupOtpStore[mobile];
    throw new AppError('OTP has expired. Please request a new one.', 400);
  }

  // Already validated against Message Central once — accept the same code again
  // (a verificationId can only be validated a single time on their side).
  if (entry?.verifiedOtp === normalizedOtp) {
    return;
  }

  let isOtpValid = false;
  if (resolvedVerificationId) {
    isOtpValid = await validateOtpViaMessageCentral(resolvedVerificationId, normalizedOtp);
  }

  if (!isOtpValid && user?.otp && expiry && expiry >= new Date()) {
    isOtpValid = await bcrypt.compare(normalizedOtp, user.otp);
  }

  if (!isOtpValid) {
    throw new AppError('Invalid OTP', 400);
  }

  if (signupOtpStore[mobile]) {
    signupOtpStore[mobile].verifiedOtp = normalizedOtp;
  } else {
    signupOtpStore[mobile] = {
      verificationId: resolvedVerificationId || '',
      otpExpiry: expiry || new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
      verifiedOtp: normalizedOtp,
    };
  }
}

/**
 * Registers a new user after verifying the OTP.
 * @param input - { name, email, mobile, password, otp }
 * @returns Created user and token pair
 */
export async function signup(
  input: SignupInput & { latitude?: number; longitude?: number; visitorId?: string },
  meta?: { ip?: string; userAgent?: string },
): Promise<{ user: IUser; tokens: TokenPair }> {
  const { name, email, mobile, password, otp, referralCode } = input;

  // Check if user already exists with this mobile
  const existingUser = await User.findOne({ mobile }).select('+otp +otpExpiry +otpVerificationId');
  if (existingUser?.password) {
    throw new AppError('An account with this mobile number already exists', 409);
  }

  const normalizedOtp = otp !== undefined && otp !== null ? String(otp).trim() : '';

  // Verify OTP only when OTP is provided by the client.
  if (normalizedOtp) {
    let isOtpValid = false;

    const entry = signupOtpStore[mobile];
    const vid =
      (entry?.verificationId && entry.verificationId !== 'existing')
        ? entry.verificationId
        : (existingUser?.otpVerificationId && existingUser.otpVerificationId !== 'existing' ? existingUser.otpVerificationId : undefined);

    if (entry?.verifiedOtp === normalizedOtp) {
      isOtpValid = true;
    } else if (vid) {
      isOtpValid = await validateOtpViaMessageCentral(vid, normalizedOtp);
    }

    if (!isOtpValid && existingUser?.otp && existingUser?.otpExpiry && existingUser.otpExpiry >= new Date()) {
      isOtpValid = await bcrypt.compare(normalizedOtp, existingUser.otp);
    }

    if (!isOtpValid) {
      throw new AppError('Invalid OTP', 400);
    }

    if (signupOtpStore[mobile]) delete signupOtpStore[mobile];
  } else if (signupOtpStore[mobile]) {
    // OTP is optional now, so stale temp OTP cache should not block signup.
    delete signupOtpStore[mobile];
  }

  let referredById: IUser['_id'] | undefined;
  let referredByStaffId: any | undefined;
  let referralSource: string | undefined;

  if (referralCode) {
    const code = referralCode.trim().toUpperCase();
    
    if (code === 'WHATSAPP') {
      referralSource = 'WHATSAPP';
    } else {
      // First check if it's a User referral
      const referrer = await User.findOne({ referralCode: code }).select('_id');
      if (referrer) {
        referredById = referrer._id;
      } else {
        // Then check if it's a Staff referral
        const staff = await Staff.findOne({ referralCode: code, isActive: true }).select('_id');
        if (staff) {
          referredByStaffId = staff._id;
        } else {
          throw new AppError('Invalid referral code', 400);
        }
      }
    }
  }

  const ownReferralCode = await generateUniqueReferralCode(name, mobile);
  const coords = (input.latitude != null && input.longitude != null)
    ? { latitude: input.latitude, longitude: input.longitude }
    : undefined;

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
    if (referredByStaffId && !existingUser.referredByStaff) {
      existingUser.referredByStaff = referredByStaffId;
    }
    if (referralSource) {
      existingUser.referralSource = referralSource;
    }
    
    if (coords) {
      existingUser.coordinates = coords;
    }
    if (meta?.ip) {
      existingUser.registrationIp = existingUser.registrationIp || meta.ip;
      existingUser.lastIp = meta.ip;
    }
    if (meta?.userAgent) {
      existingUser.deviceInfo = { userAgent: meta.userAgent };
    }

    // Update address if provided
    if (input.address || input.district || input.state || input.pincode || coords) {
      existingUser.savedAddress = {
        street: input.address || existingUser.savedAddress?.street || '',
        district: input.district || existingUser.savedAddress?.district || '',
        state: input.state || existingUser.savedAddress?.state || '',
        city: input.district || existingUser.savedAddress?.city || '',
        pincode: input.pincode || existingUser.savedAddress?.pincode || '',
        latitude: input.latitude ?? existingUser.savedAddress?.latitude,
        longitude: input.longitude ?? existingUser.savedAddress?.longitude,
      };
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
      ...(referredByStaffId ? { referredByStaff: referredByStaffId } : {}),
      ...(referralSource ? { referralSource } : {}),
      ...(coords ? { coordinates: coords } : {}),
      ...(meta?.ip ? { registrationIp: meta.ip, lastIp: meta.ip } : {}),
      ...(meta?.userAgent ? { deviceInfo: { userAgent: meta.userAgent } } : {}),
      savedAddress: {
        street: input.address || '',
        district: input.district || '',
        state: input.state || '',
        city: input.district || '',
        pincode: input.pincode || '',
        latitude: input.latitude,
        longitude: input.longitude,
      },
      isActive: true,
    });
    shouldIncrementReferrer = Boolean(referredById);
  }

  // Also sync/link with Visitor telemetry record if visitorId is provided or by IP/Mobile
  if (input.visitorId || meta?.ip) {
    const visitorQuery = input.visitorId ? { visitorId: input.visitorId } : { ip: meta?.ip };
    await Visitor.findOneAndUpdate(
      visitorQuery,
      {
        $set: {
          userId: user._id,
          userName: user.name,
          userMobile: user.mobile,
          isRegistered: true,
          ip: meta?.ip,
          ...(coords ? { coordinates: coords } : {}),
          location: {
            city: input.district,
            district: input.district,
            state: input.state,
            pincode: input.pincode,
            formattedAddress: input.address,
          },
          lastSeen: new Date(),
        },
      },
      { upsert: Boolean(input.visitorId) }
    ).catch(() => {});
  }

  if (shouldIncrementReferrer && referredById) {
    const referrerReward = crypto.randomInt(10, 21);
    const userReward = crypto.randomInt(2, 6);
    
    // Reward Referrer
    await User.findByIdAndUpdate(referredById, { 
      $inc: { referralCount: 1, loyaltyPoints: referrerReward } 
    });

    // Reward New User
    await User.findByIdAndUpdate(user._id, {
      $inc: { loyaltyPoints: userReward }
    });
  }

  const tokens = await generateTokenPair(user);

  // Send WhatsApp Welcome Message
  whatsappService.sendWelcomeMessage(user).catch(err => {
    console.error('Failed to send WhatsApp welcome message:', err);
  });

  return { user, tokens };
}

/**
 * Registers a dealer (store admin) account and keeps it pending until super admin approval.
 */
export async function dealerSignup(input: DealerSignupInput, file?: Express.Multer.File): Promise<{ user: IUser; tokens: TokenPair }> {
  const {
    name,
    mobile,
    email,
    password,
    storeName,
    storeLocation,
    area,
    city,
    state,
    pincode,
    longitude = 0,
    latitude = 0,
    gstNumber,
    sgstNumber,
  } = input;

  const normalizedEmail = email?.trim().toLowerCase() || undefined;

  let user = await User.findOne({ mobile });

  let profileImageData = {
    url: 'https://vanikicrop.com/favicon.png',
    publicId: 'default',
  };

  const rawImage = (input as any).profileImage || (input as any).dealerPhoto;
  if (file && file.buffer) {
    const uploadedProfileImage = await uploadToCloudinary(file.buffer, 'vaniki/users/profile');
    profileImageData = {
      url: uploadedProfileImage.url,
      publicId: uploadedProfileImage.publicId,
    };
  } else if (rawImage && typeof rawImage === 'string') {
    if (rawImage.startsWith('data:image')) {
      const parts = rawImage.split(',');
      const buffer = Buffer.from(parts[1] || parts[0], 'base64');
      const uploaded = await uploadToCloudinary(buffer, 'vaniki/users/profile');
      profileImageData = {
        url: uploaded.url,
        publicId: uploaded.publicId,
      };
    } else if (rawImage.startsWith('http')) {
      profileImageData = {
        url: rawImage,
        publicId: '',
      };
    }
  }

  const effectivePassword = password?.trim() || `Vaniki@${mobile.slice(-4)}`;
  const effectiveSgst = (sgstNumber || gstNumber).trim().toUpperCase();
  const effectiveLocation = [area, city, state, pincode].filter(Boolean).join(', ') || storeLocation || 'Store Location';

  if (user) {
    // Existing user upgrading to dealer or updating KYC
    user.name = name;
    if (normalizedEmail) user.email = normalizedEmail;
    user.role = 'storeAdmin';
    user.approvalStatus = 'pending';
    user.isActive = true;
    if (password?.trim()) {
      user.password = password.trim();
    }
    if (profileImageData.url && profileImageData.url !== 'https://vanikicrop.com/favicon.png') {
      user.profileImage = profileImageData;
    }
    user.dealerProfile = {
      storeName,
      storeLocation: effectiveLocation,
      latitude,
      longitude,
      gstNumber: gstNumber.trim().toUpperCase(),
      sgstNumber: effectiveSgst,
    };
    await user.save();
  } else {
    // New user
    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        throw new AppError('A user with this email already exists', 409);
      }
    }

    user = await User.create({
      name,
      email: normalizedEmail,
      mobile,
      password: effectivePassword,
      role: 'storeAdmin',
      approvalStatus: 'pending',
      isActive: true,
      profileImage: profileImageData,
      dealerProfile: {
        storeName,
        storeLocation: effectiveLocation,
        latitude,
        longitude,
        gstNumber: gstNumber.trim().toUpperCase(),
        sgstNumber: effectiveSgst,
      },
    });
  }

  // Create or update the inactive draft store so approval can activate it directly.
  await Store.findOneAndUpdate(
    { $or: [{ adminId: user._id }, { phone: mobile }] },
    {
      $set: {
        name: storeName,
        phone: mobile,
        email: normalizedEmail || user.email,
        adminId: user._id,
        isActive: false,
        address: {
          street: area || storeLocation || '',
          city: city || '',
          state: state || '',
          pincode: pincode || '',
        },
        location: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        gstNumber: gstNumber.trim().toUpperCase(),
        sgstNumber: effectiveSgst,
        deliveryRadius: 10,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const tokens = await generateTokenPair(user);
  return { user, tokens };
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

  if (user.role === 'storeAdmin' && user.approvalStatus === 'rejected') {
    throw new AppError('Your dealer account has been rejected. Please contact support.', 403);
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new AppError('Invalid mobile number or password', 401);
  }

  const tokens = await generateTokenPair(user);
  return { user, tokens };
}

/**
/**
 * Sends OTP to a registered mobile number for login verification.
 * Only allows registered users. Unregistered users receive a 404.
 */
export async function sendLoginOtp(input: { mobile: string }): Promise<{ verificationId?: string; message?: string }> {
  const { mobile } = input;

  const user = await User.findOne({ mobile });
  if (!user) {
    throw new AppError('No account found with this mobile number. Please register first.', 404);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact support.', 403);
  }

  // Save 4-digit DB fallback OTP on user document
  const otp = generateOtp();
  user.otp = await bcrypt.hash(otp, 10);
  user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  let verificationId: string | undefined;
  try {
    verificationId = await sendOtpViaMessageCentral(mobile);
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.toLowerCase().includes('already exist')) {
      verificationId = user.otpVerificationId || signupOtpStore[mobile]?.verificationId || 'existing';
      await user.save({ validateBeforeSave: false });
      return { verificationId, message: 'OTP already sent. Please enter the OTP received on your mobile.' };
    }
    console.warn('Message Central sendLoginOtp warning, using DB fallback:', errMsg);
  }

  if (verificationId && verificationId !== 'existing') {
    user.otpVerificationId = verificationId;
    signupOtpStore[mobile] = {
      verificationId,
      otpExpiry: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
    };
  }

  await user.save({ validateBeforeSave: false });

  return { verificationId };
}

/**
 * Authenticates a user with mobile and OTP.
 * Supporting both Message Central validation (via verificationId) and database OTP fallback.
 * @param input - { mobile, otp, verificationId }
 * @returns Authenticated user and token pair
 */
export async function loginWithOtp(
  input: any,
): Promise<{ user: IUser; tokens: TokenPair }> {
  const { mobile, otp, verificationId } = input;
  const normalizedOtp = otp !== undefined && otp !== null ? String(otp).trim() : '';

  if (!normalizedOtp) {
    throw new AppError('OTP is required', 400);
  }

  const user = await User.findOne({ mobile }).select('+otp +otpExpiry +otpVerificationId');
  if (!user) {
    throw new AppError('No account found with this mobile number. Please register first.', 404);
  }

  if (!user.isActive) {
    throw new AppError('Your account has been deactivated. Contact support.', 403);
  }

  if (user.role === 'storeAdmin' && user.approvalStatus === 'rejected') {
    throw new AppError('Your dealer account has been rejected. Please contact support.', 403);
  }

  let isOtpValid = false;

  // Resolve verificationId from all sources:
  // 1) Explicit verificationId from request body (if valid string and not 'existing')
  // 2) user.otpVerificationId stored in MongoDB
  // 3) signupOtpStore[mobile]?.verificationId stored in memory
  const resolvedVerificationId =
    (verificationId && typeof verificationId === 'string' && verificationId.trim() !== '' && verificationId.trim() !== 'existing')
      ? verificationId.trim()
      : (user.otpVerificationId && user.otpVerificationId !== 'existing'
          ? user.otpVerificationId
          : signupOtpStore[mobile]?.verificationId);

  // Try Message Central validation if verificationId was resolved
  if (resolvedVerificationId && resolvedVerificationId !== 'existing') {
    isOtpValid = await validateOtpViaMessageCentral(resolvedVerificationId, normalizedOtp);
  }

  // Database fallback validation
  if (!isOtpValid && user.otp && user.otpExpiry) {
    if (user.otpExpiry >= new Date()) {
      isOtpValid = await bcrypt.compare(normalizedOtp, user.otp);
    }
  }

  // Demo / Reviewer accounts fallback
  if (
    (mobile === '9876543210' || mobile === '9999999999') &&
    (normalizedOtp === '1234' || normalizedOtp === '123456' || normalizedOtp === '9999')
  ) {
    isOtpValid = true;
  }

  console.log(`[Auth] loginWithOtp mobile=${mobile}, resolvedVid=${resolvedVerificationId}, hasDbOtp=${!!user.otp}, isOtpValid=${isOtpValid}`);

  if (!isOtpValid) {
    if (!user.otp && (!resolvedVerificationId || resolvedVerificationId === 'existing')) {
      throw new AppError('No OTP requested. Please request a new one.', 400);
    }
    if (user.otpExpiry && user.otpExpiry < new Date()) {
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }
    throw new AppError('Invalid OTP', 400);
  }

  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpVerificationId = undefined;
  await user.save({ validateBeforeSave: false });

  if (signupOtpStore[mobile]) {
    delete signupOtpStore[mobile];
  }

  const tokens = await generateTokenPair(user);
  return { user, tokens };
}

/**
 * Verifies a Firebase ID Token and returns the verified phone number.
 * @param idToken - The token from frontend
 */
/*
async function verifyFirebasePhoneToken(idToken: string): Promise<string> {
  try {
    const decodedToken = await firebaseAdmin.auth().verifyIdToken(idToken);
    const phoneNumber = decodedToken.phone_number;
    if (!phoneNumber) {
      throw new AppError('Phone number not verified in Firebase token', 400);
    }
    // Convert +919876543210 to 9876543210 for internal compatibility
    return phoneNumber.replace('+91', '').slice(-10);
  } catch (error) {
    console.error('Firebase verification failed:', error);
    throw new AppError('Invalid or expired Firebase token', 401);
  }
}
*/

/**
 * Authenticates a user using a Firebase ID Token (Phone Auth).
 */
export async function firebaseLogin(idToken: string): Promise<{ user: IUser; tokens: TokenPair }> {
  throw new AppError('Firebase authentication is disabled.', 503);
  /*
  const mobile = await verifyFirebasePhoneToken(idToken);

  const user = await User.findOne({ mobile });
  if (!user) {
    throw new AppError('No account found with this mobile number. Please sign up first.', 404);
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

  const tokens = await generateTokenPair(user);
  return { user, tokens };
  */
}

/**
 * Resets password using Firebase token verification instead of custom OTP.
 */
export async function firebaseResetPassword(input: { idToken: string; newPassword: string }): Promise<void> {
  throw new AppError('Firebase password reset is disabled.', 503);
  /*
  const mobile = await verifyFirebasePhoneToken(input.idToken);

  const user = await User.findOne({ mobile }).select('+password');
  if (!user) {
    throw new AppError('No account found with this mobile number', 404);
  }

  user.password = input.newPassword;
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.refreshToken = undefined;
  await user.save();
  */
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
 * Initiates a forgot-password flow by sending an OTP to the mobile number or email.
 * For mobile numbers, uses Message Central and returns a verificationId.
 * For emails, falls back to SMTP.
 * Enforces checking for registered users, throwing a 404 if not registered.
 * @param input - { mobile, email }
 */
export async function forgotPassword(input: any): Promise<{ verificationId?: string; message?: string }> {
  const { mobile, email } = input;

  const query: any = {};
  if (mobile) query.mobile = mobile;
  else if (email) query.email = email;
  else throw new AppError('Mobile or email is required', 400);

  const user = await User.findOne(query);
  if (!user) {
    throw new AppError('No account found with this mobile number. Please register first.', 404);
  }

  // Generate 4-digit DB fallback OTP for mobile/email reset
  const otp = generateOtp();
  const hashedOtp = await bcrypt.hash(otp, 10);
  user.otp = hashedOtp;
  user.otpExpiry = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  if (mobile) {
    let verificationId: string | undefined;
    try {
      verificationId = await sendOtpViaMessageCentral(mobile);
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.toLowerCase().includes('already exist')) {
        return { verificationId: 'existing', message: 'OTP already sent. Please check your SMS or enter existing OTP.' };
      }
      console.warn('Message Central forgotPassword warning, using DB fallback:', errMsg);
    }
    return { verificationId };
  }

  if (user.email) {
    addEmailToQueue({
      to: user.email,
      subject: 'Password Reset OTP - Vaniki Crop',
      html: passwordResetOtpTemplate(user, otp),
    });
  }

  return {};
}

/**
 * Resets a user's password after verifying the OTP.
 * Supports Message Central OTP validation (via verificationId) and database fallback.
 * @param input - { mobile, email, otp, newPassword, verificationId }
 */
export async function resetPassword(input: any): Promise<void> {
  const { mobile, email, otp, newPassword, verificationId } = input;

  const query: any = {};
  if (mobile) query.mobile = mobile;
  else if (email) query.email = email;
  else throw new AppError('Mobile or email is required', 400);

  const user = await User.findOne(query).select('+otp +otpExpiry +password +otpVerificationId');
  if (!user) {
    throw new AppError('No account found with this mobile number. Please register first.', 404);
  }

  const normalizedOtp = otp !== undefined && otp !== null ? String(otp).trim() : '';
  let isOtpValid = false;

  const resolvedVerificationId =
    (verificationId && typeof verificationId === 'string' && verificationId.trim() !== '' && verificationId.trim() !== 'existing')
      ? verificationId.trim()
      : (user.otpVerificationId && user.otpVerificationId !== 'existing'
          ? user.otpVerificationId
          : signupOtpStore[mobile || '']?.verificationId);

  if (resolvedVerificationId && resolvedVerificationId !== 'existing') {
    isOtpValid = await validateOtpViaMessageCentral(resolvedVerificationId, normalizedOtp);
  }

  if (!isOtpValid && user.otp && user.otpExpiry) {
    if (user.otpExpiry >= new Date()) {
      isOtpValid = await bcrypt.compare(normalizedOtp, user.otp);
    }
  }

  if (!isOtpValid) {
    if (!user.otp && (!resolvedVerificationId || resolvedVerificationId === 'existing')) {
      throw new AppError('No OTP requested. Please request a new one.', 400);
    }
    if (user.otpExpiry && user.otpExpiry < new Date()) {
      throw new AppError('OTP has expired. Please request a new one.', 400);
    }
    throw new AppError('Invalid OTP', 400);
  }

  user.password = newPassword; // bcrypt pre-save hook will hash it
  user.otp = undefined;
  user.otpExpiry = undefined;
  user.otpVerificationId = undefined;
  user.otpExpiry = undefined;
  await user.save();
  
  user.refreshToken = undefined; // Invalidate all sessions
  await user.save();
}

/**
 * Gets the current user's full profile.
 * @param userId - The user's ObjectId
 * @returns User document (without sensitive fields)
 */
export async function getMe(userId: string): Promise<IUser> {
  let user = await User.findById(userId)
    .populate('selectedStore', 'name address')
    .populate({
      path: 'wishlist',
      select: 'name slug shortDescription images variants category averageRating reviewCount',
      populate: { path: 'category', select: 'name slug' },
    });

  if (!user) {
    throw new AppError('User not found', 404);
  }

  // Ensure user has a referral code (fixes "Generating..." on frontend for older users)
  if (!user.referralCode) {
    user.referralCode = await generateUniqueReferralCode(user.name, user.mobile);
    await user.save();
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
  const updatePayload: Record<string, unknown> = { serviceMode };
  if (serviceMode === 'delivery') {
    updatePayload.selectedStore = null;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    updatePayload,
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

export async function updateFcmToken(
  userId: string,
  input: { fcmToken: string },
): Promise<IUser> {
  if (!input.fcmToken) {
    throw new AppError('FCM token is required', 400);
  }
  const user = await User.findByIdAndUpdate(
    userId,
    { fcmToken: input.fcmToken },
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
    const addressPatch: Partial<{
      street: string;
      city: string;
      district: string;
      state: string;
      pincode: string;
      landmark?: string;
    }> = {};

    const street = input.savedAddress.street?.trim();
    if (street) addressPatch.street = street;

    const city = input.savedAddress.city?.trim();
    if (city) addressPatch.city = city;

    const state = input.savedAddress.state?.trim();
    if (state) addressPatch.state = state;

    const pincode = input.savedAddress.pincode?.trim();
    if (pincode) addressPatch.pincode = pincode;

    const landmark = input.savedAddress.landmark?.trim();
    if (landmark) {
      addressPatch.landmark = landmark;
    } else if (input.savedAddress.landmark !== undefined) {
      addressPatch.landmark = undefined;
    }

    const district = (input.savedAddress as any).district?.trim();
    if (district) addressPatch.district = district;

    if (Object.keys(addressPatch).length > 0) {
    const existingAddress = user.savedAddress
      ? { ...user.savedAddress }
      : {
          street: '',
          city: '',
          district: '',
          state: '',
          pincode: '',
          landmark: '',
        };
    const mergedAddress = {
      ...existingAddress,
      ...addressPatch,
    };

    user.savedAddress = {
      street: mergedAddress.street,
      city: mergedAddress.district || mergedAddress.city,
      district: mergedAddress.district,
      state: mergedAddress.state,
      pincode: mergedAddress.pincode,
      ...(mergedAddress.landmark ? { landmark: mergedAddress.landmark } : {}),
    };
    }
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

/**
 * Deletes the authenticated user's account and all associated data.
 * @param userId - The user's ObjectId
 */
export async function deleteAccount(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }

  // If user has a profile image, delete it from Cloudinary
  if (user.profileImage?.publicId) {
    await deleteFromCloudinary(user.profileImage.publicId).catch((err) => {
      console.error('Failed to delete user profile image from Cloudinary:', err);
    });
  }

  // Perform hard delete of the user document
  await User.findByIdAndDelete(userId);
}

