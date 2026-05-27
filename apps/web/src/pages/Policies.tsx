import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Truck, RotateCcw, Tag } from 'lucide-react';
import { cn } from '../utils/cn';

type PolicyTab = 'shipping' | 'refund' | 'pricing';

const tabs: { id: PolicyTab; label: string; icon: React.ElementType }[] = [
  { id: 'shipping', label: 'Shipping & Delivery', icon: Truck },
  { id: 'refund', label: 'Return & Refund', icon: RotateCcw },
  { id: 'pricing', label: 'Pricing Policy', icon: Tag },
];

const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="mb-3 mt-8 text-xl font-black text-primary-900 first:mt-0">{children}</h2>
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

const Li: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <li>{children}</li>
);

// ─── SHIPPING & DELIVERY POLICY ──────────────────────────────────────────────
const ShippingPolicy: React.FC = () => (
  <div className="space-y-2">
    <SectionTitle>1. Order Processing and Dispatch</SectionTitle>
    <SubTitle>1.1 Processing Time</SubTitle>
    <Ul>
      <Li>All orders are typically processed and verified for regulatory compliance within <strong>24 to 48 business hours</strong> of payment confirmation (excluding Sundays and public holidays).</Li>
      <Li>Orders placed after 5:00 PM IST are processed on the next working day.</Li>
      <Li><strong>Compliance Check:</strong> Due to the regulated nature of our products, all orders undergo a mandatory internal compliance check to ensure adherence to quantity limits and permissible delivery zones before dispatch. Processing time may be extended if verification of customer details (e.g., commercial licenses) is required.</Li>
    </Ul>

    <SubTitle>1.2 Dispatch Notification</SubTitle>
    <Ul>
      <Li>Once your order is dispatched, you will receive a shipment confirmation via email and/or SMS, including the tracking number and a link to the courier partner's tracking portal.</Li>
    </Ul>

    <SectionTitle>2. Shipping Locations and Service Limitations</SectionTitle>
    <SubTitle>2.1 Service Area</SubTitle>
    <Ul>
      <Li>We ship only within India to most serviceable PIN codes.</Li>
      <Li><strong>Restricted Zones:</strong> Delivery may be unavailable to certain remote, sensitive, or high-risk zones where our logistics partners cannot guarantee the safe transport and handling of chemical goods. You will be informed at checkout if your location is not serviceable.</Li>
      <Li><strong>PIN Code Verification:</strong> If delivery to your location is found to be non-serviceable after payment, we will immediately inform you and initiate a full refund for prepaid orders.</Li>
    </Ul>

    <SectionTitle>3. Shipping Charges and Fees</SectionTitle>
    <SubTitle>3.1 Standard Charges</SubTitle>
    <Ul>
      <Li>Shipping charges are calculated based on the total weight, volume, and the specific hazard classification (if applicable) of the chemicals ordered.</Li>
      <Li><strong>Free Shipping Threshold:</strong> We offer free standard shipping on all prepaid orders exceeding ₹2,000 (or as currently displayed on the Website).</Li>
      <Li><strong>Orders Below Threshold:</strong> Orders below the free shipping threshold will incur a flat or variable delivery fee, clearly displayed at the final checkout page.</Li>
    </Ul>

    <SubTitle>3.2 Hazardous Material Surcharges</SubTitle>
    <Para>
      Due to the special handling, packaging, and regulatory requirements for transporting agro-chemicals, additional courier surcharges may apply for specific products or remote/special zones. These surcharges will be clearly itemized and displayed during checkout.
    </Para>

    <SectionTitle>4. Estimated Delivery Time</SectionTitle>
    <Para>Delivery timelines are estimates and commence from the date of dispatch:</Para>
    <div className="my-4 overflow-hidden rounded-2xl border border-primary-100">
      <table className="w-full text-sm">
        <thead className="bg-primary-50">
          <tr>
            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Zone</th>
            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Estimated Days</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-50">
          <tr><td className="px-4 py-3 font-semibold text-primary-900">Major Metro Cities</td><td className="px-4 py-3 text-primary-900/70">3 – 5 business days</td></tr>
          <tr><td className="px-4 py-3 font-semibold text-primary-900">Other Cities and Towns</td><td className="px-4 py-3 text-primary-900/70">5 – 7 business days</td></tr>
          <tr><td className="px-4 py-3 font-semibold text-primary-900">Remote/Rural Areas</td><td className="px-4 py-3 text-primary-900/70">7 – 10 business days</td></tr>
        </tbody>
      </table>
    </div>
    <Para>
      <strong>Disclaimer:</strong> Delivery timelines may be extended due to reasons beyond our control, including courier service delays, weather conditions, government restrictions, or mandated regulatory checks during transit.
    </Para>

    <SectionTitle>5. Specialized Packaging and Safe Handling</SectionTitle>
    <Ul>
      <Li><strong>Safety Compliance:</strong> All products are packaged strictly according to the guidelines provided by the third-party manufacturer and our logistics partners for the safe transport of chemical goods.</Li>
      <Li><strong>Tamper-Proof Seal:</strong> Orders are shipped in durable, secure, and tamper-proof packaging. Do not accept the delivery if the outer packaging is visibly damaged, leaking, or the safety seals are broken.</Li>
      <Li><strong>Label Integrity:</strong> We ensure the original manufacturer's label, batch number, expiry date, and cautionary notices (as required by the Insecticides Act, 1968) remain intact and visible.</Li>
    </Ul>

    <SectionTitle>6. Failed Delivery and Return Shipments</SectionTitle>
    <Ul>
      <Li><strong>Delivery Attempts:</strong> Our courier partners will typically attempt delivery up to two (2) times.</Li>
      <Li><strong>Consignee Unavailable:</strong> If the recipient is unavailable or the provided address is incorrect, the package will be marked for return to our warehouse.</Li>
      <Li><strong>Reshipping Charges:</strong> If an order is returned to us due to customer error (e.g., incorrect address, non-availability, refusal to accept without valid reason), the customer will be responsible for the actual shipping and handling charges incurred for both the return and any subsequent reshipment attempt.</Li>
    </Ul>

    <SectionTitle>7. Damaged or Wrong Product Delivery</SectionTitle>
    <Para>If you receive a package that is damaged, leaking, or contains a product different from your order:</Para>
    <ol className="ml-6 mt-2 list-decimal space-y-2 leading-7 text-primary-900/75">
      <li><strong>Immediate Action:</strong> Do not open the product's internal packaging if the outer box is compromised, especially in cases of leakage.</li>
      <li><strong>Documentation:</strong> Immediately take clear photographic evidence of the damaged product, the original shipping packaging, and the intact labels.</li>
      <li><strong>Reporting:</strong> Share the photos and your Order ID with us via the contact details below within 48 hours of delivery.</li>
      <li><strong>Resolution:</strong> Upon verification, we will arrange for a replacement or a full refund as per our Return &amp; Refund Policy. We will arrange for the reverse pick-up of the damaged/wrong item.</li>
    </ol>

    <SectionTitle>8. Contact Information for Shipping Queries</SectionTitle>
    <Ul>
      <Li><strong>Legal Entity:</strong> VANIKI CROP SCIENCE PRIVATE LIMITED</Li>
      <Li><strong>Email:</strong> <a href="mailto:vaniki.crop@gmail.com" className="font-bold text-primary hover:underline">vaniki.crop@gmail.com</a></Li>
      <Li><strong>Phone/WhatsApp:</strong> +91-7582099000</Li>
    </Ul>
  </div>
);

