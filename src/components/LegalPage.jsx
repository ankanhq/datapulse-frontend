// Standalone, public legal pages (Privacy Policy + Terms of Service). Rendered
// outside the AuthGate so signed-out visitors can read them, and self-contained
// (no API/auth needed). Styled to match the app's dark theme.

const UPDATED = "July 3, 2026";
const CONTACT = "chowdhuryankan808@gmail.com";

function Shell({ title, children }) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-slate-100 transition hover:text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-500/20 text-pulse-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h4l2 6 4-12 2 6h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-semibold tracking-tight">DataPulse</span>
          </a>
          <a href="/" className="ml-auto text-sm text-slate-400 transition hover:text-slate-200">
            ← Back to app
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: {UPDATED}</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-300">{children}</div>

        <footer className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <a href="/privacy" className="transition hover:text-slate-300">Privacy</a>
          <span className="mx-1.5">·</span>
          <a href="/terms" className="transition hover:text-slate-300">Terms</a>
          <span className="mx-1.5">·</span>
          <a href="/" className="transition hover:text-slate-300">Home</a>
        </footer>
      </main>
    </div>
  );
}

function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-base font-semibold text-slate-100">{heading}</h2>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

function MailLink() {
  return (
    <a href={`mailto:${CONTACT}`} className="text-pulse-400 transition hover:text-pulse-300">
      {CONTACT}
    </a>
  );
}

function PrivacyPolicy() {
  return (
    <Shell title="Privacy Policy">
      <p>
        DataPulse is a free tool for exploring spreadsheet data. This policy explains, in plain
        English, what information it handles and how. It applies to the DataPulse web app.
      </p>

      <Section heading="What we collect">
        <p>Two things, and nothing more:</p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong className="text-slate-200">Your account details</strong> — your email address and
            name, provided by Google or GitHub when you sign in. We do not see or store your password;
            sign-in is handled by those providers.
          </li>
          <li>
            <strong className="text-slate-200">Your data</strong> — the spreadsheet files you upload,
            paste, or connect (for example, a published Google Sheet CSV link), plus any reports you
            choose to save.
          </li>
        </ul>
      </Section>

      <Section heading="How we use it">
        <p>
          Your information is used only to provide the analytics you ask for — parsing your file,
          computing summaries, charts and insights, and showing them back to you. We do not use it for
          advertising or profiling, and we do not sell it or share it with third parties.
        </p>
      </Section>

      <Section heading="Where it's stored">
        <p>
          Account details and saved dataset/report metadata are stored in an encrypted PostgreSQL
          database hosted in the European Union via Supabase. Uploaded file contents are processed in
          memory to answer your requests and are evicted automatically when idle — they are not kept on
          disk permanently.
        </p>
      </Section>

      <Section heading="Private per account">
        <p>
          Your data is strictly private to your account. Every dataset and report is tied to your user
          id, and the app enforces that you can only ever access your own data. Your data is never sold
          or rented to anyone.
        </p>
      </Section>

      <Section heading="Retention & deleting your data">
        <p>
          You can delete your account and all associated data at any time from the account menu in the
          app (“Delete my account and data”). This permanently removes your datasets, saved reports,
          and account record. Idle in-memory datasets are also cleared automatically over time.
        </p>
      </Section>

      <Section heading="Your rights (GDPR)">
        <p>
          If you are in the EU/EEA, you have the right to access, correct, and delete your personal
          data, and to request a copy of it. You can exercise deletion yourself in the app at any time.
          For any other request — access, correction, or questions — contact <MailLink />.
        </p>
      </Section>

      <Section heading="Cookies">
        <p>
          DataPulse uses cookies and similar browser storage only to keep you signed in (your login
          session). There are no advertising or third-party tracking cookies.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy or your data? Email <MailLink />.
        </p>
      </Section>
    </Shell>
  );
}

function TermsOfService() {
  return (
    <Shell title="Terms of Service">
      <p>
        By using DataPulse, you agree to these terms. Please read them — they are intentionally short
        and in plain English.
      </p>

      <Section heading="The service is free and provided “as is”">
        <p>
          DataPulse is provided free of charge and “as is”, without warranties of any kind, express or
          implied. There is no guarantee that results will be accurate, complete, or fit for any
          particular purpose.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>
          You must use DataPulse lawfully and only with data that you own or otherwise have the right to
          use and analyse. Do not upload data you are not permitted to process, and do not use the
          service to break any applicable law.
        </p>
      </Section>

      <Section heading="Your data is your responsibility">
        <p>
          You are responsible for the data you upload, paste, or connect, and for keeping your own
          copies. DataPulse processes data in memory and does not guarantee long-term storage or
          backups of uploaded file contents.
        </p>
      </Section>

      <Section heading="Changes and availability">
        <p>
          The service may change, add or remove features, or experience downtime at any time without
          notice. It may be modified or discontinued.
        </p>
      </Section>

      <Section heading="Limitation of liability">
        <p>
          DataPulse and its author are not liable for any decisions you make based on the analysis, or
          for any loss or damage arising from your use of the service, to the maximum extent permitted
          by law.
        </p>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about these terms? Email <MailLink />.
        </p>
      </Section>

      <p className="text-slate-400">
        This is a personal project; these terms are provided as-is.
      </p>
    </Shell>
  );
}

export default function LegalPage({ kind }) {
  return kind === "terms" ? <TermsOfService /> : <PrivacyPolicy />;
}
