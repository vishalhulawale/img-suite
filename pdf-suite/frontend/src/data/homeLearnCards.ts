import { Merge, Minimize2, RefreshCw } from 'lucide-react';

/**
 * Lightweight preview data for the Home page "Learn About PDF Editing" section.
 * Only contains the first 3 blog items (slug, title, desc, icon info) —
 * avoids pulling in the full 29 KiB blogData.ts + all its lucide icons.
 */
export const LEARN_CARDS = [
  {
    slug: 'how-to-merge-pdfs',
    icon: Merge,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    accentColor: 'group-hover:border-blue-200',
    title: 'How to Merge PDFs',
    linkText: 'Merging guide',
    desc: 'Combine multiple PDF files into one seamless document with just a few clicks — no software needed.',
  },
  {
    slug: 'how-to-compress-pdfs',
    icon: Minimize2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    accentColor: 'group-hover:border-emerald-200',
    title: 'How to Compress PDFs',
    linkText: 'Compression guide',
    desc: 'Reduce your PDF file size while maintaining quality. Perfect for email attachments and sharing.',
  },
  {
    slug: 'how-to-convert-pdf-to-word',
    icon: RefreshCw,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    accentColor: 'group-hover:border-amber-200',
    title: 'How to Convert PDF to Word',
    linkText: 'Conversion guide',
    desc: 'Convert your PDF documents to editable Word files easily and accurately — preserving formatting.',
  },
] as const;
