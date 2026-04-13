import React, { useEffect, useRef, useState } from 'react';

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleSignInButtonProps {
  clientId?: string;
  onCredential: (idToken: string) => void | Promise<void>;
  text?: 'signin_with' | 'signup_with' | 'continue_with';
  disabled?: boolean;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            container: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              shape?: 'pill' | 'rectangular' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with';
              width?: number;
            },
          ) => void;
        };
      };
    };
  }
}

let googleScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In is only available in browser.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-google-identity]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('Failed to load Google script.')), { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google script.'));
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
}

const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  clientId,
  onCredential,
  text = 'signin_with',
  disabled = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!clientId || disabled) {
      return;
    }

    let cancelled = false;
    setErrorMessage('');

    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google?.accounts?.id) return;

        const width = containerRef.current.clientWidth || 360;
        containerRef.current.innerHTML = '';

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: GoogleCredentialResponse) => {
            if (cancelled) return;
            const idToken = response.credential;
            if (!idToken) {
              setErrorMessage('Google authentication failed. Please try again.');
              return;
            }
            void onCredential(idToken);
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : 'Google sign-in is unavailable right now.');
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, onCredential, text]);

  if (!clientId) {
    return (
      <p className="text-center text-xs font-semibold text-primary-900/55">
        Google sign-in is not configured for this environment.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="w-full" />
      {errorMessage ? (
        <p className="text-center text-xs font-semibold text-red-500">{errorMessage}</p>
      ) : null}
    </div>
  );
};

export default GoogleSignInButton;
