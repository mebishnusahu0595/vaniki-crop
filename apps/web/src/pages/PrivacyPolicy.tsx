import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const PrivacyPolicy: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <Link to="/" className="group mb-6 inline-flex items-center gap-2 text-sm font-black text-primary-900/60 transition hover:text-primary-900">
        <ArrowLeft size={16} className="transition group-hover:-translate-x-1" />
        {t('common.backToHome', 'Back to Home')}
      </Link>

      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-10 text-white sm:px-10">
        <p className="section-kicker text-primary-200">Legal</p>
        <h1 className="mt-4 max-w-4xl font-heading text-5xl">Privacy Policy</h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/75">
          Last updated: April 25, 2026
        </p>
      </section>

      <article className="surface-card mt-8 p-6 sm:p-10">
        <div className="prose prose-primary max-w-none space-y-8 text-primary-900/80 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-black [&_h2]:text-primary-900 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-primary-900 [&_p]:leading-7 [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-2">
          <section>
            <h2>1. Introduction</h2>
            <p>
              Welcome to Vaniki Crop (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your personal
              information and your right to privacy. This Privacy Policy explains how we collect, use, disclose,
              and safeguard your information when you visit our website{' '}
              <a href="https://vanikicrop.com" className="text-primary font-bold hover:underline">vanikicrop.com</a>{' '}
              and use our mobile application (collectively, the &quot;Platform&quot;).
            </p>
          </section>

          <section>
            <h2>2. Information We Collect</h2>

            <h3>2.1 Personal Information</h3>
            <p>When you register, place an order, or interact with our Platform, we may collect:</p>
            <ul>
              <li>Full name</li>
              <li>Mobile phone number</li>
              <li>Email address (optional)</li>
              <li>Delivery address (street, city, state, pincode)</li>
              <li>Payment information (processed securely by Razorpay; we do not store card details)</li>
            </ul>

            <h3>2.2 Automatically Collected Information</h3>
            <p>When you access our Platform, we may automatically collect:</p>
            <ul>
              <li>Device type, operating system, and browser type</li>
              <li>IP address and approximate location</li>
              <li>App usage data and crash reports</li>
              <li>Push notification tokens (for order updates)</li>
            </ul>
          </section>

          <section>
            <h2>3. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and delivery updates via email and push notifications</li>
              <li>Provide customer support</li>
              <li>Improve our Platform and user experience</li>
              <li>Prevent fraudulent transactions</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2>4. Payment Security</h2>
            <p>
              All payment transactions are processed through <strong>Razorpay</strong>, a PCI-DSS compliant
              payment gateway. We do not store, process, or have access to your credit/debit card numbers
              or UPI PINs. Razorpay&apos;s privacy policy governs the handling of your payment data.
            </p>
          </section>

          <section>
            <h2>5. Data Sharing</h2>
            <p>We do not sell your personal information. We may share your data with:</p>
            <ul>
              <li><strong>Store Partners:</strong> Your name, mobile, and delivery address are shared with the assigned store to fulfill your order.</li>
              <li><strong>Payment Processors:</strong> Razorpay processes your payment securely.</li>
              <li><strong>Communication Providers:</strong> MSG91 for OTP delivery via SMS.</li>
              <li><strong>Law Enforcement:</strong> If required by applicable law or legal process.</li>
            </ul>
          </section>

          <section>
            <h2>6. Data Retention</h2>
            <p>
              We retain your personal information for as long as your account is active or as needed to provide
              you services. Order history is kept for accounting and legal compliance. You can request deletion
              of your account by contacting us at{' '}
              <a href="mailto:teams@vanikicrop.com" className="text-primary font-bold hover:underline">teams@vanikicrop.com</a>.
            </p>
          </section>

          <section>
            <h2>7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your account and associated data</li>
              <li>Withdraw consent for marketing communications at any time</li>
            </ul>
          </section>

          <section>
            <h2>8. Cookies</h2>
            <p>
              Our website uses essential cookies to maintain your session and authentication state. We do not
              use tracking cookies or third-party advertising cookies.
            </p>
          </section>

          <section>
            <h2>9. Children&apos;s Privacy</h2>
            <p>
              Our Platform is not intended for children under 18. We do not knowingly collect personal
              information from minors. If you believe a child has provided us data, please contact us
              immediately.
            </p>
          </section>

          <section>
            <h2>10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted on this page
              with an updated &quot;Last updated&quot; date. We encourage you to review this page periodically.
            </p>
          </section>

          <section>
            <h2>11. Contact Us</h2>
            <p>If you have questions about this Privacy Policy, please contact us:</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:teams@vanikicrop.com" className="text-primary font-bold hover:underline">teams@vanikicrop.com</a></li>
              <li><strong>Phone:</strong> +91 9302228883</li>
              <li><strong>Address:</strong> Shop no. 37, Krishi Upaj Mandi, Dhamdha Road, Durg 491001 (C.G.)</li>
            </ul>
          </section>
        </div>
      </article>
    </div>
  );
};

export default PrivacyPolicy;
