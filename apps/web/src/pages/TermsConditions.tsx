import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';

const SectionTitle: React.FC<{ num: string; children: React.ReactNode }> = ({ num, children }) => (
  <h2 className="mb-3 mt-8 flex items-start gap-3 text-xl font-black text-primary-900 first:mt-0">
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-black text-primary">
      {num}
    </span>
    <span className="mt-0.5">{children}</span>
  </h2>
);

const SubTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="mb-2 mt-5 text-base font-bold text-primary-900">{children}</h3>
);

const Para: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="leading-7 text-primary-900/75">{children}</p>
);

const Ul: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ul className="ml-6 list-disc space-y-1.5 leading-7 text-primary-900/75">{children}</ul>
);

const TermsConditions: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      <Link
        to="/"
        className="group mb-6 inline-flex items-center gap-2 text-sm font-black text-primary-900/60 transition hover:text-primary-900"
      >
        <ArrowLeft size={16} className="transition group-hover:-translate-x-1" />
        Back to Home
      </Link>

      {/* Hero banner */}
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-10 text-white sm:px-10">
        <p className="section-kicker text-primary-200">Legal</p>
        <h1 className="mt-4 max-w-4xl font-sans text-5xl font-black tracking-tight">Terms &amp; Conditions</h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/75">
          VANIKI CROP SCIENCE PRIVATE LIMITED &mdash; Effective Date: October 10, 2025
        </p>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-7 text-white/55">
          Please read these Terms &amp; Conditions carefully. By accessing or using the website www.vanikicrop.in, you agree to be bound by these terms, which constitute a legally binding agreement.
        </p>
      </section>

      {/* Content */}
      <article className="surface-card mt-6 p-6 sm:p-10">
        <div className="mb-8 flex items-center gap-3 border-b border-primary-100 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Scale size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary-500">
              VANIKI CROP SCIENCE PRIVATE LIMITED
            </p>
            <h2 className="text-xl font-black text-primary-900">Terms &amp; Conditions of Sale and Use</h2>
          </div>
        </div>

        <div className="space-y-1 text-sm">

          {/* Section 1 */}
          <SectionTitle num="1">Introduction and Scope</SectionTitle>
          <SubTitle>1.1 The Service</SubTitle>
          <Para>
            The Website is owned and operated by <strong>VANIKI CROP SCIENCE PRIVATE LIMITED</strong> ("We," "Us," or "Our"). We are an E-commerce retailer specializing in the sale of insecticides, pesticides, and related agro-chemicals manufactured and packaged by licensed third-party manufacturers.
          </Para>
          <SubTitle>1.2 Governing Law and Compliance</SubTitle>
          <Para>
            These Terms are governed by the laws of India, including the <strong>Consumer Protection Act, 2019</strong>, the <strong>E-commerce Rules, 2020</strong>, the <strong>Information Technology Act, 2000</strong>, and specifically, the <strong>Insecticides Act, 1968</strong>, and the <strong>Legal Metrology Rules, 2011</strong>.
          </Para>
          <SubTitle>1.3 Acceptance</SubTitle>
          <Para>
            Your continued use of the Website and placement of orders constitutes your full acceptance of these Terms.
          </Para>

          {/* Section 2 */}
          <SectionTitle num="2">Eligibility and Customer Requirements</SectionTitle>
          <SubTitle>2.1 Minimum Age</SubTitle>
          <Para>
            You must be at least <strong>18 years of age</strong> or have attained the age of majority in your jurisdiction to purchase products from this Website.
          </Para>
          <SubTitle>2.2 Intended Use</SubTitle>
          <Para>
            You confirm that any purchase of regulated products (insecticides/pesticides) is for lawful and agricultural/domestic purposes in accordance with all applicable Indian regulations, and not for resale unless you possess a valid license.
          </Para>

          {/* Section 3 */}
          <SectionTitle num="3">Product Information and Accuracy Disclaimer</SectionTitle>
          <SubTitle>3.1 Third-Party Products</SubTitle>
          <Para>
            We strictly act as a retailer. All insecticides, pesticides, and agro-chemicals sold on the Website are <strong>manufactured, formulated, tested, and packaged by third-party licensed entities</strong>. We do not alter, repackage, or modify the product formulations.
          </Para>
          <SubTitle>3.2 Product Accuracy</SubTitle>
          <Para>
            While we strive to ensure accurate product descriptions, images, and usage details, we do not guarantee that the product information is error-free, complete, or current. The labeling, composition, and efficacy are the sole responsibility of the manufacturer.
          </Para>
          <SubTitle>3.3 Legal Requirement Disclaimer (Mandatory)</SubTitle>
          <div className="my-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-bold leading-7 text-amber-900">
              By purchasing, the customer acknowledges that they have read and understood the statutory warnings, dosage recommendations, crop/pest suitability, and safety instructions provided on the product label and/or packaging by the original manufacturer, as required under the Insecticides Act, 1968.
            </p>
          </div>

          {/* Section 4 */}
          <SectionTitle num="4">Pricing, Payments, and Taxes</SectionTitle>
          <SubTitle>4.1 Pricing</SubTitle>
          <Para>
            All listed prices are in <strong>Indian Rupees (INR)</strong> and are inclusive of all applicable Central and State taxes (e.g., GST), as mandated by Indian law.
          </Para>
          <SubTitle>4.2 Changes</SubTitle>
          <Para>
            Prices are subject to change without prior notice. The price charged will be the price effective at the time of order placement.
          </Para>
          <SubTitle>4.3 Payment Modes</SubTitle>
          <Para>
            We accept payments via standard methods including UPI, credit/debit cards, wallets, net banking, and Cash on Delivery (COD) where available.
          </Para>

          {/* Section 5 */}
          <SectionTitle num="5">Order Acceptance, Cancellation, and Fulfillment</SectionTitle>
          <SubTitle>5.1 Order Acceptance</SubTitle>
          <Para>
            We reserve the right to accept or reject any order at our sole discretion, including but not limited to reasons such as unavailability of stock, inaccurate pricing, or regulatory restrictions for the delivery location.
          </Para>
          <SubTitle>5.2 Cancellation by Customer</SubTitle>
          <Para>
            Orders may be cancelled by the customer within <strong>2 hours</strong> of placement. No cancellations will be accepted once the order has been processed, invoiced, or dispatched.
          </Para>
          <SubTitle>5.3 Cancellation by Vaniki Crop Science</SubTitle>
          <Para>
            We reserve the right to cancel an order even after acceptance if we find discrepancies in licenses (for bulk orders), regulatory issues, or if the customer's profile indicates non-compliance with the Insecticides Act, 1968.
          </Para>

          {/* Section 6 */}
          <SectionTitle num="6">Shipping, Delivery, and Risk</SectionTitle>
          <SubTitle>6.1 Delivery Area</SubTitle>
          <Para>We deliver products only within the geographical limits of India.</Para>
          <SubTitle>6.2 Risk of Loss</SubTitle>
          <Para>
            The risk of loss for products passes to you upon our delivery to the carrier (shipper). However, we shall be responsible for ensuring goods reach the customer in an undamaged condition as per the Consumer Protection Act, 2019. Delivery timelines are estimates; please refer to the separate{' '}
            <Link to="/policies" className="font-bold text-primary hover:underline">Shipping &amp; Delivery Policy</Link>.
          </Para>

          {/* Section 7 */}
          <SectionTitle num="7">Returns, Refunds, and Replacements</SectionTitle>
          <SubTitle>7.1 Nature of Products</SubTitle>
          <Para>
            Due to the regulated nature and sensitivity of agro-chemicals, products are generally <strong>non-returnable</strong> once the seal is broken or the product has been used.
          </Para>
          <SubTitle>7.2 Conditions for Refund/Replacement</SubTitle>
          <Para>Refunds or replacements are strictly offered only for:</Para>
          <Ul>
            <li>Delivery of an incorrect product (mismatch with the order).</li>
            <li>Product received in a physically damaged or defective condition.</li>
            <li>Non-delivery due to an error on our part.</li>
          </Ul>
          <SubTitle>7.3 Policy Reference</SubTitle>
          <Para>
            All requests for refunds or replacements are subject to the detailed terms laid out in the separate{' '}
            <Link to="/policies" className="font-bold text-primary hover:underline">Return &amp; Refund Policy</Link>.
          </Para>

          {/* Section 8 */}
          <SectionTitle num="8">Limitation of Liability and Indemnity</SectionTitle>
          <SubTitle>8.1 Liability for Products</SubTitle>
          <Para>
            VANIKI CROP SCIENCE PRIVATE LIMITED shall not be liable for any claims, damages, or losses arising from the use, misuse, application failure, or storage of the third-party manufactured products. This includes, but is not limited to, crop damage, reduced yields, health issues, or environmental harm.
          </Para>
          <SubTitle>8.2 User Responsibility</SubTitle>
          <Para>
            You acknowledge that you are solely responsible for determining the proper dosage, method of application, storage, and disposal of the purchased products, in line with the manufacturer's label and local regulations.
          </Para>
          <SubTitle>8.3 Maximum Liability</SubTitle>
          <Para>
            Our total cumulative liability to you for any claim arising out of the sale of a product shall be strictly limited to <strong>the price of the product paid by you</strong>.
          </Para>
          <SubTitle>8.4 Indemnity</SubTitle>
          <Para>
            You agree to indemnify and hold harmless VANIKI CROP SCIENCE PRIVATE LIMITED, its officers, and employees, from any claim or demand, including reasonable attorneys' fees, made by any third party due to or arising out of your breach of these Terms or your violation of any law or the rights of a third party.
          </Para>

          {/* Section 9 */}
          <SectionTitle num="9">Intellectual Property Rights</SectionTitle>
          <Para>
            All content, including text, graphics, logos, images, and product data, on the Website is the property of <strong>VANIKI CROP SCIENCE PRIVATE LIMITED</strong> or its content suppliers and is protected by Indian and international intellectual property laws. Unauthorized use is strictly prohibited.
          </Para>

          {/* Section 10 */}
          <SectionTitle num="10">Governing Law and Jurisdiction</SectionTitle>
          <Para>
            These Terms &amp; Conditions shall be construed and governed in accordance with the laws of India. Any dispute arising out of or relating to these Terms shall be subject to the exclusive jurisdiction of the competent courts in <strong>Durg, Chhattisgarh, India</strong>.
          </Para>

          {/* Section 11 */}
          <SectionTitle num="11">Changes to Terms</SectionTitle>
          <Para>
            We reserve the right to modify, amend, or update these Terms &amp; Conditions at any time. The updated version will be effective immediately upon posting on the Website. Your continued use of the Website after any changes indicates your acceptance of the new Terms.
          </Para>

          {/* Section 12 */}
          <SectionTitle num="12">Contact Information</SectionTitle>
          <div className="mt-4 overflow-hidden rounded-2xl border border-primary-100">
            <table className="w-full text-sm">
              <thead className="bg-primary-50">
                <tr>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Detail</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Information</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-primary-50">
                <tr>
                  <td className="px-4 py-3 font-semibold text-primary-900">Legal Entity</td>
                  <td className="px-4 py-3 text-primary-900/70">VANIKI CROP SCIENCE PRIVATE LIMITED</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-primary-900">Registered Address</td>
                  <td className="px-4 py-3 text-primary-900/70">BAZAR CHOWK, WARD NO. 11 VILLAGE BORI TEH BORI, Durg, Chhattisgarh, India 491001</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-primary-900">Contact Email</td>
                  <td className="px-4 py-3">
                    <a href="mailto:vaniki.crop@gmail.com" className="font-bold text-primary hover:underline">
                      vaniki.crop@gmail.com
                    </a>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-semibold text-primary-900">Jurisdiction</td>
                  <td className="px-4 py-3 text-primary-900/70">Durg, Chhattisgarh, India</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </article>
    </div>
  );
};

export default TermsConditions;
