// app/page.tsx

import { getSiteName } from '@/lib/site';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function EnlistLanding() {
  const siteName = getSiteName();

  return (
    <div className="space-y-8">
      {/* Hero matching light theme */}
      <Card className="p-8">
        <p className="uppercase tracking-wide text-sm text-[var(--fg)]/70">{siteName} — Job Search Agent</p>
        <h1 className="mt-2 text-display md:text-5xl text-[var(--fg)]">The new way to search for jobs. Save hours every week.</h1>
        <p className="mt-3 text-readable text-[var(--fg)]/80 max-w-2xl">
          Stop wasting time on endless job boards. {siteName} uses AI to find perfect roles, craft tailored applications, and apply automatically—saving you 10+ hours per week while you stay in complete control.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <a href="/agent">Open agents</a>
          </Button>
          <Button variant="outline" asChild>
            <a href="#how-it-works">See how it works</a>
          </Button>
        </div>
      </Card>

      {/* How it works simplified to match UI */}
      <section id="how-it-works" className="grid md:grid-cols-3 gap-6">
        {[
          { title: 'Share your goals', body: 'Tell our AI what roles and companies you want—takes 2 minutes, not hours of browsing.' },
          { title: 'AI crafts perfect applications', body: 'Generate tailored resumes and cover letters in seconds, not days of manual work.' },
          { title: 'Apply automatically', body: 'Send polished applications instantly while you focus on what matters—your career.' },
        ].map((f, idx) => (
          <Card key={f.title ?? idx} className="p-5">
            <p className="text-heading text-[var(--fg)]">{f.title}</p>
            <p className="text-readable text-[var(--fg)]/80 mt-2">{f.body}</p>
          </Card>
        ))}
      </section>
      {/* Landing-only footer */}
      <footer className="rounded-xl bg-[var(--card)] border-2 border-[var(--border)] p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-readable text-[var(--fg)]/70">© {new Date().getFullYear()} Enlist. All rights reserved.</p>
          <nav className="flex items-center gap-4 text-sm">
            <a href="/" className="hover:underline">Home</a>
            <a href="/agent" className="hover:underline">Agents</a>
            <a href="https://docs.example.com" className="hover:underline" target="_blank" rel="noreferrer">Docs</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}