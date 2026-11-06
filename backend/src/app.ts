import express from "express";
import cors from "cors";
import helmet from "helmet";
import { openApiSpec } from "./docs/openapi";
import apiV1Router from "./routes/api-v1";

const app = express();

// Security and request middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character] ?? character);
}

app.get("/api/docs/openapi.json", (_req, res) => {
  res.status(200).json(openApiSpec);
});

app.get("/api/docs", (_req, res) => {
  const rows = Object.entries(openApiSpec.paths).flatMap(([path, pathItem]) =>
    Object.entries(pathItem).flatMap(([method, definition]) => {
      if (!["get", "post", "patch", "delete"].includes(method)) return [];
      const operation = definition as { summary?: string; security?: readonly unknown[] };
      return [`<tr><td><code>${escapeHtml(method.toUpperCase())}</code></td><td><code>${escapeHtml(path)}</code></td><td>${escapeHtml(operation.summary ?? "")}</td><td>${operation.security?.length ? "Bearer API key" : "No authentication"}</td></tr>`];
    })
  ).join("");

  res.status(200).type("html").send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Relay API Reference</title></head>
<body>
<main>
<h1>Relay API Reference</h1>
<p>OpenAPI 3.1 specification: <a href="/api/docs/openapi.json">openapi.json</a>.</p>
<p>Protected operations require <code>Authorization: Bearer &lt;api_key&gt;</code>. Project creation is public and returns the initial API key once.</p>
<table>
<thead><tr><th>Method</th><th>Path</th><th>Operation</th><th>Authentication</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<h2>Webhook signature verification</h2>
<p>Verify <code>x-relay-signature</code> as <code>sha256=&lt;hex&gt;</code> by computing HMAC-SHA256 with the endpoint signing secret over the exact raw HTTP request body bytes. Compare the lowercase hex digest in constant time. Do not parse and re-serialize JSON before verification. The secret is returned only when creating an endpoint.</p>
</main>
</body>
</html>`);
});

app.use("/api/v1", apiV1Router);

// Health check endpoint
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "relay"
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.headersSent) return;
  if (error instanceof SyntaxError && "status" in error && error.status === 400) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must contain valid JSON." } });
    return;
  }
  console.error("Unhandled request error");
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." } });
});

export default app;
