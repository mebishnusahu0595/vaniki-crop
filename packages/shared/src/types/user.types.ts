/** User roles across the platform */
export type UserRole = 'customer' | 'admin' | 'super-admin';

/** Address structure shared between frontend and backend */
export interface Address {
  street: string;
  city: string;
  state: string;
  pincode: string;
}

/** Public user object (no sensitive fields) */
export interface UserPublic {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  address?: Address;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Auth response returned after login/register */
export interface AuthResponse {
  user: Pick<UserPublic, 'id' | 'name' | 'email' | 'role'>;
  accessToken: string;
  refreshToken: string;
}
