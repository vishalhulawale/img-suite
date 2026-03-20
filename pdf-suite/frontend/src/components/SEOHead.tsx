import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  type?: string;
}

const BASE_URL = 'https://smartpdfsuite.com';

export default function SEOHead({ title, description, path, type = 'website' }: SEOHeadProps) {
  const url = `${BASE_URL}${path}`;
  const fullTitle = path === '/'
    ? 'SmartPDFSuite — Free Online PDF Tools | Merge, Split, Compress, Convert'
    : `${title} — SmartPDFSuite`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="SmartPDFSuite" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
