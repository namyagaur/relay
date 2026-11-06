import { useEffect, useState } from 'react';
import { BookOpen, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/shared/PageHeader';
import CodeBlock from '@/components/shared/CodeBlock';

const SECTIONS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'creating-events', label: 'Creating events' },
  { id: 'managing-endpoints', label: 'Managing endpoints' },
  { id: 'signatures', label: 'Webhook signatures' },
  { id: 'delivery-behaviour', label: 'Delivery behaviour' },
  { id: 'retry-behaviour', label: 'Retry behaviour' },
  { id: 'api-reference', label: 'API reference' },
];

const SECTION_IDS = SECTIONS.map((section) => section.id);

const API_ROWS = [
  { method: 'POST', path: '/api/v1/projects', description: 'Create a project and its initial API key (public).' },
  { method: 'GET', path: '/api/v1/auth/session', description: 'Validate the key and return its project context.' },
  { method: 'GET', path: '/api/v1/api-keys', description: 'List project key metadata; raw keys are never returned.' },
  { method: 'POST', path: '/api/v1/api-keys', description: 'Create a project-scoped API key.' },
  { method: 'DELETE', path: '/api/v1/api-keys/{id}', description: 'Revoke an API key.' },
  { method: 'POST', path: '/api/v1/events', description: 'Ingest an event for the authenticated project.' },
  { method: 'GET', path: '/api/v1/events', description: 'List project events with cursor pagination and status filtering.' },
  { method: 'GET', path: '/api/v1/events/{id}', description: 'Retrieve event details and delivery attempts.' },
  { method: 'POST', path: '/api/v1/events/{id}/replay', description: 'Queue eligible failed event deliveries for replay.' },
  { method: 'GET', path: '/api/v1/deliveries', description: 'List project delivery attempts with filters and cursor pagination.' },
  { method: 'GET', path: '/api/v1/deliveries/{id}', description: 'Retrieve a delivery attempt and its history.' },
  { method: 'GET', path: '/api/v1/dashboard/stats', description: 'Read project dashboard statistics.' },
  { method: 'GET', path: '/api/v1/dashboard/activity', description: 'Read recent project activity.' },
  { method: 'GET', path: '/api/v1/dashboard/delivery-health', description: 'Read project delivery health.' },
  { method: 'POST', path: '/api/v1/endpoints', description: 'Register a webhook destination.' },
  { method: 'GET', path: '/api/v1/endpoints', description: 'List project endpoints.' },
  { method: 'GET', path: '/api/v1/endpoints/{id}', description: 'Retrieve an endpoint.' },
  { method: 'PATCH', path: '/api/v1/endpoints/{id}', description: 'Update an endpoint URL, description, or active state.' },
  { method: 'DELETE', path: '/api/v1/endpoints/{id}', description: 'Delete an endpoint.' },
];

function useActiveSection() {
  const [active, setActive] = useState(SECTION_IDS[0]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: '-96px 0px -72% 0px', threshold: 0 },
    );
    SECTION_IDS.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  return active;
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 border-b border-border pb-8 pt-8 first:pt-0">
      <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
      <div className="mt-3 space-y-3.5 text-[13px] leading-6 text-muted-foreground">{children}</div>
    </section>
  );
}

