import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Clock, Calendar, Tag } from 'lucide-react';
import { BLOG_POSTS } from '../data/blogData';
import SEOHead from '../components/SEOHead';

/* ── Minimal Markdown-like renderer ──────────── */

function renderContent(content: string) {
  const lines = content.trim().split('\n');
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key++} className="list-disc list-inside space-y-2 text-gray-600 leading-relaxed my-4 pl-2">
          {listItems.map((item, i) => (
            <li key={i}>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const formatInline = (text: string): string => {
    // Bold
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gray-900 font-semibold">$1</strong>');
    // Italic
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Inline code
    text = text.replace(/`(.*?)`/g, '<code class="bg-gray-100 text-gray-800 text-sm px-1.5 py-0.5 rounded font-mono">$1</code>');
    return text;
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      continue;
    }

    // Heading 2
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2
          key={key++}
          className="text-xl sm:text-2xl font-bold text-gray-900 mt-10 mb-4 first:mt-0"
        >
          {trimmed.slice(3)}
        </h2>
      );
      continue;
    }

    // Heading 3
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={key++} className="text-lg font-semibold text-gray-900 mt-8 mb-3">
          {trimmed.slice(4)}
        </h3>
      );
      continue;
    }

    // List item
    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2));
      continue;
    }

    // Paragraph
    flushList();
    elements.push(
      <p
        key={key++}
        className="text-gray-600 leading-relaxed my-4"
        dangerouslySetInnerHTML={{ __html: formatInline(trimmed) }}
      />
    );
  }

  flushList();
  return elements;
}

/* ── Component ────────────────────────────────── */

export default function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const postIndex = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const post = BLOG_POSTS[postIndex];

  if (!post) {
    return <Navigate to="/blog" replace />;
  }

  const Icon = post.icon;
  const prevPost = postIndex > 0 ? BLOG_POSTS[postIndex - 1] : null;
  const nextPost = postIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[postIndex + 1] : null;

  return (
    <div className="px-6 lg:px-10 py-10 max-w-4xl mx-auto">
      <SEOHead
        title={post.title}
        description={post.desc}
        path={`/blog/${post.slug}`}
        type="article"
      />
      {/* Back link */}
      <div className="mb-8 animate-fade-up fill-both">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-primary-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all articles
        </Link>
      </div>

      {/* Article Header */}
      <header className="mb-10 animate-fade-up fill-both stagger-1">
        <div className="flex items-center gap-3 mb-5">
          <div
            className={`w-12 h-12 ${post.iconBg} rounded-xl flex items-center justify-center`}
          >
            <Icon className={`w-6 h-6 ${post.iconColor}`} />
          </div>
          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-primary-600 bg-primary-50 px-2.5 py-1 rounded-full">
            {post.category}
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 leading-tight mb-4">
          {post.title}
        </h1>
        <p className="text-lg text-gray-500 leading-relaxed mb-6">{post.desc}</p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            {post.date}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            {post.readTime}
          </span>
          <Link
            to={post.featureLink}
            className="flex items-center gap-1.5 text-primary-600 font-medium hover:text-primary-700 transition-colors"
          >
            <Tag className="w-4 h-4" />
            Try this tool
          </Link>
        </div>
      </header>

      {/* Divider */}
      <hr className="border-gray-200/60 mb-10" />

      {/* Article Body */}
      <article className="animate-fade-up fill-both stagger-2">
        {renderContent(post.content)}
      </article>

      {/* CTA Card */}
      <div className="mt-14 mb-10 animate-fade-up fill-both stagger-3">
        <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-secondary-600 rounded-2xl p-8 text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <h3 className="text-lg font-bold text-white mb-2">
              Ready to try it out?
            </h3>
            <p className="text-sm text-white/70 max-w-md mx-auto mb-5">
              Use our free {post.title.replace('How to ', '').toLowerCase()} tool right now — no sign-up required.
            </p>
            <Link
              to={post.featureLink}
              className="inline-flex items-center gap-2 bg-white text-primary-600 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors shadow-lg shadow-black/10"
            >
              Open Tool
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Prev / Next Navigation */}
      <nav className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-10 animate-fade-up fill-both stagger-4">
        {prevPost ? (
          <Link
            to={`/blog/${prevPost.slug}`}
            className="flex items-center gap-3 bg-white rounded-2xl border border-gray-200/60 p-5 card-hover group"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Previous</span>
              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                {prevPost.title}
              </p>
            </div>
          </Link>
        ) : (
          <div />
        )}
        {nextPost ? (
          <Link
            to={`/blog/${nextPost.slug}`}
            className="flex items-center justify-end gap-3 bg-white rounded-2xl border border-gray-200/60 p-5 card-hover group text-right"
          >
            <div className="min-w-0">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Next</span>
              <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                {nextPost.title}
              </p>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors flex-shrink-0" />
          </Link>
        ) : (
          <div />
        )}
      </nav>
    </div>
  );
}
