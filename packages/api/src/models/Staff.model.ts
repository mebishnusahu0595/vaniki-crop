import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IStaff extends Document {
  name: string;
  mobile: string;
  email?: string;
  password: string;
  referralCode: string;
  role: 'delivery' | 'referral';
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const staffSchema = new Schema<IStaff>(
  {
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, unique: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    password: { type: String, required: true, minlength: 6, select: false },
    referralCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    role: { type: String, enum: ['delivery', 'referral'], default: 'delivery' },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc: any, ret: any) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  },
);

// Auto-generate unique referral code if not provided
staffSchema.pre('validate', async function (this: any) {
  if (!this.referralCode) {
    try {
      // Use a more robust generation: Initial + Timestamp subset + Random
      const initial = (this.name || 'S').charAt(0).toUpperCase();
      const timestamp = Date.now().toString().slice(-4);
      const random = Math.floor(Math.random() * 900) + 100; // 100-999
      this.referralCode = `${initial}${timestamp}${random}`;
      
      // Check if already exists (highly unlikely now, but safe)
      const existing = await mongoose.models.Staff.findOne({ referralCode: this.referralCode });
      if (existing) {
        // One more try with different random
        this.referralCode = `${initial}${timestamp}${Math.floor(Math.random() * 900) + 100}`;
      }
    } catch (error) {
      console.error('Error generating referral code:', error);
    }
  }

});

staffSchema.pre('save', async function (this: any) {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

staffSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const Staff = mongoose.model<IStaff>('Staff', staffSchema);