export default function Docs() {
  const active = useActiveSection();

  return (
    <div>
      <PageHeader
        title="Documentation"
        description="Everything you need to integrate Relay into your stack."
        meta={
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-[3px] text-[10.5px] font-medium text-muted-foreground">
            API v1
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_168px]">
        <nav aria-label="Documentation sections" className="hidden lg:block">
          <div className="sticky top-20">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">Sections</p>
            <ul className="space-y-0.5">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      'block rounded-md px-2 py-1.5 text-[12px] transition-colors',
                      active === section.id
                        ? 'bg-accent font-medium text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        <article className="min-w-0 rounded-xl border border-border bg-surface p-5 sm:p-7">
          <div className="mb-6 flex gap-2 rounded-lg border border-border bg-elevated px-3 py-2.5 text-[11.5px] leading-5 text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={1.75} />
            <p>
              The dashboard connects to the Relay API at{' '}
              <span className="font-mono text-foreground">VITE_API_BASE_URL</span>, which defaults to{' '}
              <span className="font-mono text-foreground">http://localhost:3000/api/v1</span>. All data and API keys
              are scoped to one project.
            </p>
          </div>

          <Section id="getting-started" title="Getting started">
            <p>
              Create a project in the console or with the public project-creation route. Save the returned API key
              securely: it is displayed only once. Register an HTTPS endpoint, then send events to the project.
            </p>
            <CodeBlock
              language="bash"
              filename="send-event.sh"
              code={`curl -X POST "$RELAY_BASE_URL/events" \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "eventType": "payment.completed",
    "payload": { "id": "pay_1042", "amount": 4900, "currency": "usd" }
  }'`}
            />
            <p>
              Set <span className="font-mono text-foreground">RELAY_BASE_URL</span> to the API base URL, including the
              <span className="font-mono text-foreground"> /api/v1</span> prefix.
            </p>
          </Section>

          <Section id="authentication" title="Authentication">
            <p>
              Except for project creation, requests require a project-scoped API key in the bearer Authorization
              header. The API stores only a hash of each key. The key list contains metadata, never raw keys or hashes.
            </p>
            <CodeBlock
              language="bash"
              filename="auth-header"
              code={`Authorization: Bearer $RELAY_API_KEY`}
            />
            <p>
              The authenticated key selects one project; there is no workspace-wide or cross-project access. Revoking
              a key prevents it from authenticating future requests.
            </p>
          </Section>

          <Section id="creating-events" title="Creating events">
            <p>
              Submit an <span className="font-mono text-foreground">eventType</span> and JSON object{' '}
              <span className="font-mono text-foreground">payload</span>. An optional{' '}
              <span className="font-mono text-foreground">Idempotency-Key</span> header makes repeated ingestion
              requests idempotent. Events are scoped to the authenticated project and queued for delivery to its
              active endpoints.
            </p>
            <p>
              Event lists support cursor pagination (up to 100 records per page) and filtering by event status. Event
              detail includes delivery targets and recorded attempts.
            </p>
          </Section>

          <Section id="managing-endpoints" title="Managing endpoints">
            <p>
              Endpoints must use HTTPS and resolve exclusively to public IP addresses. Create an endpoint with a
              <span className="font-mono text-foreground"> url</span> and optional{' '}
              <span className="font-mono text-foreground">description</span>. Endpoint updates accept{' '}
              <span className="font-mono text-foreground">url</span>,{' '}
              <span className="font-mono text-foreground">description</span>, and{' '}
              <span className="font-mono text-foreground">isActive</span>.
            </p>
            <CodeBlock
              language="bash"
              filename="register-endpoint.sh"
              code={`curl -X POST "$RELAY_BASE_URL/endpoints" \\
  -H "Authorization: Bearer $RELAY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://api.example.com/webhooks/relay",
    "description": "Payment notifications"
  }'`}
            />
            <p>
              A signing secret is returned only when an endpoint is created. Store it securely; it cannot be retrieved
              later. Endpoint deletion removes it from future delivery while retaining its historical records.
            </p>
          </Section>

          <Section id="signatures" title="Webhook signatures">
            <p>
              Relay sends the event payload as a JSON request body, along with{' '}
              <span className="font-mono text-foreground">x-relay-event-id</span>,{' '}
              <span className="font-mono text-foreground">x-relay-event-type</span>, and{' '}
              <span className="font-mono text-foreground">x-relay-signature</span> headers. The signature is
              <span className="font-mono text-foreground"> sha256=&lt;hex&gt;</span>, an HMAC-SHA256 of the exact raw
              request body using the endpoint signing secret.
            </p>
            <p>
              Verify the signature against the unparsed request-body bytes. Do not parse and re-serialize JSON before
              checking it, because whitespace and key ordering affect the signed bytes.
            </p>
          </Section>

          <Section id="delivery-behaviour" title="Delivery behaviour">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Event ingestion writes delivery work to a transactional outbox.</li>
              <li>The outbox dispatcher enqueues work for each active endpoint in the event&apos;s project.</li>
              <li>A delivery is successful only when the endpoint returns a 2xx response.</li>
              <li>Webhook requests have a 10-second default timeout; response bodies are retained up to 10 KiB.</li>
            </ul>
          </Section>

          <Section id="retry-behaviour" title="Retry behaviour">
            <p>
              Transient request failures and non-2xx responses are retried by the BullMQ delivery worker according to
              its configured attempts and exponential backoff. Each attempt is recorded. Replaying an event queues its
              failed deliveries again and returns an accepted replay request.
            </p>
          </Section>

          <Section id="api-reference" title="API reference">
            <p>
              All routes except <span className="font-mono text-foreground">POST /api/v1/projects</span> require a
              project-scoped bearer API key. List routes return cursor pagination where applicable; list limits are
              capped at 100.
            </p>
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-elevated text-left text-[10.5px] uppercase tracking-[0.07em] text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Path</th>
                    <th className="px-3 py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {API_ROWS.map((row) => (
                    <tr key={`${row.method}-${row.path}`} className="border-t border-border">
                      <td className="px-3 py-2 font-mono text-[10.5px] font-medium text-brand">{row.method}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-foreground">{row.path}</td>
                      <td className="px-3 py-2 text-muted-foreground">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-[11.5px]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              Errors use an <span className="font-mono text-foreground">error.code</span> and{' '}
              <span className="font-mono text-foreground">error.message</span> JSON shape. Invalid requests return
              HTTP 400; unauthenticated requests return HTTP 401.
            </p>
          </Section>
        </article>

        <aside className="hidden xl:block">
          <div className="sticky top-20">
            <p className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground">
              <BookOpen className="h-3 w-3" strokeWidth={1.75} /> On this page
            </p>
            <ul className="space-y-1.5 border-l border-border pl-3">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={cn(
                      'block text-[11.5px] leading-4 transition-colors',
                      active === section.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
