import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  Check,
  Clock3,
  Eye,
  KeyRound,
  Radio,
  RotateCcw,
  Server,
  ShieldCheck,
  Webhook,
} from 'lucide-react';
import RelayLogo from '@/components/layout/RelayLogo';

const problems = [
  'Failed HTTP requests leave events undelivered.',
  'Temporary endpoint downtime needs a safe recovery path.',
  'Hand-rolled retries can lose or duplicate events.',
  'Debugging is difficult without a record of what happened.',
  'A lack of delivery visibility makes incidents harder to resolve.',
];

const workflow = [
  { icon: Radio, title: 'Create an event', description: 'Send an event through Relay’s API.' },
  { icon: Check, title: 'Persist event + outbox', description: 'Relay stores the event and its outbox record together.' },
  { icon: Activity, title: 'Publish to the queue', description: 'The dispatcher publishes delivery jobs to BullMQ.' },
  { icon: Webhook, title: 'Send a signed webhook', description: 'Background workers deliver the event to your endpoint.' },
  { icon: RotateCcw, title: 'Retry failures', description: 'Failed deliveries are retried with backoff.' },
  { icon: Eye, title: 'Inspect or replay', description: 'Review attempt history and replay eligible events.' },
];

const capabilities = [
  { icon: Webhook, label: 'Webhook delivery' },
  { icon: Server, label: 'BullMQ background processing' },
  { icon: RotateCcw, label: 'Automatic retries with backoff' },
  { icon: ShieldCheck, label: 'HMAC-SHA256 signatures' },
  { icon: Clock3, label: 'Delivery attempt history' },
  { icon: Radio, label: 'Event replay' },
  { icon: Activity, label: 'Endpoint management' },
  { icon: KeyRound, label: 'Project-scoped API keys' },
  { icon: Eye, label: 'Delivery monitoring' },
];

export default function About() {
  return (
    <div className="auth-page min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80">
        <nav aria-label="Main navigation" className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/login" className="flex items-center gap-2.5 rounded-md" aria-label="Relay">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-foreground text-background">
              <RelayLogo className="h-[18px] w-[18px]" />
            </span>
            <span className="text-base font-semibold tracking-[-0.035em]">Relay</span>
          </Link>
          <Link
            to="/login"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to Login
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
              Webhook delivery, made dependable
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.045em] sm:text-5xl lg:text-[56px]">
              Webhooks you can actually rely on.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              Relay helps developers deliver events to their endpoints reliably, track every attempt, and recover from
              failures without building webhook infrastructure from scratch.
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Get started
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="surface-shadow rounded-2xl border border-border bg-card p-5 sm:p-7">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Delivery lifecycle</p>
                <p className="mt-1 text-xs text-muted-foreground">A clear path from event to endpoint</p>
              </div>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-primary">
                <Webhook className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <div className="space-y-3">
              {workflow.map(({ icon: Icon, title, description }, index) => (
                <div key={title} className="flex items-center gap-3 rounded-xl border border-border/80 bg-background/70 p-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-primary shadow-sm">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="problem-heading" className="border-y border-border/80 bg-card/70">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">The problem</p>
              <h2 id="problem-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Webhooks are easy to send. Hard to operate.
              </h2>
              <p className="mt-4 max-w-md leading-7 text-muted-foreground">
                Delivery infrastructure means dealing with failure modes, retries, and visibility before you can focus
                on your product.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {problems.map((problem) => (
                <li key={problem} className="flex gap-3 rounded-xl border border-border bg-card p-4 text-sm leading-6">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                  <span>{problem}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="workflow-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">How Relay works</p>
            <h2 id="workflow-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              One observable delivery lifecycle.
            </h2>
            <p className="mt-4 leading-7 text-muted-foreground">
              Events move through persistent storage and a background queue, with each delivery recorded for
              inspection and recovery.
            </p>
          </div>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {workflow.map(({ icon: Icon, title, description }, index) => (
              <li key={title} className="surface-shadow relative rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-primary">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">STEP {index + 1}</span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                {index < workflow.length - 1 && (
                  <ArrowDown className="absolute -bottom-[17px] left-1/2 z-10 h-4 w-4 -translate-x-1/2 text-muted-foreground lg:hidden" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="capabilities-heading" className="border-y border-border/80 bg-card/70">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Built for the details</p>
              <h2 id="capabilities-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                The delivery essentials, in one place.
              </h2>
            </div>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm font-medium">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-primary">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="reliability-heading" className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="surface-shadow flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 sm:p-8 md:flex-row md:items-start md:gap-8">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Reliability, honestly</p>
              <h2 id="reliability-heading" className="mt-2 text-2xl font-semibold tracking-tight">
                At-least-once delivery. No exactly-once promises.
              </h2>
              <p className="mt-3 max-w-3xl leading-7 text-muted-foreground">
                Relay retries delivery failures and records attempts, but a receiver may process a request even when
                its response is lost. Your webhook consumers should handle duplicate events idempotently.
              </p>
            </div>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-6xl rounded-2xl bg-foreground px-6 py-12 text-background sm:px-10 sm:py-14">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-background/70">Ship your product, not delivery plumbing.</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Stop rebuilding webhook infrastructure.
                </h2>
              </div>
              <Link
                to="/login"
                className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
              >
                Explore Relay
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/80 px-5 py-6 text-center text-xs text-muted-foreground sm:px-8">
        © {new Date().getFullYear()} Namya Gaur. All rights reserved.
      </footer>
    </div>
  );
}
