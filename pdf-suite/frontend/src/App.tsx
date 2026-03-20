import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import CookieConsent from './components/CookieConsent';
import Home from './pages/Home';

/* ── Lazy-loaded pages (code-split per route) ── */
const MergePage = lazy(() => import('./pages/MergePage'));
const SplitPage = lazy(() => import('./pages/SplitPage'));
const CompressPage = lazy(() => import('./pages/CompressPage'));
const ConvertPage = lazy(() => import('./pages/ConvertPage'));
const WatermarkPage = lazy(() => import('./pages/WatermarkPage'));
const EsignPage = lazy(() => import('./pages/EsignPage'));
const OrganizePage = lazy(() => import('./pages/OrganizePage'));
const ProtectPage = lazy(() => import('./pages/ProtectPage'));
const UnlockPage = lazy(() => import('./pages/UnlockPage'));
const RedactPage = lazy(() => import('./pages/RedactPage'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Disclaimer = lazy(() => import('./pages/Disclaimer'));
const BlogListPage = lazy(() => import('./pages/BlogListPage'));
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/merge" element={<Suspense fallback={<PageLoader />}><MergePage /></Suspense>} />
          <Route path="/split" element={<Suspense fallback={<PageLoader />}><SplitPage /></Suspense>} />
          <Route path="/compress" element={<Suspense fallback={<PageLoader />}><CompressPage /></Suspense>} />
          <Route path="/convert" element={<Suspense fallback={<PageLoader />}><ConvertPage /></Suspense>} />
          <Route path="/watermark" element={<Suspense fallback={<PageLoader />}><WatermarkPage /></Suspense>} />
          <Route path="/esign" element={<Suspense fallback={<PageLoader />}><EsignPage /></Suspense>} />
          <Route path="/organize" element={<Suspense fallback={<PageLoader />}><OrganizePage /></Suspense>} />
          <Route path="/protect" element={<Suspense fallback={<PageLoader />}><ProtectPage /></Suspense>} />
          <Route path="/unlock" element={<Suspense fallback={<PageLoader />}><UnlockPage /></Suspense>} />
          <Route path="/redact" element={<Suspense fallback={<PageLoader />}><RedactPage /></Suspense>} />
          <Route path="/privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense>} />
          <Route path="/terms" element={<Suspense fallback={<PageLoader />}><TermsOfService /></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageLoader />}><About /></Suspense>} />
          <Route path="/contact" element={<Suspense fallback={<PageLoader />}><Contact /></Suspense>} />
          <Route path="/help-center" element={<Suspense fallback={<PageLoader />}><HelpCenterPage /></Suspense>} />
          <Route path="/disclaimer" element={<Suspense fallback={<PageLoader />}><Disclaimer /></Suspense>} />
          <Route path="/blog" element={<Suspense fallback={<PageLoader />}><BlogListPage /></Suspense>} />
          <Route path="/blog/:slug" element={<Suspense fallback={<PageLoader />}><BlogPostPage /></Suspense>} />
        </Route>
      </Routes>
      <CookieConsent />
    </BrowserRouter>
  );
}