// ─── RETURN & REFUND POLICY ───────────────────────────────────────────────────
const RefundPolicy: React.FC = () => (
  <div className="space-y-2">
    <Para>
      <strong>Effective Date: October 10, 2025</strong><br />
      This Policy governs the terms for replacement, refund, and cancellation of orders placed on www.vanikicrop.in, owned and operated by VANIKI CROP SCIENCE PRIVATE LIMITED ("We," "Us," or "Our"). This Policy is compliant with the Consumer Protection Act, 2019, and the Consumer Protection (E-commerce) Rules, 2020.
    </Para>

    <SectionTitle>1. General Policy on Returns</SectionTitle>
    <SubTitle>1.1 No Return of Regulated Products</SubTitle>
    <Para>
      Due to the specialized, regulated nature of our products (insecticides, pesticides, and agro-chemicals), and strict statutory controls on their handling, storage, and traceability under the Insecticides Act, 1968, we maintain a strict <strong>"No Return"</strong> policy once the product has been delivered and accepted.
    </Para>
    <SubTitle>1.2 Product Integrity</SubTitle>
    <Para>
      Products, once opened, used, or removed from their sealed manufacturer packaging, cannot be resold or re-entered into inventory. Therefore, we do not accept returns based on changes of mind, incorrect dosage application, or dissatisfaction with product efficacy.
    </Para>

    <SectionTitle>2. Eligibility for Replacement or Refund</SectionTitle>
    <Para>A replacement or full refund will be processed only if the issue falls under the following conditions and is notified within the stipulated timeframe:</Para>
    <Ul>
      <Li><strong>Wrong Product Delivered:</strong> The item received is different from the item ordered.</Li>
      <Li><strong>Transit Damage:</strong> The product packaging is clearly damaged, broken, leaking, or the seal is tampered with at the time of delivery.</Li>
      <Li><strong>Defective or Expired Item:</strong> The product received is defective, unusable, or has passed its date of expiry (as printed by the third-party manufacturer, in compliance with Legal Metrology Rules, 2011).</Li>
      <Li><strong>Non-Delivery:</strong> The order was confirmed and paid for but not delivered due to an error on our part or by our logistics partner.</Li>
    </Ul>

    <SectionTitle>3. Procedure for Refund or Replacement Requests</SectionTitle>
    <SubTitle>3.1 Notification Deadline</SubTitle>
    <Para>
      The customer must notify VANIKI CROP SCIENCE PRIVATE LIMITED of any eligible issue within <strong>48 hours of receiving the delivery</strong>. Claims made after this 48-hour window will be regrettably declined.
    </Para>
    <SubTitle>3.2 Mandatory Documentation</SubTitle>
    <Para>To validate the claim, the customer must submit:</Para>
    <Ul>
      <Li>Clear photographs of the damaged product and its original shipping box/packaging.</Li>
      <Li>Clear photograph of the product showing the batch number, expiry date, and manufacturer's seal/label.</Li>
      <Li>Order ID and detailed description of the issue.</Li>
    </Ul>
    <SubTitle>3.3 Submission Method</SubTitle>
    <Para>All requests and documentation must be submitted via email to: <a href="mailto:vaniki.crop@gmail.com" className="font-bold text-primary hover:underline">vaniki.crop@gmail.com</a></Para>
    <SubTitle>3.4 Inspection and Approval</SubTitle>
    <Para>
      Upon receiving the documentation, our team will conduct a thorough internal verification and, if necessary, coordinate with the logistics partner. The refund or replacement is processed only after approval by our Quality Assurance team.
    </Para>

    <SectionTitle>4. Order Cancellation Policy</SectionTitle>
    <SubTitle>4.1 Cancellation Window</SubTitle>
    <Para>Orders can be cancelled by the customer within <strong>2 hours</strong> of placement.</Para>
    <SubTitle>4.2 Restriction</SubTitle>
    <Para>
      Once an order has been processed, invoiced, or dispatched (i.e., handed over to the courier), it cannot be cancelled or refunded as per our logistics management protocols.
    </Para>

    <SectionTitle>5. Refund Timeline and Method</SectionTitle>
    <Para>Once a refund is approved, the amount will be processed as follows:</Para>
    <div className="my-4 overflow-hidden rounded-2xl border border-primary-100">
      <table className="w-full text-sm">
        <thead className="bg-primary-50">
          <tr>
            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Payment Method</th>
            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Refund Method</th>
            <th className="px-4 py-3 text-left font-black uppercase tracking-[0.14em] text-primary-700">Timeline (After Approval)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-primary-50">
          <tr>
            <td className="px-4 py-3 font-semibold text-primary-900">Credit Card, Debit Card, Net Banking, UPI, Wallets</td>
            <td className="px-4 py-3 text-primary-900/70">Credit to original payment source</td>
            <td className="px-4 py-3 text-primary-900/70">5–7 business days</td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-semibold text-primary-900">Cash on Delivery (COD)</td>
            <td className="px-4 py-3 text-primary-900/70">Bank transfer (NEFT) to customer's bank account</td>
            <td className="px-4 py-3 text-primary-900/70">7–10 working days</td>
          </tr>
          <tr>
            <td className="px-4 py-3 font-semibold text-primary-900">Customer Preference</td>
            <td className="px-4 py-3 text-primary-900/70">Store credit or discount code</td>
            <td className="px-4 py-3 text-primary-900/70">Immediately issued</td>
          </tr>
        </tbody>
      </table>
    </div>

    <SectionTitle>6. Important Disclaimer and Consumer Responsibility</SectionTitle>
    <SubTitle>6.1 Package Acceptance</SubTitle>
    <Para>
      Customers must not accept any packages that appear visibly tampered with, opened, or significantly damaged at the time of delivery. You must immediately notify the delivery agent and contact us for assistance.
    </Para>
    <SubTitle>6.2 Manufacturer's Liability</SubTitle>
    <Para>
      This policy covers issues related to delivery and physical condition of the product. Any issues regarding product efficacy, results, or allergic reactions are the sole responsibility of the third-party manufacturer.
    </Para>
    <SubTitle>6.3 Jurisdiction</SubTitle>
    <Para>
      Any disputes or grievances arising from this policy shall be subject to the exclusive jurisdiction of the competent courts in <strong>Durg, Chhattisgarh, India</strong>.
    </Para>
  </div>
);

