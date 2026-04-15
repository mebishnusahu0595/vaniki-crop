# Vaniki Crop Production Checklist

## 1) Environment Variables
- [ ] Fill all values in `.env.production`.
- [ ] Keep secrets out of git (CI/CD secret store only).
- [ ] Verify `CORS_ALLOWED_ORIGINS` includes only production domains.

## 2) MongoDB Atlas
- [ ] Ensure connection uses Atlas SRV URL in `MONGODB_URI`.
- [ ] Confirm existing indexes for products and categories are built.
- [ ] Enable Atlas Search index for product text search if advanced relevance is needed.
- [ ] Add database alerts for CPU, storage, and connection spikes.

## 3) Cloudinary
- [ ] Create `CLOUDINARY_UPLOAD_PRESET` for secure uploads.
- [ ] Configure eager transformations using `CLOUDINARY_EAGER_TRANSFORMATIONS`.
- [ ] Confirm product images are served with `f_auto,q_auto` and responsive sizing.

## 4) Razorpay (Live)
- [ ] Switch `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to live credentials.
- [ ] Configure `RAZORPAY_WEBHOOK_URL`.
- [ ] Set and verify `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Test successful payment and webhook signature validation in production mode.

## 5) MSG91 / DLT
- [ ] Register DLT template and sender ID in MSG91 dashboard.
- [ ] Set `MSG91_TEMPLATE_ID` and `MSG91_DLT_TEMPLATE_ID`.
- [ ] Test OTP delivery on production numbers.

## 6) Frontend SEO + Discovery
- [ ] Submit `https://vanikicrop.com/sitemap.xml` in Google Search Console.
- [ ] Verify robots.txt points to sitemap.
- [ ] Validate Product and Breadcrumb JSON-LD with Rich Results Test.

## 7) Runtime & Security
- [ ] Enforce HTTPS and valid TLS certificates for all domains.
- [ ] Keep API behind a reverse proxy with gzip/brotli enabled.
- [ ] Monitor API response times and error rates.
- [ ] Set up backup and restore verification for MongoDB.

## 8) Pre-Launch Validation
- [ ] Run web build and API tests in CI with production env values.
- [ ] Smoke test signup/login/cart/checkout/order tracking.
- [ ] Verify wishlist, compare, recently viewed, and referral flows.