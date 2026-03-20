import { Link } from 'react-router-dom';
import SEOHead from '../components/SEOHead';

export default function Disclaimer() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <SEOHead
        title="Disclaimer"
        description="Read the Disclaimer for SmartPDFSuite. Tools are provided as-is. Always back up your original files."
        path="/disclaimer"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Disclaimer</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: March 22, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">General Disclaimer</h2>
          <p>
            The information and tools provided by SmartPDFSuite on{' '}
            <strong>smartpdfsuite.com</strong> (the "Service") are for general use only. While we
            strive to ensure our PDF tools work correctly and produce accurate results, all tools
            are provided on an "as is" basis without any warranties or guarantees.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">No Professional Advice</h2>
          <p>
            The Service does not provide legal, financial, or professional advice. If you need
            to process documents for legal, financial, or compliance purposes, please consult a
            qualified professional. The results produced by our tools should be verified by the
            user before use in any critical or official context.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">File Processing</h2>
          <p>
            While we take reasonable care to ensure accurate file processing, we cannot guarantee
            that all PDF operations will produce perfect results in every case. PDF files vary
            widely in structure and complexity. We recommend:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Always keeping a backup of your original files before processing</li>
            <li>Reviewing the output files before using them for important purposes</li>
            <li>
              Testing with non-critical files first if you are processing sensitive documents
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Content</h2>
          <p>
            Our website may display advertisements from third parties, including Google AdSense.
            We are not responsible for the content of these advertisements or the products and
            services they promote. The presence of advertisements on our site does not constitute
            an endorsement.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">External Links</h2>
          <p>
            Our Service may contain links to external websites that are not operated by us. We
            have no control over the content, privacy policies, or practices of third-party
            websites and assume no responsibility for them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
          <p>
            SmartPDFSuite shall not be held liable for any damages arising from the use of our
            Service, including but not limited to data loss, file corruption, or inaccurate
            processing results. Use the Service at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
          <p>
            If you have any questions about this Disclaimer, please contact us at{' '}
            <a href="mailto:contact@smartpdfsuite.com" className="text-blue-700 underline hover:text-blue-900">
              contact@smartpdfsuite.com
            </a>
            . You may also review our{' '}
            <Link to="/privacy" className="text-blue-700 underline hover:text-blue-900">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/terms" className="text-blue-700 underline hover:text-blue-900">
              Terms of Service
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
