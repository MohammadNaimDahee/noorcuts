export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="mb-8 text-2xl font-bold text-white">Privacy Policy</h1>
      <p className="mb-4 text-sm text-zinc-500">Last updated: May 11, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">1. Overview</h2>
          <p>
            NoorCuts (&quot;we&quot;, &quot;our&quot;, &quot;the Service&quot;) is a non-profit web application for generating Quran recitation video shorts. We are committed to protecting your privacy and handling your data responsibly.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">2. Data We Collect</h2>
          <p>When you use NoorCuts, we may collect:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Quran Foundation Account Data:</strong> Your user ID (sub), name, and email provided through Quran Foundation OAuth. We access your bookmarks and collections in read-only mode.</li>
            <li><strong>Render History:</strong> Records of videos you generate (surah, ayah range, template, timestamp). Stored locally and associated with your account.</li>
            <li><strong>Generated Videos:</strong> Temporarily stored for download. Videos are automatically deleted after 30 minutes.</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">3. Data We Do NOT Collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>We do not collect passwords (authentication is handled by Quran Foundation)</li>
            <li>We do not use cookies for tracking or advertising</li>
            <li>We do not sell, share, or transfer your data to third parties</li>
            <li>We do not use analytics or tracking services</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">4. How We Use Your Data</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>To authenticate you and provide personalized features</li>
            <li>To display your Quran.com bookmarks as video clip suggestions</li>
            <li>To maintain your render history within the app</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">5. Quran Foundation Integration</h2>
          <p>
            NoorCuts integrates with Quran Foundation APIs via OAuth 2.0. We request access to your bookmarks and collections only. You can revoke access at any time through your Quran.com account settings.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">6. Data Storage &amp; Security</h2>
          <p>
            Your data is stored securely. OAuth tokens are stored server-side in encrypted sessions and are never exposed to the browser. We do not store your Quran Foundation password.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Data Retention</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>OAuth tokens: retained while your session is active; revoked on logout</li>
            <li>Render history: retained until you delete your account</li>
            <li>Generated videos: automatically deleted after 30 minutes</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">8. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Access your data stored in the Service</li>
            <li>Request deletion of your data</li>
            <li>Revoke OAuth access at any time</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy as needed. Changes will be reflected on this page with an updated date.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">10. Contact</h2>
          <p>
            For privacy-related questions, contact us at dahee.naim@gmail.com.
          </p>
        </div>
      </section>
    </main>
  );
}