// ─── PRICING POLICY ───────────────────────────────────────────────────────────
const PricingPolicy: React.FC = () => (
  <div className="space-y-2">
    <SectionTitle>1. Transparent Product Pricing and Taxes</SectionTitle>
    <SubTitle>1.1 Final Price Display</SubTitle>
    <Ul>
      <Li>All prices displayed on the Website are <strong>inclusive of GST</strong> and any other statutory levies applicable to the specific product category (insecticides, fungicides, herbicides, etc.).</Li>
      <Li>The price displayed on the product page is the final price you pay for the product itself.</Li>
      <Li>The final order value at checkout will include the product price plus any applicable shipping and delivery charges. There are <strong>no hidden charges</strong>.</Li>
    </Ul>

    <SubTitle>1.2 Legal Metrology Compliance</SubTitle>
    <Para>
      We ensure all product packaging, labels, and the displayed price comply with the Legal Metrology (Packaged Commodities) Rules, 2011, including the accurate declaration of Net Quantity, Date of Manufacturing/Packing, and Maximum Retail Price (MRP). The price charged by VANIKI may be below or equal to the declared MRP set by the third-party manufacturer, but will <strong>never exceed the MRP</strong>.
    </Para>

    <SubTitle>1.3 Price Determination</SubTitle>
    <Para>Our pricing reflects the unique costs associated with selling regulated, high-quality agro-chemicals:</Para>
    <Ul>
      <Li><strong>Manufacturer Costs:</strong> Direct procurement cost from licensed, reputable third-party manufacturers (adhering to the Insecticides Act, 1968 standards).</Li>
      <Li><strong>Regulatory Compliance:</strong> Costs associated with licenses, mandatory record-keeping, batch traceability, and adherence to safety protocols.</Li>
      <Li><strong>Handling &amp; Storage:</strong> Costs for specialized, controlled storage and handling of chemical products necessary to maintain product efficacy and safety.</Li>
      <Li><strong>Quality &amp; Purity:</strong> Premium paid for genuine, non-adulterated, and effective formulations.</Li>
    </Ul>

    <SectionTitle>2. Shipping &amp; Delivery Charges</SectionTitle>
    <Ul>
      <Li><strong>Standard Delivery Fee:</strong> Shipping charges are determined based on the weight, volume, hazardous material classification, and final delivery location of the order.</Li>
      <Li><strong>Free Shipping Threshold:</strong> We offer free standard shipping on all prepaid orders exceeding a specified value (e.g., ₹2,000 or as displayed on the website at the time of order).</Li>
      <Li><strong>Charges at Checkout:</strong> Applicable delivery charges will be clearly itemized and displayed before you make the final payment.</Li>
      <Li><strong>Cash on Delivery (COD) Fee:</strong> Orders opting for COD may be subject to an additional nominal convenience fee, clearly shown at checkout.</Li>
    </Ul>

    <SectionTitle>3. Dynamic Pricing and Promotions</SectionTitle>
    <SubTitle>3.1 Price Adjustments</SubTitle>
    <Ul>
      <Li>Prices listed on the Website are subject to change without prior notice due to factors such as fluctuations in raw material costs, changes in regulatory taxes, or manufacturer price revisions.</Li>
      <Li><strong>Your Contracted Price:</strong> You will always be charged the price that was displayed on the Website and confirmed at the time you placed your order. Price changes occurring after order confirmation will not affect your placed order.</Li>
    </Ul>

    <SubTitle>3.2 Promotional Pricing</SubTitle>
    <Ul>
      <Li>VANIKI may run limited-time promotions, volume discounts, or bundled offers. The terms and conditions specific to these promotions will be clearly stated at the time of the offer.</Li>
      <Li>Discounts or special pricing are not applicable retroactively to orders already placed and confirmed.</Li>
    </Ul>

    <SectionTitle>4. Bulk, Commercial &amp; Institutional Orders</SectionTitle>
    <Para>We offer special pricing for bulk procurement by commercial farms, institutions, and B2B customers. Discounts are determined based on order quantity, frequency, and regulatory documentation provided (such as GSTIN and required licenses).</Para>
    <Para>For special pricing inquiries, please contact our commercial team directly:</Para>
    <Ul>
      <Li><strong>Email:</strong> <a href="mailto:vaniki.crop@gmail.com" className="font-bold text-primary hover:underline">vaniki.crop@gmail.com</a></Li>
      <Li><strong>Phone:</strong> +91-7582099000</Li>
    </Ul>

    <SectionTitle>5. Invoices and Financial Documentation</SectionTitle>
    <Ul>
      <Li><strong>Tax Invoice:</strong> A detailed, GST-compliant tax invoice will be issued for every successful order. This invoice will reflect the name and details of the registered manufacturer/importer for traceability.</Li>
      <Li><strong>Access:</strong> Invoices will be included with your shipment and can also be downloaded from your account dashboard or requested via email to <a href="mailto:vaniki.crop@gmail.com" className="font-bold text-primary hover:underline">vaniki.crop@gmail.com</a>.</Li>
    </Ul>
  </div>
);

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
const Policies: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PolicyTab>('shipping');

  const activeTabData = tabs.find((t) => t.id === activeTab)!;
  const ActiveIcon = activeTabData.icon;

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
        <h1 className="mt-4 max-w-4xl font-sans text-5xl font-black tracking-tight">Policies</h1>
        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-white/75">
          VANIKI CROP SCIENCE PRIVATE LIMITED — Transparent policies governing your experience with us.
        </p>
      </section>

      {/* Tab navigation */}
      <div className="mt-6 flex flex-wrap gap-2 sm:gap-3">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`policy-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black uppercase tracking-[0.14em] transition',
                activeTab === tab.id
                  ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                  : 'border-primary-100 bg-white text-primary-900/65 hover:border-primary-300 hover:bg-primary-50',
              )}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Policy content */}
      <article className="surface-card mt-4 p-6 sm:p-10">
        <div className="mb-8 flex items-center gap-3 border-b border-primary-100 pb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ActiveIcon size={20} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary-500">
              VANIKI CROP SCIENCE PRIVATE LIMITED
            </p>
            <h2 className="text-xl font-black text-primary-900">{activeTabData.label} Policy</h2>
          </div>
        </div>

        <div className="prose prose-primary max-w-none text-sm text-primary-900/80">
          {activeTab === 'shipping' && <ShippingPolicy />}
          {activeTab === 'refund' && <RefundPolicy />}
          {activeTab === 'pricing' && <PricingPolicy />}
        </div>
      </article>
    </div>
  );
};

export default Policies;
