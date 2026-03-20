import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogData';
import SEOHead from '../components/SEOHead';

export default function BlogListPage() {
  return (
    <div className="px-6 lg:px-10 py-10 max-w-6xl mx-auto">
      <SEOHead
        title="PDF Editing Blog — Guides & Tips"
        description="Learn how to merge, compress, convert, sign, and redact PDFs with our step-by-step guides and tips."
        path="/blog"
      />
      {/* Header */}
      <section className="mb-12 animate-fade-up fill-both">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 bg-primary-50 rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight">
              PDF Editing{' '}
              <span className="gradient-text">Blog</span>
            </h1>
          </div>
        </div>
        <p className="text-gray-500 text-base max-w-2xl mt-2">
          Learn how to get the most out of your PDF tools. From merging and compressing to signing and redacting — we've got guides for every feature.
        </p>
      </section>

      {/* Blog Grid */}
      <section className="mb-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {BLOG_POSTS.map((post, i) => {
            const Icon = post.icon;
            return (
              <Link
                key={post.slug}
                to={`/blog/${post.slug}`}
                className={`bg-white rounded-2xl border border-gray-200/60 p-6 card-hover group ${post.accentColor} transition-colors animate-fade-up fill-both stagger-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-11 h-11 ${post.iconBg} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                  >
                    <Icon className={`w-5 h-5 ${post.iconColor}`} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-400">{post.readTime}</span>
                  </div>
                </div>

                <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full mb-3">
                  {post.category}
                </span>

                <h3 className="text-base font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {post.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  {post.desc}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{post.date}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 group-hover:gap-2.5 transition-all duration-300">
                    Read More
                    <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA Section */}
      <section className="animate-fade-up fill-both">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-600 rounded-3xl p-8 sm:p-12 text-center">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-3">
              Ready to Get Started?
            </h2>
            <p className="text-sm text-white/70 max-w-md mx-auto mb-6">
              Try any of our free PDF tools today — no sign-up required. Edit, convert, and manage your documents with ease.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-white text-primary-600 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors shadow-lg shadow-black/10"
            >
              Explore Tools
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
