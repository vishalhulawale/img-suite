import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Play,
  BookOpen,
  Zap,
  Shield,
  Globe,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { LEARN_CARDS } from '../data/homeLearnCards';
import SEOHead from '../components/SEOHead';
import JsonLd, { ORGANIZATION_SCHEMA, WEBSITE_SCHEMA } from '../components/JsonLd';

/* ── Data ─────────────────────────────────────── */

const STATS = [
  { value: '10+', label: 'PDF Tools' },
  { value: '100%', label: 'Free to Use' },
  { value: '0', label: 'Sign-up Required' },
];

const FEATURES = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    desc: 'Process your PDFs in seconds with our optimized engine.',
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

const YOUTUBE_VIDEO_ID = 'tiWt5cPboZQ';

/* ── Component ────────────────────────────────── */

export default function Home() {
  const [videoPlaying, setVideoPlaying] = useState(false);
  const videoSectionRef = useRef<HTMLElement>(null);

  const scrollToVideo = () => {
    videoSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="px-6 lg:px-10 py-10 max-w-6xl mx-auto">
      <SEOHead
        title="Free Online PDF Tools"
        description="Free online PDF tools — merge, split, compress, convert, watermark, eSign, organize, protect, unlock, and redact PDFs. No sign-up, no install. Your files stay private."
        path="/"
      />
      <JsonLd data={ORGANIZATION_SCHEMA} />
      <JsonLd data={WEBSITE_SCHEMA} />
      {/* ── Hero / Intro Section ─────────────────── */}
      <section className="mb-8 animate-fade-up fill-both">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div className="flex-1 max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary-50 border border-primary-100 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-soft" />
              <span className="text-xs font-semibold text-primary-700">Free & Open Source PDF Tools</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-5">
              Welcome to{' '}Smart
              <span className="gradient-text">PDFSuite</span>
            </h1>
            <p className="text-lg text-gray-500 leading-relaxed max-w-3xl mb-8">
              Smarter PDF tools for everyone. Easily merge, compress, convert,
              sign, and protect your documents — all from your browser, completely free.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <Link to="#" onClick={(e) => { e.preventDefault(); scrollToVideo(); }} className="btn-primary">
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/blog" className="btn-secondary">
                <BookOpen className="w-4 h-4" />
                Browse PDF guides
              </Link>
            </div>
          </div>

          {/* Stats cards */}
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

      {/* ── Demo Video Section ───────────────────── */}
      <section ref={videoSectionRef} className="mb-20 animate-fade-up fill-both stagger-2 cv-auto">
        <div className="relative bg-white rounded-3xl shadow-card border border-gray-200/60 overflow-hidden">
          {/* Video container — lazy-loaded: shows a thumbnail until the user clicks play */}
          <div className="relative aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 overflow-hidden group">
            {!videoPlaying ? (
              <button
                type="button"
                onClick={() => setVideoPlaying(true)}
                className="relative w-full h-full cursor-pointer bg-transparent border-0 p-0"
                aria-label="Play demo video"
              >
                {/* YouTube thumbnail — self-hosted, responsive sizes */}
                <img
                  src="/img/video-thumb-hq.jpg"
                  srcSet="/img/video-thumb-hq.jpg 480w, /img/video-thumb-sd.jpg 640w"
                  sizes="(max-width: 480px) 100vw, 640px"
                  alt="SmartPDFSuite demo video thumbnail"
                  className="w-full h-full object-cover"
                  width={640}
                  height={480}
                  fetchPriority="high"
                />
                {/* Dark overlay */}
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors duration-300" />
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform duration-300">
                    <Play className="w-7 h-7 sm:w-8 sm:h-8 text-gray-900 ml-1" fill="currentColor" />
                  </div>
                </div>
              </button>
            ) : (
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="w-full h-full rounded-3xl"
                style={{ minHeight: 320 }}
                loading="lazy"
              />
            )}
          </div>
        </div>
      </section>

      {/* ── Why SmartPDFSuite ─────────────────────── */}
      <section className="mb-20 animate-fade-up fill-both stagger-3 cv-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            Why Smart<span className="gradient-text">PDFSuite</span>?
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

      {/* ── Learn About PDF Editing ──────────────── */}
      <section className="mb-8 animate-fade-up fill-both stagger-4 cv-auto">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Learn About PDF{' '}
              <span className="gradient-text">Editing</span>
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              Quick guides to get the most out of your PDF tools.
            </p>
          </div>
          <Link
            to="/blog"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:gap-2.5 transition-all duration-300"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {LEARN_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.title}
                className={`bg-white rounded-2xl border border-gray-200/60 p-6 card-hover group ${card.accentColor} transition-colors`}
              >
                <div
                  className={`w-11 h-11 ${card.iconBg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}
                >
                  <Icon className={`w-5 h-5 ${card.iconColor}`} />
                </div>
                <h3 className="text-base font-semibold text-gray-900 mb-2">
                  {card.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  {card.desc}
                </p>
                <Link
                  to={`/blog/${card.slug}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 group-hover:gap-2.5 transition-all duration-300"
                >
                  {card.linkText}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
