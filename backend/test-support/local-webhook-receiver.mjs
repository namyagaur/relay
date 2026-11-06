import { createServer } from "node:http";

const port = Number(process.env.RELAY_TEST_RECEIVER_PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  throw new Error("RELAY_TEST_RECEIVER_PORT must be an integer from 0 to 65535.");
}

const maxBodyBytes = 1024 * 1024;
const requests = [];
let responseStatus = 200;

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body)
  });
  response.end(body);
}

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/_health") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (request.method === "GET" && request.url === "/_requests") {
    sendJson(response, 200, { requests });
    return;
  }

  if (request.method === "DELETE" && request.url === "/_requests") {
    requests.length = 0;
    sendJson(response, 200, { cleared: true });
    return;
  }

  if (request.method === "POST" && request.url === "/_control/status") {
    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1024) {
        response.writeHead(413).end();
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      let value;
      try {
        value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      } catch {
        sendJson(response, 400, { error: "Expected a JSON statusCode." });
        return;
      }
      if (value?.statusCode !== 200 && value?.statusCode !== 500) {
        sendJson(response, 400, { error: "statusCode must be 200 or 500." });
        return;
      }
      responseStatus = value.statusCode;
      sendJson(response, 200, { statusCode: responseStatus });
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/webhook") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const chunks = [];
  let size = 0;
  request.on("data", (chunk) => {
    size += chunk.length;
    if (size > maxBodyBytes) {
      response.writeHead(413).end();
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    const rawBody = Buffer.concat(chunks).toString("utf8");
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null;
    }
    requests.push({
      receivedAt: new Date().toISOString(),
      method: request.method,
      headers: request.headers,
      rawBody,
      body
    });
    sendJson(response, responseStatus, { received: true });
  });
});

server.listen(port, "127.0.0.1", () => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the local webhook receiver port.");
  }
  console.log(`Local webhook receiver listening at http://127.0.0.1:${address.port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
