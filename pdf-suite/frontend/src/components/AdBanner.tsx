import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

interface AdBannerProps {
  /** Ad slot ID from your AdSense dashboard, e.g. "1234567890" */
  slot: string;
  /** Ad format — defaults to "auto" (responsive) */
  format?: 'auto' | 'horizontal' | 'vertical' | 'rectangle';
  /** Whether to use full-width responsive mode — defaults to true */
  responsive?: boolean;
  /** Optional extra CSS classes on the wrapper div */
  className?: string;
}

export default function AdBanner({
  slot,
  format = 'auto',
  responsive = true,
  className = '',
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    // Only push once per mount
    if (pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // adsbygoogle not loaded yet — ignore
    }
  }, []);

  return (
    <div className={`ad-container overflow-hidden text-center ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
        data-ad-slot={slot}
        data-ad-format={format}
        {...(responsive && { 'data-full-width-responsive': 'true' })}
      />
    </div>
  );
}
