export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-zinc-300">
      <h1 className="mb-8 text-2xl font-bold text-white">Terms of Service</h1>
      <p className="mb-4 text-sm text-zinc-500">Last updated: May 11, 2026</p>

      <section className="space-y-6 text-sm leading-relaxed">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">1. Acceptance of Terms</h2>
          <p>
            By accessing and using NoorCuts (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">2. Description of Service</h2>
          <p>
            NoorCuts is a free, non-profit web application that generates video shorts from Quran recitations. The Service integrates with Quran Foundation APIs to provide Quranic content, translations, and user features such as bookmarks and collections.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">3. Quran Foundation Account</h2>
          <p>
            NoorCuts uses Quran Foundation OAuth for authentication. By signing in, you authorize NoorCuts to access your Quran.com bookmarks and collections in read-only mode. We do not modify or delete your Quran.com data.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">4. Permitted Use</h2>
          <p>
            You may use NoorCuts to generate video content featuring Quranic verses for personal, educational, and da&apos;wah purposes. You must not use generated content to misrepresent, distort, or take Quranic verses out of context.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">5. Content &amp; Intellectual Property</h2>
          <p>
            Quranic text, translations, and audio recitations are provided by the Quran Foundation and their respective licensors. NoorCuts does not claim ownership over Quranic content. Generated videos are for your personal use and sharing.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">6. No Warranty</h2>
          <p>
            The Service is provided &quot;as is&quot; without warranty of any kind. We do not guarantee uninterrupted availability or accuracy of generated content.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">7. Limitation of Liability</h2>
          <p>
            NoorCuts and its developers shall not be liable for any damages arising from your use of the Service.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">8. Changes to Terms</h2>
          <p>
            We may update these terms at any time. Continued use of the Service constitutes acceptance of any changes.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold text-white">9. Contact</h2>
          <p>
            For questions about these terms, contact us at dahee.naim@gmail.com.
          </p>
        </div>
      </section>
    </main>
  );
}
