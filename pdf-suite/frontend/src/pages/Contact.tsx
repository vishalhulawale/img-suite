import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Send, CheckCircle } from 'lucide-react';
import SEOHead from '../components/SEOHead';

export default function Contact() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // For now, open a mailto link with the form data
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = data.get('name') as string;
    const email = data.get('email') as string;
    const subject = data.get('subject') as string;
    const message = data.get('message') as string;

    const mailtoLink = `mailto:contact@smartpdfsuite.com?subject=${encodeURIComponent(
      `[Contact Form] ${subject}`
    )}&body=${encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    )}`;

    window.location.href = mailtoLink;
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <SEOHead
        title="Contact Us"
        description="Have questions or feedback about SmartPDFSuite? Contact us via email. We typically respond within 24 hours."
        path="/contact"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
      <p className="text-gray-600 mb-10">
        Have a question, feedback, or need support? We'd love to hear from you.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
        {/* Contact info */}
        <div className="space-y-6">
          <div className="bg-blue-50 rounded-xl p-5">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Email Us</h3>
            <p className="text-sm text-gray-700 mb-2">We typically respond within 24 hours.</p>
            <a
              href="mailto:contact@smartpdfsuite.com"
              className="text-blue-700 underline hover:text-blue-900 text-sm font-medium"
            >
              contact@smartpdfsuite.com
            </a>
          </div>

          <div className="bg-gray-50 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/help-center#general" className="text-blue-700 underline hover:text-blue-900">
                  Help Center — General
                </Link>
              </li>
              <li>
                <Link to="/help-center#privacy" className="text-blue-700 underline hover:text-blue-900">
                  Help Center — Privacy
                </Link>
              </li>
              <li>
                <Link to="/help-center#support" className="text-blue-700 underline hover:text-blue-900">
                  Help Center — Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Contact form */}
        <div className="md:col-span-2">
          {submitted ? (
            <div className="bg-green-50 rounded-xl p-8 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Thank you for reaching out!
              </h3>
              <p className="text-gray-600">
                Your email client should have opened with the message. If it didn't, please
                email us directly at{' '}
                <a href="mailto:contact@smartpdfsuite.com" className="text-blue-700 underline hover:text-blue-900">
                  contact@smartpdfsuite.com
                </a>
                .
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-blue-700 underline hover:text-blue-900 text-sm font-medium"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Your Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                    placeholder="john@example.com"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  required
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                  Message <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  required
                  rows={5}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow resize-y"
                  placeholder="Tell us more..."
                />
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/25"
              >
                <Send className="w-4 h-4" />
                Send Message
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
