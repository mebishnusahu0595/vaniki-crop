import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label displayed above the input */
  label?: string;
  /** Error message displayed below the input */
  error?: string;
  /** Helper text below the input */
  helperText?: string;
}

/**
 * Reusable form input component with label, error, and helper text support.
 * Styled with Vaniki Crop brand colors.
 * @param props - Input properties
 * @returns Input JSX element
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-[#1B1B1B] mb-1.5">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5 rounded-lg border bg-white text-[#1B1B1B]
            transition-all duration-200
            placeholder:text-[#6B7280]
            focus:outline-none focus:ring-2 focus:ring-[#52B788] focus:border-transparent
            ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-300'}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-[#6B7280]">{helperText}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
