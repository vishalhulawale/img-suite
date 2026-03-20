import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  ImageIcon,
  Home,
  Minimize2,
  Scissors,
  Camera,
  Search,
  Menu,
  X,
  RefreshCw,
  Crop,
  Sparkles,
  ZoomIn,
  Droplets,
  Type,
  CircleUser,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const NAV_ITEMS = [
  { path: '/', label: 'Home', icon: Home, color: 'text-blue-500' },
  { path: '/compress', label: 'Compress', icon: Minimize2, color: 'text-green-500' },
  { path: '/remove-background', label: 'Remove BG', icon: Scissors, color: 'text-purple-500' },
  { path: '/passport-photo', label: 'Passport Photo', icon: Camera, color: 'text-pink-500' },
  { path: '/format-converter', label: 'Format Converter', icon: RefreshCw, color: 'text-teal-500' },
  { path: '/crop-resize', label: 'Crop & Resize', icon: Crop, color: 'text-orange-500' },
  { path: '/auto-enhance', label: 'Auto Enhance', icon: Sparkles, color: 'text-amber-500' },
  { path: '/upscale', label: 'Upscale', icon: ZoomIn, color: 'text-indigo-500' },
  { path: '/watermark', label: 'Watermark', icon: Droplets, color: 'text-rose-500' },
  { path: '/text-on-image', label: 'Text on Image', icon: Type, color: 'text-sky-500' },
  { path: '/profile-picture', label: 'Profile Picture', icon: CircleUser, color: 'text-violet-500' },
];

const FOOTER_TOOLS = [
  { path: '/compress', label: 'Compress Images' },
  { path: '/remove-background', label: 'Remove Background' },
  { path: '/passport-photo', label: 'Passport Photo' },
  { path: '/format-converter', label: 'Format Converter' },
  { path: '/crop-resize', label: 'Crop & Resize' },
  { path: '/auto-enhance', label: 'Auto Enhance' },
  { path: '/upscale', label: 'Image Upscaler' },
  { path: '/watermark', label: 'Watermark Studio' },
  { path: '/text-on-image', label: 'Text on Image' },
  { path: '/profile-picture', label: 'Profile Picture' },
];

const FOOTER_COMPANY = [
  { path: '/', label: 'Home' },
];

function useToolSearch(query: string) {
  const allTools = NAV_ITEMS.slice(1);
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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

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

  useEffect(() => {
    setSidebarOpen(false);
    setSearchQuery('');
    setSearchFocused(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* ── Top Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 glass" role="banner">
        <div className="flex items-center justify-between h-full px-4 lg:px-6">
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
                <ImageIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 hidden sm:block tracking-tight">
                Smart<span className="gradient-text">ImageSuite</span>
              </span>
            </Link>
          </div>

          {/* Center: Search */}
          <div ref={searchRef} className="relative flex-1 max-w-xl mx-4 lg:mx-8">
            <div className={`relative flex items-center transition-all duration-300 ${searchFocused ? 'scale-[1.02]' : ''}`}>
              <Search className="absolute left-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search image tools..."
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200/80 rounded-xl text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-300 transition-all shadow-sm hover:border-gray-300"
                onFocus={() => setSearchFocused(true)}
              />
              {!searchFocused && !searchQuery && (
                <span className="absolute right-3.5 hidden sm:flex items-center gap-0.5 text-[10px] text-gray-800 font-medium bg-gray-200 px-1.5 py-0.5 rounded-md border border-gray-300">
                  Ctrl+K
                </span>
              )}
            </div>
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

      {/* ── Sidebar + Content ── */}
      <div className="flex flex-1 pt-16">
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-xs z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed lg:sticky top-16 left-0 z-40 h-[calc(100vh-4rem)] w-[240px] bg-white/50 backdrop-blur-2xl border-r border-white/40 flex flex-col transition-transform duration-300 ease-out lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
          }`}
        >
          <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Image tools navigation">
            {NAV_ITEMS.map((item, i) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`sidebar-link animate-fade-up fill-both ${isActive ? 'active' : 'text-gray-500'}`}
                  style={{ animationDelay: `${(i + 1) * 0.04}s` }}
                >
                  <Icon className={`w-[18px] h-[18px] flex-shrink-0 transition-colors ${item.color} ${isActive ? '' : 'group-hover:opacity-80 opacity-80'}`} />
                  <span>{item.label}</span>
                  {isActive && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500" />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-gray-200/50">
            <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl p-4">
              <div className="relative z-10">
                <p className="text-white/90 text-xs font-medium mb-1">Smart Image Suite</p>
                <p className="text-white/60 text-[11px] leading-relaxed">
                  10+ free image tools — compress, convert, crop, enhance, watermark, and more.
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main
          id="main-content"
          className={`flex-1 min-w-0 main-content ${isHomePage ? 'home-gradient' : ''} page-enter`}
        >
          <Outlet />

          {/* Footer */}
          <footer className="border-t border-gray-200/60 bg-white/40 mt-16">
            <div className="max-w-6xl mx-auto px-6 lg:px-10 py-12">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                {/* Brand */}
                <div>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-600 to-secondary-600 rounded-lg flex items-center justify-center">
                      <ImageIcon className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-gray-900">
                      Smart<span className="gradient-text">ImageSuite</span>
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    Free online image tools. Process locally, your files stay private.
                  </p>
                </div>

                {/* Tools */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Tools</h4>
                  <ul className="space-y-2">
                    {FOOTER_TOOLS.map((item) => (
                      <li key={item.path}>
                        <Link to={item.path} className="footer-link text-sm">{item.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Company */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">Company</h4>
                  <ul className="space-y-2">
                    {FOOTER_COMPANY.map((item) => (
                      <li key={item.path}>
                        <Link to={item.path} className="footer-link text-sm">{item.label}</Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-gray-200/60 text-center">
                <p className="text-xs text-gray-400">
                  © {new Date().getFullYear()} SmartImageSuite. All rights reserved.
                </p>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
