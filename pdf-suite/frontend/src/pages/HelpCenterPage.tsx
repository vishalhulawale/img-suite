import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  HelpCircle,
  ChevronDown,
  FileText,
  Shield,
  Headphones,
  Info,
  Mail,
} from 'lucide-react';
import SEOHead from '../components/SEOHead';

/* ── FAQ Data ─────────────────────────────────── */

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  faqs: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: 'general',
    title: 'General',
    description: 'Common questions about SmartPDFSuite and how it works.',
    icon: Info,
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50',
    faqs: [
      {
        question: 'What is SmartPDFSuite?',
        answer:
          'SmartPDFSuite is a free, browser-based platform that offers a comprehensive set of PDF tools — including merge, split, compress, convert, watermark, eSign, organize, protect, unlock, and redact. No downloads or sign-ups required.',
      },
      {
        question: 'Is SmartPDFSuite really free?',
        answer:
          'Yes! SmartPDFSuite is completely free to use. We sustain the service through advertisements, so there are no hidden fees, subscriptions, or premium tiers.',
      },
      {
        question: 'Do I need to create an account to use the tools?',
        answer:
          'No. You can use all PDF tools without registering or creating an account. Just visit the site and start working with your PDFs immediately.',
      },
      {
        question: 'What browsers are supported?',
        answer:
          'SmartPDFSuite works on all modern browsers, including Chrome, Firefox, Safari, and Edge. It also works on mobile browsers, so you can use it from any device.',
      },
      {
        question: 'Is there a file size limit?',
        answer:
          'We support files up to 50 MB per upload. For most common PDF tasks, this is more than sufficient. If you need to process larger files, try compressing them first.',
      },
      {
        question: 'Can I use SmartPDFSuite offline?',
        answer:
          'Currently, SmartPDFSuite requires an internet connection because files are processed on our secure servers. We are exploring offline capabilities for the future.',
      },
    ],
  },
  {
    id: 'features',
    title: 'Features & Tools',
    description: 'Learn about our PDF tools and how to use them effectively.',
    icon: FileText,
    iconColor: 'text-purple-600',
    iconBg: 'bg-purple-50',
    faqs: [
      {
        question: 'How do I merge multiple PDFs into one?',
        answer:
          'Go to the Merge tool, drag and drop or select the PDF files you want to combine, arrange them in your desired order, and click "Merge." The combined PDF will be available for download instantly.',
      },
      {
        question: 'How does the Split PDF tool work?',
        answer:
          'The Split tool lets you extract specific pages or page ranges from a PDF. Upload your file, specify the pages you want (e.g., 1-3, 5, 8-10), and click "Split." You\'ll get a new PDF with only those pages.',
      },
      {
        question: 'What compression levels are available?',
        answer:
          'Our Compress tool offers multiple compression levels to balance file size and quality. You can significantly reduce the size of your PDFs while maintaining readable quality — perfect for email attachments or web uploads.',
      },
      {
        question: 'What formats can I convert PDFs to?',
        answer:
          'You can convert PDFs to common formats including Word (DOCX), Excel (XLSX), PowerPoint (PPTX), and images (PNG, JPG). You can also convert images and documents into PDF format.',
      },
      {
        question: 'How do I add a watermark to my PDF?',
        answer:
          'Use the Watermark tool to add text or image watermarks to your PDFs. You can customize the text, font size, color, opacity, and position. This is great for marking documents as "Draft," "Confidential," or adding your branding.',
      },
      {
        question: 'How does the eSign feature work?',
        answer:
          'The eSign tool lets you draw or type your signature and place it on any page of your PDF. You can resize and reposition the signature as needed. It\'s perfect for signing contracts, agreements, or forms digitally.',
      },
      {
        question: 'What can I do with the Organize tool?',
        answer:
          'The Organize tool allows you to reorder pages by dragging and dropping, rotate individual pages, and delete unwanted pages — all within an easy-to-use visual interface.',
      },
      {
        question: 'How does PDF protection work?',
        answer:
          'The Protect tool encrypts your PDF with AES-256 password protection. Set a password, and the PDF can only be opened by someone who knows it. This is ideal for sensitive documents like financial reports or personal records.',
      },
      {
        question: 'Can I remove a password from a PDF?',
        answer:
          'Yes! If you know the password, use the Unlock tool to remove password protection from a PDF. Simply upload the protected file, enter the current password, and download the unlocked version.',
      },
      {
        question: 'What does the Redact tool do?',
        answer:
          'The Redact tool permanently blacks out sensitive information in your PDF, such as names, addresses, social security numbers, or financial data. Once redacted, the original content cannot be recovered — ensuring privacy and compliance.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy & Security',
    description: 'How we handle your files and protect your data.',
    icon: Shield,
    iconColor: 'text-green-600',
    iconBg: 'bg-green-50',
    faqs: [
      {
        question: 'Are my files stored on your servers?',
        answer:
          'No. All files are processed in-memory on our secure servers and are automatically deleted immediately after processing. We never store, share, or access your documents.',
      },
      {
        question: 'Is the file transfer secure?',
        answer:
          'Yes. All data transfers between your browser and our servers are encrypted using HTTPS/TLS, the same security standard used by banks and financial institutions.',
      },
      {
        question: 'Do you collect any personal data?',
        answer:
          'We collect minimal anonymous usage data (such as page views and tool usage) through cookies to improve the service. We do not collect personal identifying information. For full details, see our Privacy Policy.',
      },
      {
        question: 'Can SmartPDFSuite staff see my documents?',
        answer:
          'No. Files are processed automatically by our system and are never viewed by any person. The processing is fully automated, and files are deleted from memory immediately after processing.',
      },
      {
        question: 'Is it safe to upload confidential documents?',
        answer:
          'Yes. Your files are encrypted during transfer, processed in isolated memory, and deleted immediately afterward. We recommend using the Protect tool to add password encryption for an extra layer of security before sharing documents.',
      },
      {
        question: 'Where can I read the full Privacy Policy?',
        answer:
          'You can read our complete Privacy Policy on the Privacy Policy page. It covers data collection, cookies, third-party services, and your rights in detail.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support & Contact',
    description: 'Get help with issues or reach out to our team.',
    icon: Headphones,
    iconColor: 'text-rose-600',
    iconBg: 'bg-rose-50',
    faqs: [
      {
        question: 'How can I contact SmartPDFSuite support?',
        answer:
          'You can reach us through our Contact page or email us directly at contact@smartpdfsuite.com. We typically respond within 24 hours.',
      },
      {
        question: 'I found a bug — how do I report it?',
        answer:
          'We appreciate bug reports! Please email support@smartpdfsuite.com with a description of the issue, the browser and device you are using, and steps to reproduce the problem. Screenshots are also helpful.',
      },
      {
        question: 'My PDF tool is not working. What should I do?',
        answer:
          'First, try refreshing the page and uploading the file again. Make sure the file is a valid PDF and is not corrupted. If the problem persists, try using a different browser. If it still doesn\'t work, contact us at support@smartpdfsuite.com with details.',
      },
      {
        question: 'Can I request a new feature?',
        answer:
          'Absolutely! We love hearing from our users. Send your feature request to contact@smartpdfsuite.com and we will consider it for future updates.',
      },
      {
        question: 'Do you offer an API or enterprise plan?',
        answer:
          'Currently, SmartPDFSuite is available as a free web-based tool. We do not offer an API or enterprise plans at this time, but we\'re open to exploring it in the future. Reach out to contact@smartpdfsuite.com for business inquiries.',
      },
      {
        question: 'What should I do if I have a privacy concern?',
        answer:
          'For privacy-related concerns, please email privacy@smartpdfsuite.com. We take all privacy inquiries seriously and will respond promptly.',
      },
    ],
  },
];

/* ── Accordion Item Component ─────────────────── */

function AccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border border-gray-200/80 rounded-xl overflow-hidden transition-all duration-200 hover:border-gray-300">
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-5 py-4 text-left bg-white hover:bg-gray-50/50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-800 pr-4">{item.question}</span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        } overflow-hidden`}
      >
        <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
          <div className="pt-3">{item.answer}</div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Help Center Component ───────────────── */

export default function HelpCenterPage() {
  const location = useLocation();
  const [openItems, setOpenItems] = useState<Record<string, number | null>>({});

  // Scroll to section if hash is present
  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.replace('#', '');
      const el = document.getElementById(sectionId);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location.hash]);

  const toggleItem = (sectionId: string, index: number) => {
    setOpenItems((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === index ? null : index,
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <SEOHead
        title="Help Center — FAQ & Support"
        description="Find answers to common questions about SmartPDFSuite. Learn about features, privacy, security, and how to get support."
        path="/help-center"
      />
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-2xl mb-5">
          <HelpCircle className="w-8 h-8 text-primary-600" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">Help Center</h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">
          Find answers to common questions about SmartPDFSuite. Can't find what you're looking for?{' '}
          <Link to="/contact" className="text-primary-600 hover:underline font-medium">
            Contact us
          </Link>
          .
        </p>
      </div>

      {/* Quick navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-12">
        {FAQ_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200/80 hover:border-primary-300 hover:shadow-md transition-all duration-200 group"
            >
              <div className={`w-10 h-10 ${section.iconBg} rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <Icon className={`w-5 h-5 ${section.iconColor}`} />
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700 transition-colors">
                {section.title}
              </span>
            </a>
          );
        })}
      </div>

      {/* FAQ Sections */}
      <div className="space-y-12">
        {FAQ_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 ${section.iconBg} rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${section.iconColor}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{section.title}</h2>
                </div>
              </div>
              <p className="text-sm text-gray-500 mb-5 ml-[52px]">{section.description}</p>

              <div className="space-y-2.5">
                {section.faqs.map((faq, index) => (
                  <AccordionItem
                    key={index}
                    item={faq}
                    isOpen={openItems[section.id] === index}
                    onToggle={() => toggleItem(section.id, index)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Bottom CTA */}
      <div className="mt-16 text-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 rounded-2xl border border-primary-100/50 p-8 sm:p-10">
        <Mail className="w-10 h-10 text-primary-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Still have questions?</h3>
        <p className="text-gray-500 mb-6 max-w-md mx-auto">
          Can't find the answer you're looking for? Our team is here to help.
        </p>
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/25"
        >
          <Mail className="w-4 h-4" />
          Contact Support
        </Link>
      </div>
    </div>
  );
}
