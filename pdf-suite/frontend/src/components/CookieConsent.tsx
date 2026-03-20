import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'cookie_consent';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY);
    if (!consent) {
      // Delay showing so the banner doesn't become the LCP element.
      // Using requestIdleCallback ensures the hero has painted first.
      const schedule =
        typeof window.requestIdleCallback === 'function'
          ? window.requestIdleCallback
          : (cb: () => void) => setTimeout(cb, 2500);

      const id = schedule(() => setShow(true));
      return () => {
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(id as number);
        } else {
          clearTimeout(id as ReturnType<typeof setTimeout>);
        }
      };
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[100] p-4"
      style={{ contain: 'layout style' }}
    >
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 sm:p-6 animate-slide-up">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex w-10 h-10 bg-amber-50 rounded-lg items-center justify-center flex-shrink-0 mt-0.5">
            <Cookie className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 mb-1">We use cookies</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              We use cookies and similar technologies to enhance your experience and serve
              personalized ads through Google AdSense. By clicking "Accept All," you consent to
              the use of all cookies. You can manage your preferences or learn more in our{' '}
              <Link to="/privacy" className="text-blue-700 underline hover:text-blue-900">
                Privacy Policy
              </Link>
              .
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-4">
              <button
                onClick={accept}
                className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Accept All
              </button>
              <button
                onClick={decline}
                className="px-5 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reject Non-Essential
              </button>
            </div>
          </div>
          <button
            onClick={decline}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Close cookie banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
