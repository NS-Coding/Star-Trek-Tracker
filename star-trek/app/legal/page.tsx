"use client"

import { LcarsHeader } from "@/components/lcars-header"
import Link from "next/link"

// Configuration: Update these values to customize the page
const APP_NAME = "Star Trek Tracker"
const EFFECTIVE_DATE = "02/02/2026"
const CONTACT_LOCAL = "server owner"
const EMAIL = "sapphireserverai@gmail.com"

// Derived values for obfuscated display and click handler
const obfuscatedDisplay = `${CONTACT_LOCAL}`
const buildMailto = () => `mailto:${EMAIL}`

export default function LegalPage() {
  return (
    <main className="min-h-screen flex flex-col items-center py-8">
      <LcarsHeader title="Terms of Service & Privacy" />
      <div className="prose prose-invert max-w-3xl w-full px-6 space-y-6">
        <section className="space-y-2">
          <h2>Terms of Service</h2>
          <p>
            <strong>Effective Date:</strong> {EFFECTIVE_DATE}
          </p>
        </section>
        <section className="space-y-4">
        <h3>1. Acceptance of Terms</h3>
        <p>
          By creating an account or using <strong>{APP_NAME}</strong> (the "Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
        </p>
        <h3>2. Eligibility & Account Security</h3>
        <ul>
          <li>This is a private, invite-only application. You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You agree to notify the administrator immediately of any unauthorized use of your account.</li>
          <li>I reserve the right to disable any account at my discretion.</li>
        </ul>
        <h3>3. User-Generated Content</h3>
        <ul>
          <li>You retain ownership of the ratings and notes you post. However, by posting content, you grant the Service a license to store and display that content to you and other authorized users of the app.</li>
          <li>You agree not to post content that is illegal, offensive, or violates the rights of others.</li>
        </ul>
        <h3>4. Prohibited Conduct</h3>
        <p>You agree not to:</p>
        <ul>
          <li>Attempt to bypass security measures, "hack," or probe the server for vulnerabilities.</li>
          <li>Use the Service to distribute malware or spam.</li>
          <li>Reverse engineer or attempt to extract the source code of the Service.</li>
        </ul>
        <h3>5. Disclaimer of Warranties (The "As-Is" Clause)</h3>
        <p><strong>The Service is provided on an "AS IS" and "AS AVAILABLE" basis.</strong> As this is a personal hobby project hosted on a private server:</p>
        <ul>
          <li>I do not guarantee 100% uptime.</li>
          <li>I am not responsible for any loss of data. Please keep backups of any notes that are important to you.</li>
          <li>I make no warranties, express or implied, regarding the reliability or accuracy of the Service.</li>
        </ul>
        <h3>6. Limitation of Liability</h3>
        <p>
          To the maximum extent permitted by law, the owner of <strong>{APP_NAME}</strong> shall not be liable for any direct, indirect, incidental, or consequential damages resulting from your use of (or inability to use) the Service.
        </p>
        <h3>7. Changes to Service</h3>
        <p>I reserve the right to modify or shut down the Service at any time, for any reason, without prior notice.</p>
        </section>

        <hr />

        <section className="space-y-4">
        <h2>Privacy Policy</h2>
        <h3>1. Information Collected</h3>
        <p>To provide the features of this application, I collect the following:</p>
        <ul>
          <li><strong>Account Information:</strong> Username, email address, and a hashed version of your password.</li>
          <li><strong>User-Generated Content:</strong> Ratings, notes, and timestamps associated with your account.</li>
          <li><strong>Server Logs:</strong> My Nginx server logs your IP address and browser type for security and debugging purposes.</li>
        </ul>
        <h3>2. Third-Party Services</h3>
        <ul>
          <li><strong>Cloudflare:</strong> This site uses Cloudflare for performance and security. Cloudflare may process your IP address and use security cookies to protect the site from malicious traffic.</li>
        </ul>
        <h3>3. Cookies</h3>
        <p>This application uses <strong>Strictly Necessary</strong> cookies to:</p>
        <ul>
          <li>Maintain your login session.</li>
          <li>Provide security features (e.g., CSRF protection).</li>
          <li><strong>We do not use tracking, advertising, or analytics cookies.</strong></li>
        </ul>
        <h3>4. Data Usage & Sharing</h3>
        <p>Your data is used strictly to provide the Service. I do not sell, rent, or share your personal information with third parties for marketing or any other commercial purposes.</p>
        <h3>5. Data Security</h3>
        <p>I implement industry-standard practices to protect your data, including:</p>
        <ul>
          <li><strong>Password Hashing:</strong> Your actual password is never stored in plain text.</li>
          <li><strong>Encryption:</strong> All traffic is served over HTTPS.</li>
          <li><strong>Private Hosting:</strong> The database is stored on a secured private server.</li>
        </ul>
        <h3>6. Your Rights</h3>
        <p>
          You may request to see your data or have your account and all associated data deleted at any time. To do so, please contact: {" "}
          <button
            type="button"
            onClick={() => (window.location.href = buildMailto())}
            className="underline text-blue-400"
            aria-label="Send email"
          >
            {obfuscatedDisplay}
          </button>
          .
        </p>
        <p className="mt-8 text-sm text-muted-foreground">
          Return to <Link href="/login" className="underline">Login</Link>
        </p>
        </section>
      </div>
    </main>
  )
}
