import { Link } from 'react-router-dom';
import { ArrowRight, Minimize2, Scissors, Camera, Zap, Shield, Globe, RefreshCw, Crop, Sparkles, ZoomIn, Droplets, Type, CircleUser } from 'lucide-react';
import SEOHead from '../components/SEOHead';

const TOOLS = [
  {
    path: '/compress',
    icon: Minimize2,
    title: 'Compress Image',
    desc: 'Reduce image file size with adjustable quality levels or a target size limit.',
    color: 'text-green-500',
    bg: 'bg-green-50',
    btnColor: 'bg-green-600 hover:bg-green-700 shadow-green-500/25',
  },
  {
    path: '/remove-background',
    icon: Scissors,
    title: 'Remove Background',
    desc: 'Automatically remove backgrounds from photos — get a transparent PNG in seconds.',
    color: 'text-purple-500',
    bg: 'bg-purple-50',
    btnColor: 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/25',
  },
  {
    path: '/passport-photo',
    icon: Camera,
    title: 'Passport Photo',
    desc: 'Create passport-style photos with correct dimensions, custom background, and face positioning.',
    color: 'text-pink-500',
    bg: 'bg-pink-50',
    btnColor: 'bg-pink-600 hover:bg-pink-700 shadow-pink-500/25',
  },
  {
    path: '/format-converter',
    icon: RefreshCw,
    title: 'Format Converter',
    desc: 'Convert images between JPG, PNG, and WebP with full quality control.',
    color: 'text-teal-500',
    bg: 'bg-teal-50',
    btnColor: 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/25',
  },
  {
    path: '/crop-resize',
    icon: Crop,
    title: 'Crop & Resize',
    desc: 'Crop images to any aspect ratio and resize to exact dimensions.',
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    btnColor: 'bg-orange-600 hover:bg-orange-700 shadow-orange-500/25',
  },
  {
    path: '/auto-enhance',
    icon: Sparkles,
    title: 'Auto Enhance',
    desc: 'One-click brightness, contrast, saturation, and sharpness improvement.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
    btnColor: 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25',
  },
  {
    path: '/upscale',
    icon: ZoomIn,
    title: 'Image Upscaler',
    desc: 'Enlarge images 2× or 4× with Lanczos resampling and smart sharpening.',
    color: 'text-indigo-500',
    bg: 'bg-indigo-50',
    btnColor: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/25',
  },
  {
    path: '/watermark',
    icon: Droplets,
    title: 'Watermark Studio',
    desc: 'Add text or image watermarks with custom position, opacity, and rotation.',
    color: 'text-rose-500',
    bg: 'bg-rose-50',
    btnColor: 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25',
  },
  {
    path: '/text-on-image',
    icon: Type,
    title: 'Text on Image',
    desc: 'Add styled text layers with shadow, outline, and background box effects.',
    color: 'text-sky-500',
    bg: 'bg-sky-50',
    btnColor: 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/25',
  },
  {
    path: '/profile-picture',
    icon: CircleUser,
    title: 'Profile Picture',
    desc: 'Create perfectly sized profile photos for WhatsApp, Instagram, LinkedIn, and more.',
    color: 'text-violet-500',
    bg: 'bg-violet-50',
    btnColor: 'bg-violet-600 hover:bg-violet-700 shadow-violet-500/25',
  },
];

const STATS = [
  { value: '10+', label: 'Image Tools' },
  { value: '100%', label: 'Free to Use' },
  { value: '0', label: 'Sign-up Required' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    desc: 'Process your images in seconds with our optimized engine.',
    color: 'text-amber-500',
    bg: 'bg-amber-50',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'Your files are processed locally and never stored on our servers.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50',
  },
  {
    icon: Globe,
    title: 'Works Everywhere',
    desc: 'Use from any browser on any device — no installation required.',
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
];

export default function Home() {
  return (
    <div className="px-6 lg:px-10 py-10 max-w-6xl mx-auto">
      <SEOHead
        title="Free Online Image Tools"
        description="Free online image tools — compress, convert, crop, enhance, upscale, watermark, and more. No sign-up, no install. Your files stay private."
        path="/"
      />

      {/* ── Hero ── */}
      <section className="mb-16 animate-fade-up fill-both">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex-1 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary-50 border border-primary-100 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-soft" />
              <span className="text-xs font-semibold text-primary-700">Free & Open-Source Image Tools</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-5">
              Welcome to{' '}Smart
              <span className="gradient-text">ImageSuite</span>
            </h1>

            <p className="text-lg text-gray-500 leading-relaxed max-w-3xl mb-8">
              Smarter image tools for everyone. Compress, convert, crop, enhance, upscale, watermark, and more — all from your browser, completely free.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/compress" className="btn-primary">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="flex lg:flex-col gap-4 lg:gap-3">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex-1 lg:flex-none bg-white rounded-2xl border border-gray-200/70 px-6 py-4 text-center lg:text-left lg:min-w-[180px] shadow-sm hover:shadow-card transition-shadow duration-300"
              >
                <p className="text-2xl font-extrabold gradient-text">{stat.value}</p>
                <p className="text-xs font-medium text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tool Cards ── */}
      <section className="mb-20 animate-fade-up fill-both stagger-2 cv-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Our Image <span className="gradient-text">Tools</span>
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            Everything you need to process images — fast, free, and private.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.path}
                to={tool.path}
                className="bg-white rounded-2xl border border-gray-200/60 p-6 card-hover group text-left block"
              >
                <div className={`w-12 h-12 ${tool.bg} rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${tool.color}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">{tool.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-4">{tool.desc}</p>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-1.5 rounded-lg ${tool.btnColor} shadow-lg transition-all`}>
                  Use Tool <ArrowRight className="w-3 h-3" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── Why SmartImageSuite ── */}
      <section className="mb-16 animate-fade-up fill-both stagger-3 cv-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Why Smart<span className="gradient-text">ImageSuite</span>?
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            Built for speed, privacy, and simplicity.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="bg-white rounded-2xl border border-gray-200/60 p-6 card-hover group text-center"
              >
                <div className={`w-12 h-12 ${feature.bg} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className={`w-6 h-6 ${feature.color}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-1.5">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
