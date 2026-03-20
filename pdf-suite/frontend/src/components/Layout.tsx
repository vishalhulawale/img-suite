import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  FileText,
  Home,
  Merge,
  Minimize2,
  RefreshCw,
  Droplets,
  PenTool,
  LayoutGrid,
  Lock,
  Unlock,
  Search,
  ChevronRight,
  Menu,
  X,
  Scissors,
  EyeOff,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home, color: 'text-blue-500' },
  { path: '/merge', label: 'Merge', icon: Merge, color: 'text-purple-500' },
  { path: '/compress', label: 'Compress', icon: Minimize2, color: 'text-green-500' },
  { path: '/convert', label: 'Convert', icon: RefreshCw, color: 'text-indigo-500' },
  { path: '/organize', label: 'Organize', icon: LayoutGrid, color: 'text-yellow-400' },
  { path: '/watermark', label: 'Watermark', icon: Droplets, color: 'text-cyan-500' },
  { path: '/esign', label: 'eSign', icon: PenTool, color: 'text-pink-400' },
  { path: '/protect', label: 'Protect', icon: Lock, color: 'text-orange-400' },
  { path: '/unlock', label: 'Unlock', icon: Unlock, color: 'text-teal-500' },
];

const MORE_TOOLS = [
  { path: '/split', label: 'Split PDF', icon: Scissors, color: 'text-lime-500' },
  { path: '/redact', label: 'Redact PDF', icon: EyeOff, color: 'text-red-500' },
];

const FOOTER_TOOLS = [
  { path: '/merge', label: 'Merge PDFs' },
  { path: '/compress', label: 'Compress PDFs' },
  { path: '/convert', label: 'Convert PDFs' },
  { path: '/esign', label: 'eSign PDFs' },
];

const FOOTER_COMPANY = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/contact', label: 'Contact' },
];

const FOOTER_RESOURCES = [
  { path: '/help-center', label: 'Help Center' },
  { path: '/blog', label: 'Blog' },
  { path: '/privacy', label: 'Privacy Policy' },
];

// Simple search filter for tools
function useToolSearch(query: string) {
  const allTools = [...NAV_ITEMS.slice(1), ...MORE_TOOLS];
  if (!query.trim()) return [];
  return allTools.filter((t) =>
    t.label.toLowerCase().includes(query.toLowerCase()),
  );
}

