import React from 'react';
import { motion } from 'framer-motion';

interface LoaderProps {
  /** Size of the loader in pixels */
  size?: number;
  /** Color of the loader */
  color?: string;
  /** Full screen overlay */
  fullScreen?: boolean;
}

/**
 * Animated loading spinner using Framer Motion.
 * Supports inline usage and full-screen overlay mode.
 * @param props - Loader properties
 * @returns Animated loader JSX element
 */
export function Loader({ size = 40, color = '#2D6A4F', fullScreen = false }: LoaderProps) {
  const spinner = (
    <motion.div
      style={{
        width: size,
        height: size,
        border: `3px solid ${color}20`,
        borderTopColor: color,
        borderRadius: '50%',
      }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {spinner}
      </div>
    );
  }

  return <div className="flex items-center justify-center p-4">{spinner}</div>;
}
