import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title: string;
  description: string;
  path: string;
  type?: string;
}

const BASE_URL = 'https://smartimagesuite.com';

export default function SEOHead({ title, description, path, type = 'website' }: SEOHeadProps) {
  const url = `${BASE_URL}${path}`;
  const fullTitle = path === '/'
    ? 'SmartImageSuite — Free Online Image Tools | Compress, Background Removal, Passport Photo'
    : `${title} — SmartImageSuite`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="SmartImageSuite" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
    </Helmet>
  );
}
