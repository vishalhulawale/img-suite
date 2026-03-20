import SEOHead from '../components/SEOHead';

export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
      <SEOHead
        title="Privacy Policy"
        description="Learn how SmartPDFSuite handles your data. Files are processed in-memory and automatically deleted. We never store your documents."
        path="/privacy"
      />
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: March 22, 2026</p>

      <div className="prose prose-gray max-w-none space-y-8 text-gray-700 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
          <p>
            Welcome to SmartPDFSuite ("we," "our," or "us"). We operate the website{' '}
            <strong>smartpdfsuite.com</strong> (the "Service"). This Privacy Policy explains how
            we collect, use, and protect information when you use our Service.
          </p>
          <p>
            By using SmartPDFSuite, you agree to the collection and use of information in
            accordance with this policy.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Files You Upload</h3>
          <p>
            When you use our PDF tools, you upload files to our servers for processing. These
            files are:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Processed <strong>entirely in server memory</strong> or temporary storage</li>
            <li>
              <strong>Automatically deleted</strong> immediately after processing is complete
            </li>
            <li>
              <strong>Never stored, shared, or backed up</strong> on our servers
            </li>
          </ul>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">
            Automatically Collected Information
          </h3>
          <p>
            Like most websites, we automatically collect certain information when you visit,
            including:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li>IP address</li>
            <li>Browser type and version</li>
            <li>Pages visited and time spent</li>
            <li>Referring URL</li>
            <li>Device type and screen resolution</li>
          </ul>
          <p>
            This information is collected through server logs and third-party analytics services
            to help us improve the Service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
          <p>We use the collected information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and maintain our PDF processing services</li>
            <li>Analyze usage patterns to improve the user experience</li>
            <li>Monitor for abuse or technical issues</li>
            <li>Serve relevant advertisements through Google AdSense</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Cookies and Advertising</h2>
          <p>
            We use cookies and similar tracking technologies to enhance your experience and serve
            advertisements.
          </p>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Google AdSense</h3>
          <p>
            We use Google AdSense to display advertisements. Google AdSense uses cookies to serve
            ads based on your prior visits to this website and other websites. Google's use of
            advertising cookies enables it and its partners to serve ads based on your visit to
            our site and/or other sites on the Internet.
          </p>
          <p>
            You may opt out of personalized advertising by visiting{' '}
            <a
              href="https://www.google.com/settings/ads"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline hover:text-blue-900"
            >
              Google Ads Settings
            </a>
            . Alternatively, you can opt out of third-party vendor cookies by visiting{' '}
            <a
              href="https://www.aboutads.info/choices/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline hover:text-blue-900"
            >
              www.aboutads.info
            </a>
            .
          </p>

          <h3 className="text-lg font-medium text-gray-800 mt-4 mb-2">Essential Cookies</h3>
          <p>
            We use essential cookies to ensure the proper functioning of our website. These
            cookies do not collect personal information and cannot be disabled.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Security</h2>
          <p>
            We take reasonable measures to protect your information. All file transfers are
            encrypted via HTTPS/TLS. Uploaded files are processed in-memory and are never
            persisted to disk beyond the duration of the processing request.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Third-Party Services</h2>
          <p>Our Service may contain links to or integrations with third-party services including:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <strong>Google AdSense</strong> — for advertising (
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline hover:text-blue-900"
              >
                Google Privacy Policy
              </a>
              )
            </li>
            <li>
              <strong>Google Analytics</strong> — for website analytics (
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-700 underline hover:text-blue-900"
              >
                Google Privacy Policy
              </a>
              )
            </li>
          </ul>
          <p>
            These third-party services have their own privacy policies, and we encourage you to
            review them.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Children's Privacy</h2>
          <p>
            Our Service is not intended for children under the age of 13. We do not knowingly
            collect personal information from children under 13. If you believe we have
            inadvertently collected such information, please contact us so we can promptly
            remove it.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Your Rights</h2>
          <p>Depending on your jurisdiction, you may have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access the personal information we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Opt out of personalized advertising</li>
            <li>Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise any of these rights, please contact us at{' '}
            <a href="mailto:privacy@smartpdfsuite.com" className="text-blue-700 underline hover:text-blue-900">
              privacy@smartpdfsuite.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any
            changes by posting the new Privacy Policy on this page and updating the "Last
            updated" date above. You are advised to review this page periodically.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at:{' '}
            <a href="mailto:privacy@smartpdfsuite.com" className="text-blue-700 underline hover:text-blue-900">
              privacy@smartpdfsuite.com
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
