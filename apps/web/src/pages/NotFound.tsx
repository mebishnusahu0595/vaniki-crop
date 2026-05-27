import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Compass, ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-16 sm:px-6 flex flex-col items-center justify-center min-h-[70vh]">
      <div className="relative flex flex-col items-center max-w-xl text-center">
        {/* Animated Background Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-72 h-72 bg-[radial-gradient(circle_at_center,_var(--color-primary-100)_0%,_transparent_70%)] opacity-60 blur-2xl -z-10" />

        {/* 404 Number with floating animation */}
        <motion.div
          initial={{ y: -10 }}
          animate={{ y: 10 }}
          transition={{
            repeat: Infinity,
            repeatType: "reverse",
            duration: 3,
            ease: "easeInOut"
          }}
          className="text-8xl md:text-9xl font-black font-sans tracking-tight bg-gradient-to-br from-primary to-primary-900 bg-clip-text text-transparent drop-shadow-sm select-none"
        >
          404
        </motion.div>

        {/* Nature/Seed Icon badge */}
        <div className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Compass className="h-6 w-6 animate-spin" style={{ animationDuration: '8s' }} />
        </div>

        {/* Title */}
        <h1 className="mt-6 text-3xl font-black text-primary-900 font-sans tracking-tight sm:text-4xl">
          Page Not Found
        </h1>

        {/* Description with organic metaphor */}
        <p className="mt-4 text-base font-semibold leading-relaxed text-primary-900/60">
          This plot of land seems empty. The page you are looking for has been harvested, moved, or never existed in our fields.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center w-full">
          <Link
            to="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full bg-primary hover:bg-primary-600 px-8 py-3.5 text-sm font-black uppercase tracking-[0.15em] text-white shadow-lg transition duration-200 transform hover:-translate-y-0.5"
          >
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
          
          <button
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-full border border-primary-200 hover:bg-primary-50 px-8 py-3.5 text-sm font-black uppercase tracking-[0.15em] text-primary-900 transition duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
