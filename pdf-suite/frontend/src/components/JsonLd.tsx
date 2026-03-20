import { Helmet } from 'react-helmet-async';

interface JsonLdProps {
  data: Record<string, unknown>;
}

export default function JsonLd({ data }: JsonLdProps) {
  return (
    <Helmet>
      <script type="application/ld+json">
        {JSON.stringify(data)}
      </script>
    </Helmet>
  );
}

/** Reusable schema for the organization */
export const ORGANIZATION_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SmartPDFSuite',
  url: 'https://smartpdfsuite.com',
  description: 'Free online PDF tools — merge, split, compress, convert, watermark, eSign, organize, protect, unlock, and redact PDFs. No sign-up required.',
  sameAs: [],
};

/** Schema for the website with sitelinks searchbox potential */
export const WEBSITE_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'SmartPDFSuite',
  url: 'https://smartpdfsuite.com',
  description: 'Free online PDF tools for everyone. No sign-up required.',
};

/** Schema for a WebApplication (our tool pages) */
export function toolSchema(name: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name,
    description,
    url,
    applicationCategory: 'UtilityApplication',
    operatingSystem: 'All',
    isAccessibleForFree: true,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    provider: {
      '@type': 'Organization',
      name: 'SmartPDFSuite',
      url: 'https://smartpdfsuite.com',
    },
  };
}
