import React from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  ShoppingCart, 
  Truck, 
  Info, 
  ArrowDownToLine, 
  CheckCircle2 
} from 'lucide-react';

const Dealers: React.FC = () => {
  const handleDownload = () => {
    // Direct link to the APK in public directory with cache-busting query parameter
    const link = document.createElement('a');
    link.href = `/vaniki-dealers-release.apk?v=${Date.now()}`;
    link.download = 'vaniki-dealers-release.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const features = [
    {
      icon: <ShoppingCart className="h-6 w-6 text-primary" />,
      title: "Easy Ordering",
      description: "Directly order insecticides, pesticides, and seeds from verified manufacturers at competitive dealer prices."
    },
    {
      icon: <TrendingUp className="h-6 w-6 text-primary" />,
      title: "Real-time Analytics",
      description: "Track your sales, pending orders, revenue graphs, and business performance metrics right from your dashboard."
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-primary" />,
      title: "Secure Payments",
      description: "Multiple safe payment methods with instant invoicing and ledger statements for transparency."
    },
    {
      icon: <Truck className="h-6 w-6 text-primary" />,
      title: "Fast Delivery",
      description: "Direct dispatch with real-time delivery tracking so you never run out of inventory."
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6">
      {/* Hero Banner */}
      <section className="surface-card overflow-hidden bg-[linear-gradient(135deg,_rgba(20,61,46,1),_rgba(8,32,24,0.96))] px-6 py-12 text-white sm:px-10 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-200">Exclusive Dealer Application</p>
            <h1 className="mt-4 font-heading text-4xl font-bold leading-tight sm:text-5xl md:text-6xl">
              Grow Your Business With Vaniki Crop
            </h1>
            <p className="mt-6 max-w-lg text-base font-medium leading-relaxed text-white/80">
              Introducing the official **Vaniki Dealers App** — designed specifically for authorized retailers and distributors to manage inventory, track orders, and boost daily sales.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-3 rounded-full bg-primary hover:bg-primary-600 px-8 py-4 text-sm font-black uppercase tracking-[0.15em] text-white shadow-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <ArrowDownToLine className="h-5 w-5 animate-bounce" />
                Download Android APK
              </button>
            </div>
          </div>
          <div className="relative flex justify-center">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-2 shadow-2xl backdrop-blur-sm max-w-xs md:max-w-sm">
              <img 
                src="/dealer_hero.png" 
                alt="Vaniki Crop Science Retail Shop" 
                className="rounded-2xl object-cover w-full h-auto aspect-square shadow-inner"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Features & Mockups */}
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        {/* Left Side: Mockup showcase */}
        <section className="surface-card flex flex-col items-center justify-center p-8 text-center bg-primary-50/50">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-primary-600">Application Interface</p>
          <h2 className="mt-3 font-heading text-3xl font-black text-primary-900">Designed for Simplicity</h2>
          <p className="mt-4 max-w-md text-sm font-semibold text-primary-900/60">
            An intuitive and modern layout built to save you time. Easily check stock availability and manage order requests from anywhere.
          </p>
          
          <div className="mt-8 relative max-w-xs w-full">
            {/* Phone Mockup Frame wrapper */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--color-primary-100)_0%,_transparent_70%)] -z-10 blur-xl scale-125" />
            <img 
              src="/dealer_app_mockup.png" 
              alt="Vaniki Dealers App Interface Mockup" 
              className="w-full h-auto rounded-[2.5rem] shadow-2xl border-4 border-primary-900/5 transition-transform duration-500 hover:scale-[1.03]"
            />
          </div>
        </section>

        {/* Right Side: Features & How to Install */}
        <div className="space-y-8">
          {/* Features Grid */}
          <section className="surface-card p-8">
            <h3 className="font-heading text-2xl font-black text-primary-900 mb-6">Key App Features</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              {features.map((feature, idx) => (
                <div key={idx} className="flex gap-4 p-4 rounded-2xl bg-primary-50/30 border border-primary-100/20">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-primary-900">{feature.title}</h4>
                    <p className="mt-1.5 text-xs font-semibold leading-relaxed text-primary-900/60">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Installation Guide */}
          <section className="surface-card p-8 border-l-4 border-amber-500 bg-amber-50/15">
            <div className="flex gap-3">
              <Info className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-heading text-xl font-black text-primary-900">How to Install (Android Only)</h3>
                <p className="mt-2 text-sm font-semibold text-primary-900/70">
                  Since this is a specialized dealer portal not available on the public Play Store, follow these steps to install the APK file directly:
                </p>
                <ul className="mt-5 space-y-3.5">
                  {[
                    "Click the **Download Android APK** button above to download the file.",
                    "Open your device's **Downloads** or File Manager and tap the downloaded `vaniki-dealers-release.apk` file.",
                    "If prompted, toggle on **'Allow from this source'** or **'Unknown Sources'** in your settings to grant installation permission.",
                    "Tap **Install** and open the application to login with your authorized dealer credentials."
                  ].map((step, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-xs font-semibold text-primary-900/80">
                      <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        <strong>Step {idx + 1}:</strong> {step.replace(/\*\*(.*?)\*\*/g, '$1')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dealers;
