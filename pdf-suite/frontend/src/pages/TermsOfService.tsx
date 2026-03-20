import SEOHead from '../components/SEOHead';

export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <SEOHead
        title="Terms of Service"
        description="Read the Terms of Service for SmartPDFSuite. By using our free PDF tools, you agree to these terms."
        path="/terms"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: March 22, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Acceptance of Terms</h2>
          <p>
            By accessing or using SmartPDFSuite at <strong>smartpdfsuite.com</strong> (the
            "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not
            agree to these Terms, please do not use the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Description of Service</h2>
          <p>
            SmartPDFSuite provides free, browser-based PDF tools including merging, splitting,
            compressing, converting, watermarking, e-signing, organizing, protecting, unlocking,
            and redacting PDF documents. All file processing occurs on our servers and files are
            automatically deleted after processing.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Acceptable Use</h2>
          <p>You agree to use the Service only for lawful purposes. You must not:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Upload files that contain malware, viruses, or malicious code</li>
            <li>
              Use the Service to process documents that violate any applicable laws or
              regulations
            </li>
            <li>Attempt to gain unauthorized access to our systems or infrastructure</li>
            <li>
              Use automated scripts or bots to access the Service in a manner that exceeds
              reasonable usage
            </li>
            <li>
              Upload content that infringes upon the intellectual property rights of others
            </li>
            <li>Use the Service for any illegal or unauthorized purpose</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. File Handling</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              All uploaded files are processed in server memory or temporary storage and are
              <strong> automatically deleted</strong> immediately after processing
            </li>
            <li>We do not retain, store, or back up any files you upload</li>
            <li>
              You are solely responsible for maintaining backups of your original files before
              uploading them
            </li>
            <li>
              We are not responsible for any loss or corruption of files during processing
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Intellectual Property</h2>
          <p>
            The Service, including its design, logos, text, graphics, and software, is the
            property of SmartPDFSuite and is protected by intellectual property laws. You may
            not reproduce, modify, distribute, or create derivative works of any part of the
            Service without our prior written consent.
          </p>
          <p>
            You retain all ownership rights to the files you upload. We claim no intellectual
            property rights over the content you process through our Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Disclaimer of Warranties</h2>
          <p>
            The Service is provided <strong>"as is"</strong> and{' '}
            <strong>"as available"</strong> without warranties of any kind, either express or
            implied, including but not limited to implied warranties of merchantability, fitness
            for a particular purpose, and non-infringement.
          </p>
          <p>We do not warrant that:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>The Service will be uninterrupted, secure, or error-free</li>
            <li>Results obtained from the Service will be accurate or reliable</li>
            <li>Any errors in the Service will be corrected</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, SmartPDFSuite shall not be liable for any
            indirect, incidental, special, consequential, or punitive damages, including but not
            limited to loss of data, profits, or goodwill, arising out of or related to your use
            of the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Service Availability</h2>
          <p>
            We strive to keep the Service available at all times, but we do not guarantee
            uninterrupted access. We reserve the right to modify, suspend, or discontinue the
            Service (or any part thereof) at any time without prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Advertising</h2>
          <p>
            The Service is supported by advertising provided by third parties, including Google
            AdSense. By using the Service, you agree that we may display advertisements on the
            website. The presence of advertisements does not constitute an endorsement of the
            advertised products or services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Changes to Terms</h2>
          <p>
            We reserve the right to modify these Terms at any time. Changes will be effective
            immediately upon posting to this page. Your continued use of the Service after
            changes are posted constitutes your acceptance of the revised Terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with applicable laws,
            without regard to conflict of law provisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
          <p>
            If you have any questions about these Terms of Service, please contact us at:{' '}
            <a href="mailto:contact@smartpdfsuite.com" className="text-blue-700 underline hover:text-blue-900">
              contact@smartpdfsuite.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
