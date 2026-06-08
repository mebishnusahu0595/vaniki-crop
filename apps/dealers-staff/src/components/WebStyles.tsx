import React from 'react';
import { Platform } from 'react-native';

export const WebStyles = () => {
  if (Platform.OS !== 'web') return null;

  return (
    <style dangerouslySetInnerHTML={{ __html: `
      :root {
        --primary-50: #f0faf5;
        --primary-100: #dcf4e8;
        --primary-200: #b9e9d1;
        --primary-300: #84d4b0;
        --primary-400: #52B788;
        --primary-500: #2D6A4F;
        --primary-600: #1b4d3a;
        --primary-700: #143d2e;
        --primary-800: #0d2f23;
        --primary-900: #082018;
        --offwhite: #F8FAF9;
      }

      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        background-color: var(--offwhite);
      }

      .flex-1 { flex: 1; }
      .items-center { align-items: center; }
      .justify-center { justify-content: center; }
      .flex-row { flex-direction: row; }
      .flex-col { flex-direction: column; }
      .w-full { width: 100%; }
      .h-full { height: 100%; }

      .p-4 { padding: 1rem; }
      .p-5 { padding: 1.25rem; }
      .p-8 { padding: 2rem; }
      .px-4 { padding-left: 1rem; padding-right: 1rem; }
      .py-8 { padding-top: 2rem; padding-bottom: 2rem; }
      .mt-2 { margin-top: 0.5rem; }
      .mt-3 { margin-top: 0.75rem; }
      .mt-4 { margin-top: 1rem; }
      .mt-5 { margin-top: 1.25rem; }
      .mt-7 { margin-top: 1.75rem; }
      .mb-2 { margin-bottom: 0.5rem; }

      .bg-white { background-color: #ffffff; }
      .bg-offwhite { background-color: var(--offwhite); }
      .bg-primary-50 { background-color: var(--primary-50); }
      .bg-primary-500 { background-color: var(--primary-500); }
      .bg-primary-900 { background-color: var(--primary-900); }

      .text-center { text-align: center; }
      .text-white { color: #ffffff; }
      .text-primary-500 { color: var(--primary-500); }
      .text-primary-900 { color: var(--primary-900); }
      .text-primary-900\\/60 { color: rgba(8, 32, 24, 0.6); }
      .text-primary-900\\/65 { color: rgba(8, 32, 24, 0.65); }
      .text-xs { font-size: 0.75rem; }
      .text-sm { font-size: 0.875rem; }
      .text-base { font-size: 1rem; }
      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
      .font-black { font-weight: 900; }
      .font-bold { font-weight: 700; }
      .uppercase { text-transform: uppercase; }
      .tracking-\\[1px\\] { letter-spacing: 1px; }
      .tracking-\\[2px\\] { letter-spacing: 2px; }

      .border { border: 1px solid #e5e7eb; }
      .border-primary-100 { border: 1px solid var(--primary-100); }
      .rounded-full { border-radius: 9999px; }
      .rounded-2xl { border-radius: 1rem; }
      .rounded-3xl { border-radius: 1.5rem; }
      .rounded-\\[22px\\] { border-radius: 22px; }
      .rounded-\\[32px\\] { border-radius: 32px; }

      .input-field {
        width: 100%;
        border-radius: 22px;
        border: 1px solid var(--primary-100);
        background-color: var(--primary-50);
        padding: 1rem;
        font-size: 1rem;
        color: var(--primary-900);
        outline: none;
      }

      .btn-primary {
        background-color: var(--primary-900);
        padding: 1rem 1.25rem;
        border-radius: 9999px;
        border: none;
        cursor: pointer;
      }

      .btn-text {
        color: #ffffff;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 2px;
        text-align: center;
      }
    ` }} />
  );
};
