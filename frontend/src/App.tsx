import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';

const CompressPage = lazy(() => import('./pages/CompressPage'));
const RemoveBackgroundPage = lazy(() => import('./pages/RemoveBackgroundPage'));
const PassportPhotoPage = lazy(() => import('./pages/PassportPhotoPage'));
const FormatConverterPage = lazy(() => import('./pages/FormatConverterPage'));
const CropResizePage = lazy(() => import('./pages/CropResizePage'));
const AutoEnhancePage = lazy(() => import('./pages/AutoEnhancePage'));
const ImageUpscalerPage = lazy(() => import('./pages/ImageUpscalerPage'));
const WatermarkStudioPage = lazy(() => import('./pages/WatermarkStudioPage'));
const TextOnImagePage = lazy(() => import('./pages/TextOnImagePage'));
const ProfilePicturePage = lazy(() => import('./pages/ProfilePicturePage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-4 border-gray-200 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );
}

const S = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={<PageLoader />}>{children}</Suspense>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/compress" element={<S><CompressPage /></S>} />
          <Route path="/remove-background" element={<S><RemoveBackgroundPage /></S>} />
          <Route path="/passport-photo" element={<S><PassportPhotoPage /></S>} />
          <Route path="/format-converter" element={<S><FormatConverterPage /></S>} />
          <Route path="/crop-resize" element={<S><CropResizePage /></S>} />
          <Route path="/auto-enhance" element={<S><AutoEnhancePage /></S>} />
          <Route path="/upscale" element={<S><ImageUpscalerPage /></S>} />
          <Route path="/watermark" element={<S><WatermarkStudioPage /></S>} />
          <Route path="/text-on-image" element={<S><TextOnImagePage /></S>} />
          <Route path="/profile-picture" element={<S><ProfilePicturePage /></S>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
