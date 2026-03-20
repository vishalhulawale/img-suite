import { Link } from 'react-router-dom';
import { FileText, Mail, Shield, Zap, Globe, Heart, ArrowRight, Sparkles, Users, CheckCircle } from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function About() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <SEOHead
        title="About Us"
        description="SmartPDFSuite provides fast, free, and secure PDF tools for everyone. No downloads, no sign-ups, no hidden fees."
        path="/about"
      />
      {/* Hero section */}
      <section className="text-center mb-16 animate-fade-up fill-both">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-primary-50 border border-primary-100 rounded-full mb-6">
          <Sparkles className="w-3.5 h-3.5 text-primary-500" />
          <span className="text-xs font-semibold text-primary-700">About Us</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 leading-[1.1] mb-5">
          About Smart<span className="gradient-text">PDFSuite</span>
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed max-w-2xl mx-auto">
          Smarter PDF tools for everyone. Fast, free, and secure document management — no downloads, no sign-ups, no hidden fees.
        </p>
      </section>

      {/* Mission card */}
      <section className="mb-12 animate-fade-up fill-both stagger-2">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-600 rounded-3xl p-8 sm:p-10 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative flex items-start gap-5">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-lg rounded-2xl flex items-center justify-center flex-shrink-0">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-3">Our Mission</h2>
              <p className="text-white/85 leading-relaxed text-base">
                Smart<span className="font-semibold">PDFSuite</span> was built with a simple goal: to provide fast, free, and secure PDF
                tools that anyone can use — without downloads, sign-ups, or hidden fees. We believe
                that essential document tools should be accessible to everyone, everywhere.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mb-12 animate-fade-up fill-both stagger-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { value: '10+', label: 'PDF Tools', icon: Sparkles, color: 'text-primary-600', bg: 'bg-primary-50' },
            { value: '100%', label: 'Free to Use', icon: Globe, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { value: '0', label: 'Sign-up Required', icon: Users, color: 'text-secondary-600', bg: 'bg-secondary-50' },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200/70 p-6 text-center card-hover shadow-sm">
                <div className={`w-12 h-12 ${stat.bg} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <p className="text-3xl font-extrabold gradient-text mb-1">{stat.value}</p>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* What we offer */}
      <section className="mb-12 animate-fade-up fill-both stagger-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
            What We <span className="gradient-text">Offer</span>
          </h2>
          <p className="text-sm text-gray-400 mt-2 max-w-md mx-auto">
            A comprehensive suite of tools for all your PDF needs.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { tool: 'Merge PDF', desc: 'Combine multiple PDFs into one document', color: 'text-purple-500', bg: 'bg-purple-50' },
            { tool: 'Split PDF', desc: 'Extract or separate pages from a PDF', color: 'text-lime-500', bg: 'bg-lime-50' },
            { tool: 'Compress PDF', desc: 'Reduce file size without losing quality', color: 'text-green-500', bg: 'bg-green-50' },
            { tool: 'Convert PDF', desc: 'Convert PDFs to Word, Excel, or images', color: 'text-indigo-500', bg: 'bg-indigo-50' },
            { tool: 'Watermark', desc: 'Add text or image watermarks', color: 'text-cyan-500', bg: 'bg-cyan-50' },
            { tool: 'eSign PDF', desc: 'Add electronic signatures to documents', color: 'text-pink-400', bg: 'bg-pink-50' },
            { tool: 'Organize PDF', desc: 'Reorder, rotate, and manage pages', color: 'text-yellow-400', bg: 'bg-yellow-50' },
            { tool: 'Protect PDF', desc: 'Encrypt with AES-256 password protection', color: 'text-orange-400', bg: 'bg-orange-50' },
            { tool: 'Unlock PDF', desc: 'Remove password protection from PDFs', color: 'text-teal-500', bg: 'bg-teal-50' },
            { tool: 'Redact PDF', desc: 'Permanently mask sensitive information', color: 'text-red-500', bg: 'bg-red-50' },
          ].map((item) => (
            <div key={item.tool} className="bg-white rounded-2xl border border-gray-200/60 p-5 card-hover group">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 ${item.bg} rounded-lg flex items-center justify-center`}>
                  <CheckCircle className={`w-4 h-4 ${item.color}`} />
                </div>
                <p className="font-semibold text-gray-900 text-sm">{item.tool}</p>
              </div>
              <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature cards row */}
      <section className="mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Privacy */}
          <div className="bg-white rounded-2xl border border-gray-200/60 p-6 card-hover">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-green-50 rounded-xl flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Your Privacy Matters</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              All files are processed in-memory on our secure servers and are <strong>automatically deleted immediately</strong> after processing.
              We never store, share, or access your documents. All transfers are encrypted with HTTPS/TLS.
            </p>
            <Link to="/privacy" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:text-primary-700 hover:gap-2.5 transition-all duration-300">
              Read Privacy Policy <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Technology */}
          <div className="bg-white rounded-2xl border border-gray-200/60 p-6 card-hover">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Built for Performance</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Built with modern technologies for speed and reliability — Python with FastAPI for high-performance
              async processing, React for a seamless UI. We leverage trusted open-source libraries like PyMuPDF,
              Pillow, and ReportLab for reliable PDF processing.
            </p>
          </div>

          {/* Free */}
          <div className="bg-white rounded-2xl border border-gray-200/60 p-6 card-hover">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-cyan-50 rounded-xl flex items-center justify-center">
                <Globe className="w-5 h-5 text-cyan-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Free for Everyone</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Smart<span className="gradient-text font-semibold">PDFSuite</span> is completely free. Our service is supported by
              advertisements, allowing us to keep all tools accessible. No account registration or
              subscription required — just visit the site and start working.
            </p>
          </div>

          {/* Contact */}
          <div className="bg-white rounded-2xl border border-gray-200/60 p-6 card-hover">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-rose-50 rounded-xl flex items-center justify-center">
                <Mail className="w-5 h-5 text-rose-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Contact Us</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3">
              Have questions, feedback, or need help? We'd love to hear from you.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 w-24">General:</span>
                <a href="mailto:contact@smartpdfsuite.com" className="text-sm text-primary-600 hover:underline">contact@smartpdfsuite.com</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 w-24">Privacy:</span>
                <a href="mailto:privacy@smartpdfsuite.com" className="text-sm text-primary-600 hover:underline">privacy@smartpdfsuite.com</a>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-500 w-24">Support:</span>
                <a href="mailto:support@smartpdfsuite.com" className="text-sm text-primary-600 hover:underline">support@smartpdfsuite.com</a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