export default function Layout() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchResults = useToolSearch(searchQuery);
  const isHomePage = location.pathname === '/';

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Ctrl+K / Cmd+K to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchFocused(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close sidebar on route change (mobile) + scroll to top
  useEffect(() => {
    setSidebarOpen(false);
    setSearchQuery('');
    setSearchFocused(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Skip to content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* ── Top Bar ─────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 glass" role="banner">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
          {/* Left: Mobile toggle + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              {sidebarOpen ? <X className="w-5 h-5 text-gray-600" /> : <Menu className="w-5 h-5 text-gray-600" />}
            </button>
            <Link to="/" className="flex items-center gap-2.5 group" aria-label="Home">
              <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-600/20 group-hover:shadow-lg group-hover:shadow-primary-600/25 transition-shadow duration-300">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 hidden sm:block tracking-tight">
                Smart<span className="gradient-text">PDFSuite</span>
              </span>
              <span className="sr-only">Home</span>
            </Link>
          </div>

          {/* Center: Search */}
          <div ref={searchRef} className="relative flex-1 max-w-xl mx-4 lg:mx-8">
            <div
              className={`relative flex items-center transition-all duration-300 ${
                searchFocused ? 'scale-[1.02]' : ''
              }`}
            >
              <Search className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search PDF tools..."
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-300 transition-all shadow-sm hover:border-gray-300"
                onFocus={() => setSearchFocused(true)}
              />
              {/* Keyboard shortcut hint */}
              {!searchFocused && !searchQuery && (
                <span className="absolute right-3.5 hidden sm:flex items-center gap-0.5 text-[10px] text-gray-800 font-medium bg-gray-200 px-1.5 py-0.5 rounded-md border border-gray-300">
                  Ctrl+K
                </span>
              )}
            </div>
            {/* Search results dropdown */}
            {searchFocused && searchQuery && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-card-lg overflow-hidden z-50 animate-scale-in">
                {searchResults.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Link
                      key={tool.path}
                      to={tool.path}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
                    >
                      <Icon className="w-4 h-4 text-gray-400" />
                      <span className="font-medium">{tool.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
            {searchFocused && searchQuery && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-card-lg overflow-hidden z-50 animate-scale-in">
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  No tools found for "{searchQuery}"
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Sidebar + Content ───────────────────────── */}
      <div className="flex flex-1 pt-16">
        {/* Sidebar overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-xs z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Left Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-[240px] bg-white/50 backdrop-blur-2xl border-r border-white/40 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          {/* Nav links */}
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="PDF tools navigation">
            {NAV_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link animate-fade-up fill-both stagger-${i + 1} ${isActive ? 'active' : 'text-gray-500'}`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${item.color} ${isActive ? '' : 'group-hover:opacity-80 opacity-80'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </Link>
              );
            })}

            {MORE_TOOLS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link ${isActive ? 'active' : 'text-gray-500'}`}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 ${item.color} ${isActive ? '' : 'opacity-80'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Sidebar bottom CTA */}
          <div className="p-4 border-t border-gray-200/50">
            <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl p-4">
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-12 h-12 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
              <div className="relative">
                <p className="text-xs text-white/70 leading-relaxed mb-3">
                  Smarter PDF tools for everyone. Fast, secure, and free.
                </p>
                <Link
                  to="/blog"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white hover:gap-2 transition-all duration-200"
                >
                  Read our blog <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content area */}
        <main id="main-content" role="main" className={`flex-1 min-w-0 flex flex-col main-content${isHomePage ? ' home-gradient' : ''}`}>
          <div className="page-enter flex-1">
            <Outlet />
          </div>

          {/* ── Footer ────────────────────────────── */}
          <footer className="cv-auto bg-white/50 backdrop-blur-xl border-t border-white/40 mt-auto" role="contentinfo">
            <div className="max-w-6xl mx-auto px-6 lg:px-10 py-16">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-10">
                {/* Brand column */}
                <div className="lg:col-span-2">
                  <Link to="/" className="flex items-center gap-2.5 mb-5 group">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-xl flex items-center justify-center shadow-md shadow-primary-600/20">
                      <FileText className="w-5 h-5 text-white" width={20} height={20} />
                    </div>
                    <span className="text-lg font-bold text-gray-900 group-hover:text-primary-600 transition-colors">
                      Smart<span className="gradient-text">PDFSuite</span>
                    </span>
                  </Link>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mb-6">
                    Smarter PDF tools for everyone. Edit, convert, and manage your documents with ease — completely free.
                  </p>
                </div>

                {/* Company column */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Company</h4>
                  <ul className="space-y-3">
                    {FOOTER_COMPANY.map((item) => (
                      <li key={item.path + item.label}>
                        <Link to={item.path} className="footer-link text-sm">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Tools column */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Tools</h4>
                  <ul className="space-y-3">
                    {FOOTER_TOOLS.map((item) => (
                      <li key={item.path}>
                        <Link to={item.path} className="footer-link text-sm">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Resources column */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-4">Resources</h4>
                  <ul className="space-y-3">
                    {FOOTER_RESOURCES.map((item) => (
                      <li key={item.path + item.label}>
                        <Link to={item.path} className="footer-link text-sm">
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mt-14 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-sm text-gray-400">
                  © 2026 SmartPDFSuite. All rights reserved.
                </p>
                <div className="flex items-center gap-5 text-sm">
                  <Link to="/terms" className="text-gray-400 hover:text-primary-600 transition-colors">
                    Terms of Service
                  </Link>
                  <span className="text-gray-200">|</span>
                  <Link to="/privacy" className="text-gray-400 hover:text-primary-600 transition-colors">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
