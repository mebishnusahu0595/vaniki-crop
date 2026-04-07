import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import { Readable } from 'node:stream';
import { SitemapStream, streamToPromise } from 'sitemap';

// ─── Module Routes ───────────────────────────────────────────────────────
import authRoutes from './modules/auth/auth.routes.js';
import { categoryPublicRoutes, categoryAdminRoutes } from './modules/categories/category.routes.js';
import { productPublicRoutes, productAdminRoutes } from './modules/products/product.routes.js';
import orderRoutes from './modules/orders/order.routes.js';
import paymentRoutes from './modules/payments/payment.routes.js';
import couponRoutes from './modules/coupons/coupon.routes.js';
import storeRoutes from './modules/stores/store.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import bannerRoutes from './modules/banners/banner.routes.js';
import homepageRoutes from './modules/homepage/homepage.routes.js';
import reviewRoutes from './modules/reviews/review.routes.js';
import contactRoutes from './modules/contact/contact.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import superAdminRoutes from './modules/superadmin/superadmin.routes.js';
import { Product } from './models/Product.model.js';
import { Category } from './models/Category.model.js';

// ─── Legacy Routes (to be migrated to modules) ──────────────────────────
import userRoutes from './routes/user.routes.js';

// ─── Middleware ──────────────────────────────────────────────────────────
import { extractStoreId } from './middleware/store.middleware.js';

// ─── Workers ─────────────────────────────────────────────────────────────
import './workers/email.worker.js';

// ─── Error Handling ──────────────────────────────────────────────────────
import { AppError } from './utils/AppError.js';

const app: express.Application = express();

// ─── Security Middleware ─────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: [
      'https://vanikicrop.com',
      'https://www.vanikicrop.com',
      'https://admin.vanikicrop.com',
      'https://superadmin.vanikicrop.com',
    ],
    credentials: true,
  }),
);
app.use(compression());

// ─── Rate Limiting ───────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// ─── Body Parsing, Cookies & Logging ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

// ─── Health Check ────────────────────────────────────────────────────────
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'vaniki-crop-api',
    timestamp: new Date().toISOString(),
  });
});

app.get('/sitemap.xml', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const frontendUrl = (process.env.FRONTEND_URL || 'https://vanikicrop.com').replace(/\/$/, '');
    const [products, categories] = await Promise.all([
      Product.find({ isActive: true }).select('slug updatedAt').lean(),
      Category.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);

    const links = [
      {
        url: '/',
        changefreq: 'daily' as const,
        priority: 1,
      },
      {
        url: '/products',
        changefreq: 'daily' as const,
        priority: 0.9,
      },
      ...categories.map((category) => ({
        url: `/products?category=${category.slug}`,
        lastmod: category.updatedAt,
        changefreq: 'weekly' as const,
        priority: 0.8,
      })),
      ...products.map((product) => ({
        url: `/product/${product.slug}`,
        lastmod: product.updatedAt,
        changefreq: 'daily' as const,
        priority: 0.85,
      })),
    ];

    const stream = new SitemapStream({ hostname: frontendUrl });
    const xml = await streamToPromise(Readable.from(links).pipe(stream)).then((data) => data.toString());

    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
  } catch (error) {
    next(error);
  }
});

// ─── Public API Routes ───────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryPublicRoutes);
app.use('/api/products', extractStoreId, productPublicRoutes);
app.use('/api/orders', extractStoreId, orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/coupons', extractStoreId, couponRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/contact', contactRoutes);

// ─── Admin API Routes ────────────────────────────────────────────────────
app.use('/api/admin/categories', categoryAdminRoutes);
app.use('/api/admin/products', productAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/superadmin', superAdminRoutes);

// ─── Legacy Routes ───────────────────────────────────────────────────────
app.use('/api/users', userRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global Error Handler ────────────────────────────────────────────────
app.use((err: Error | AppError, _req: Request, res: Response, _next: NextFunction) => {
  const errorWithMeta = err as Error & {
    statusCode?: number;
    name?: string;
    code?: number;
    keyValue?: Record<string, unknown>;
    path?: string;
    value?: unknown;
    errors?: Record<string, { message?: string }>;
  };
  const explicitStatusCode = (err as Error & { statusCode?: number }).statusCode;
  const hasExplicitStatusCode = typeof explicitStatusCode === 'number';
  const multerFileSizeError = (err as { name?: string; code?: string }).name === 'MulterError'
    && (err as { code?: string }).code === 'LIMIT_FILE_SIZE';
  const multerGenericError = (err as { name?: string }).name === 'MulterError';
  const isMongooseValidationError = errorWithMeta.name === 'ValidationError';
  const isMongooseCastError = errorWithMeta.name === 'CastError';
  const isDuplicateKeyError = errorWithMeta.name === 'MongoServerError' && errorWithMeta.code === 11000;

  const statusCode = err instanceof AppError
    ? err.statusCode
    : hasExplicitStatusCode
      ? explicitStatusCode
      : isDuplicateKeyError
        ? 409
        : (isMongooseValidationError || isMongooseCastError)
          ? 400
      : (multerFileSizeError || multerGenericError)
        ? 400
        : 500;

  const validationMessage = isMongooseValidationError && errorWithMeta.errors
    ? Object.values(errorWithMeta.errors)
      .map((entry) => entry?.message)
      .filter((message): message is string => Boolean(message))
      .join(', ')
    : '';
  const duplicateKeyField = isDuplicateKeyError && errorWithMeta.keyValue
    ? Object.keys(errorWithMeta.keyValue)[0]
    : '';

  const message = multerFileSizeError
    ? 'Image file is too large. Maximum size is 5MB.'
    : isDuplicateKeyError
      ? duplicateKeyField
        ? `${duplicateKeyField} already exists`
        : 'Duplicate value already exists'
    : isMongooseValidationError
      ? validationMessage || 'Validation failed'
    : isMongooseCastError
      ? `Invalid value for ${errorWithMeta.path || 'field'}`
    : err.message || 'Internal Server Error';

  console.error(`[ERROR] ${statusCode} - ${message}`, err.stack);

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

export default app;
