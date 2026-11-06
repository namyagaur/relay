const jsonResponse = (description: string, schema: object) => ({
  description,
  content: { "application/json": { schema } }
});

const errorResponse = (description: string) => jsonResponse(description, {
  $ref: "#/components/schemas/ErrorResponse"
});

const secured = [{ bearerApiKey: [] }];

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Relay API",
    version: "1.0.0",
    description: [
      "API reference for Relay's project-scoped webhook event service.",
      "",
      "Authenticate protected operations with `Authorization: Bearer <api_key>`. Project creation is public and returns the initial API key once.",
      "",
      "## Verify webhook signatures",
      "Each delivery includes `x-relay-signature: sha256=<hex>`, `x-relay-event-id`, and `x-relay-event-type`. Compute HMAC-SHA256 over the exact raw HTTP request body bytes using the endpoint's signing secret, then compare the lowercase hex digest with the portion after `sha256=` using a constant-time comparison. Do not parse and re-serialize JSON before verification. The signing secret is returned only when an endpoint is created; store it securely."
    ].join("\n")
  },
  servers: [{ url: "/api/v1", description: "Relay API v1" }],
  tags: [
    { name: "Projects" },
    { name: "API keys" },
    { name: "Endpoints" },
    { name: "Events" },
    { name: "Deliveries" },
    { name: "Dashboard" }
  ],
  paths: {
    "/auth/session": {
      get: {
        tags: ["Projects"],
        summary: "Validate the API key and return its project context",
        security: secured,
        responses: {
          "200": jsonResponse("Authenticated project context.", {
            type: "object",
            required: ["project", "apiKeyId"],
            properties: {
              project: {
                type: "object",
                required: ["id", "name", "createdAt"],
                properties: {
                  id: { type: "string", format: "uuid" },
                  name: { type: "string" },
                  createdAt: { type: "string", format: "date-time" }
                }
              },
              apiKeyId: { type: "string", format: "uuid" }
            }
          }),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/projects": {
      post: {
        tags: ["Projects"],
        summary: "Create a project and its initial API key",
        description: "This operation does not require authentication. The generated API key is returned only once.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateProjectRequest" },
              example: { name: "Example project" }
            }
          }
        },
        responses: {
          "201": jsonResponse("Project and initial API key created.", { $ref: "#/components/schemas/ProjectCreated" }),
          "400": errorResponse("Invalid request body."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/api-keys": {
      get: {
        tags: ["API keys"],
        summary: "List API key metadata for the authenticated project",
        security: secured,
        responses: {
          "200": jsonResponse("Key metadata only; hashes and raw keys are never returned.", {
            type: "object",
            required: ["data"],
            properties: {
              data: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "name", "createdAt", "lastUsedAt", "revokedAt", "isCurrent"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    name: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                    lastUsedAt: { type: ["string", "null"], format: "date-time" },
                    revokedAt: { type: ["string", "null"], format: "date-time" },
                    isCurrent: { type: "boolean" }
                  }
                }
              }
            }
          }),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      },
      post: {
        tags: ["API keys"],
        summary: "Create an API key for the authenticated project",
        security: secured,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateApiKeyRequest" }, example: { name: "Production" } } }
        },
        responses: {
          "201": jsonResponse("API key created; the raw key is returned only once.", { $ref: "#/components/schemas/ApiKeyCreated" }),
          "400": errorResponse("Invalid request body."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/api-keys/{id}": {
      delete: {
        tags: ["API keys"],
        summary: "Revoke an API key",
        security: secured,
        parameters: [{ $ref: "#/components/parameters/UuidId" }],
        responses: {
          "204": { description: "API key revoked." },
          "400": errorResponse("Invalid API key ID."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("API key not found in the authenticated project."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/endpoints": {
      post: {
        tags: ["Endpoints"],
        summary: "Create a webhook endpoint",
        security: secured,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreateEndpointRequest" }, example: { url: "https://hooks.example.test/relay", description: "Billing notifications" } } }
        },
        responses: {
          "201": jsonResponse("Endpoint created. The signing secret is returned only once.", { $ref: "#/components/schemas/CreatedEndpoint" }),
          "400": errorResponse("Invalid body or unsafe/unsupported endpoint URL."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      },
      get: {
        tags: ["Endpoints"],
        summary: "List non-deleted endpoints",
        security: secured,
        responses: {
          "200": jsonResponse("Endpoints in the authenticated project.", {
            type: "object",
            required: ["data"],
            properties: { data: { type: "array", items: { $ref: "#/components/schemas/Endpoint" } } }
          }),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/endpoints/{id}": {
      parameters: [{ $ref: "#/components/parameters/UuidId" }],
      get: {
        tags: ["Endpoints"],
        summary: "Get a webhook endpoint",
        security: secured,
        responses: {
          "200": jsonResponse("Endpoint in the authenticated project.", { $ref: "#/components/schemas/Endpoint" }),
          "400": errorResponse("Invalid endpoint ID."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("Endpoint not found."),
          "500": errorResponse("Unexpected server error.")
        }
      },
      patch: {
        tags: ["Endpoints"],
        summary: "Update a webhook endpoint",
        security: secured,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdateEndpointRequest" }, example: { description: "Updated notifications", isActive: true } } }
        },
        responses: {
          "200": jsonResponse("Updated endpoint.", { $ref: "#/components/schemas/Endpoint" }),
          "400": errorResponse("Invalid body, endpoint ID, or unsafe/unsupported URL."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("Endpoint not found."),
          "500": errorResponse("Unexpected server error.")
        }
      },
      delete: {
        tags: ["Endpoints"],
        summary: "Soft-delete a webhook endpoint",
        description: "The endpoint is deactivated and soft-deleted; historical delivery attempts are retained.",
        security: secured,
        responses: {
          "204": { description: "Endpoint soft-deleted." },
          "400": errorResponse("Invalid endpoint ID."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("Endpoint not found."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/events": {
      post: {
        tags: ["Events"],
        summary: "Ingest an event",
        security: secured,
        parameters: [{
          name: "Idempotency-Key",
          in: "header",
          required: false,
          description: "Optional project-scoped idempotency key (1-255 characters).",
          schema: { type: "string", minLength: 1, maxLength: 255 },
          example: "invoice-2026-001"
        }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/IngestEventRequest" }, example: { eventType: "invoice.paid", payload: { invoiceId: "inv_example_01" } } } }
        },
        responses: {
          "201": jsonResponse("Event accepted.", { $ref: "#/components/schemas/IngestEventResponse" }),
          "200": jsonResponse("Existing event returned for a duplicate idempotency key.", { $ref: "#/components/schemas/IngestEventResponse" }),
          "400": errorResponse("Invalid body or idempotency key."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      },
      get: {
        tags: ["Events"],
        summary: "List events",
        security: secured,
        parameters: [
          { $ref: "#/components/parameters/Cursor" },
          { name: "limit", in: "query", required: false, description: "Page size, default 20, maximum 100.", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, example: 20 },
          { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/EventStatus" }, example: "failed" }
        ],
        responses: {
          "200": jsonResponse("Newest events for the authenticated project.", { $ref: "#/components/schemas/EventPage" }),
          "400": errorResponse("Invalid query parameters or cursor."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/events/{id}": {
      parameters: [{ $ref: "#/components/parameters/UuidId" }],
      get: {
        tags: ["Events"],
        summary: "Get event details",
        security: secured,
        responses: {
          "200": jsonResponse("Event, immutable delivery targets, and delivery attempts.", { $ref: "#/components/schemas/EventDetails" }),
          "400": errorResponse("Invalid event ID."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("Event not found."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/events/{id}/replay": {
      post: {
        tags: ["Events"],
        summary: "Replay failed event deliveries",
        description: "Creates a durable replay request for eligible failed delivery targets. Successfully delivered targets are not resent.",
        security: secured,
        parameters: [{ $ref: "#/components/parameters/UuidId" }],
        responses: {
          "202": jsonResponse("Replay request accepted.", { $ref: "#/components/schemas/ReplayAccepted" }),
          "400": errorResponse("Invalid event ID."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("Event not found in the authenticated project."),
          "409": errorResponse("Event has no failed deliveries eligible for replay."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/deliveries": {
      get: {
        tags: ["Deliveries"],
        summary: "List delivery attempts",
        security: secured,
        parameters: [
          { $ref: "#/components/parameters/Cursor" },
          { name: "limit", in: "query", required: false, description: "Page size, default 20, maximum 100.", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }, example: 20 },
          { name: "status", in: "query", required: false, schema: { $ref: "#/components/schemas/DeliveryStatus" }, example: "failed" },
          { name: "eventId", in: "query", required: false, schema: { type: "string", format: "uuid" }, example: "11111111-1111-4111-8111-111111111111" },
          { name: "endpointId", in: "query", required: false, schema: { type: "string", format: "uuid" }, example: "22222222-2222-4222-8222-222222222222" }
        ],
        responses: {
          "200": jsonResponse("Newest delivery attempts, including replay attempts.", { $ref: "#/components/schemas/DeliveryPage" }),
          "400": errorResponse("Invalid query parameter or cursor."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/deliveries/{id}": {
      get: {
        tags: ["Deliveries"],
        summary: "Get a delivery attempt",
        security: secured,
        parameters: [{ $ref: "#/components/parameters/UuidId" }],
        responses: {
          "200": jsonResponse("Attempt with event and endpoint metadata.", { $ref: "#/components/schemas/DeliveryDetails" }),
          "400": errorResponse("Invalid delivery ID."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "404": errorResponse("Delivery not found."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/dashboard/stats": {
      get: {
        tags: ["Dashboard"],
        summary: "Get project event and delivery statistics",
        security: secured,
        responses: {
          "200": jsonResponse("Aggregated project statistics.", { $ref: "#/components/schemas/DashboardStatsResponse" }),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/dashboard/activity": {
      get: {
        tags: ["Dashboard"],
        summary: "Get recent events and delivery attempts",
        security: secured,
        parameters: [{ name: "limit", in: "query", required: false, description: "Maximum number in each collection, default 10, maximum 50.", schema: { type: "integer", minimum: 1, maximum: 50, default: 10 }, example: 10 }],
        responses: {
          "200": jsonResponse("Newest events and delivery attempts. Payloads are omitted.", { $ref: "#/components/schemas/DashboardActivityResponse" }),
          "400": errorResponse("Invalid query parameters."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    },
    "/dashboard/delivery-health": {
      get: {
        tags: ["Dashboard"],
        summary: "Get delivery health",
        security: secured,
        parameters: [{
          name: "window",
          in: "query",
          required: false,
          description: "Attempt lookback window, default 24h.",
          schema: { type: "string", enum: ["24h", "7d", "30d"], default: "24h" },
          example: "7d"
        }],
        responses: {
          "200": jsonResponse("Aggregated delivery attempt health.", { $ref: "#/components/schemas/DeliveryHealthResponse" }),
          "400": errorResponse("Invalid time window."),
          "401": errorResponse("Missing, malformed, invalid, or revoked API key."),
          "500": errorResponse("Unexpected server error.")
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerApiKey: {
        type: "http",
        scheme: "bearer",
        description: "Relay API key, supplied as `Authorization: Bearer relay_<key>`."
      }
    },
    parameters: {
      UuidId: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string", format: "uuid" },
        example: "11111111-1111-4111-8111-111111111111"
      },
      Cursor: {
        name: "cursor",
        in: "query",
        required: false,
        description: "UUID of an item on the current project's previous page.",
        schema: { type: "string", format: "uuid" },
        example: "33333333-3333-4333-8333-333333333333"
      }
    },
    schemas: {
      ErrorResponse: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: { code: { type: "string" }, message: { type: "string" } }
          }
        },
        example: { error: { code: "INVALID_REQUEST", message: "Request validation failed." } }
      },
      Project: {
        type: "object",
        required: ["id", "name", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        },
        example: { id: "11111111-1111-4111-8111-111111111111", name: "Example project", createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z" }
      },
      CreateProjectRequest: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
        example: { name: "Example project" }
      },
      ProjectCreated: {
        type: "object",
        required: ["project", "apiKey"],
        properties: { project: { $ref: "#/components/schemas/Project" }, apiKey: { type: "string", description: "Raw API key; shown only once.", pattern: "^relay_[A-Za-z0-9_-]{43}$" } },
        example: { project: { id: "11111111-1111-4111-8111-111111111111", name: "Example project", createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z" }, apiKey: "relay_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }
      },
      CreateApiKeyRequest: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: { name: { type: "string", minLength: 1, maxLength: 120 } },
        example: { name: "Production" }
      },
      ApiKeyCreated: {
        type: "object",
        required: ["id", "name", "createdAt", "apiKey"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          apiKey: { type: "string", description: "Raw API key; shown only once.", pattern: "^relay_[A-Za-z0-9_-]{43}$" }
        },
        example: { id: "44444444-4444-4444-8444-444444444444", name: "Production", createdAt: "2026-01-01T12:00:00.000Z", apiKey: "relay_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }
      },
      Endpoint: {
        type: "object",
        required: ["id", "url", "description", "isActive", "deletedAt", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          url: { type: "string", format: "uri", description: "HTTPS URL resolving exclusively to public IP addresses." },
          description: { type: ["string", "null"] },
          isActive: { type: "boolean" },
          deletedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        },
        example: { id: "22222222-2222-4222-8222-222222222222", url: "https://hooks.example.test/relay", description: "Billing notifications", isActive: true, deletedAt: null, createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z" }
      },
      CreateEndpointRequest: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: { type: "string", minLength: 1, maxLength: 2048, format: "uri" },
          description: { type: "string", maxLength: 500 }
        },
        example: { url: "https://hooks.example.test/relay", description: "Billing notifications" }
      },
      CreatedEndpoint: {
        allOf: [
          { $ref: "#/components/schemas/Endpoint" },
          {
            type: "object",
            required: ["signingSecret"],
            properties: { signingSecret: { type: "string", description: "Endpoint signing secret; returned only at creation." } }
          }
        ],
        example: { id: "22222222-2222-4222-8222-222222222222", url: "https://hooks.example.test/relay", description: "Billing notifications", isActive: true, deletedAt: null, createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z", signingSecret: "example_signing_secret_value" }
      },
      UpdateEndpointRequest: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          url: { type: "string", minLength: 1, maxLength: 2048, format: "uri" },
          description: { type: ["string", "null"], maxLength: 500 },
          isActive: { type: "boolean" }
        },
        example: { description: "Updated notifications", isActive: true }
      },
      EventStatus: { type: "string", enum: ["pending", "processing", "delivered", "failed", "skipped"] },
      DeliveryStatus: { type: "string", enum: ["delivered", "retrying", "failed", "skipped"] },
      IngestEventRequest: {
        type: "object",
        additionalProperties: false,
        required: ["eventType", "payload"],
        properties: {
          eventType: { type: "string", minLength: 1, maxLength: 255 },
          payload: { type: "object", additionalProperties: true }
        },
        example: { eventType: "invoice.paid", payload: { invoiceId: "inv_example_01" } }
      },
      IngestedEvent: {
        type: "object",
        required: ["id", "projectId", "idempotencyKey", "eventType", "payload", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" },
          projectId: { type: "string", format: "uuid" },
          idempotencyKey: { type: ["string", "null"] },
          eventType: { type: "string" },
          payload: { type: "object", additionalProperties: true },
          status: { $ref: "#/components/schemas/EventStatus" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" }
        },
        example: { id: "11111111-1111-4111-8111-111111111111", projectId: "99999999-9999-4999-8999-999999999999", idempotencyKey: "invoice-2026-001", eventType: "invoice.paid", payload: { invoiceId: "inv_example_01" }, status: "pending", createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z" }
      },
      IngestEventResponse: {
        type: "object",
        required: ["event", "duplicate"],
        properties: { event: { $ref: "#/components/schemas/IngestedEvent" }, duplicate: { type: "boolean" } },
        example: { event: { id: "11111111-1111-4111-8111-111111111111", projectId: "99999999-9999-4999-8999-999999999999", idempotencyKey: "invoice-2026-001", eventType: "invoice.paid", payload: { invoiceId: "inv_example_01" }, status: "pending", createdAt: "2026-01-01T12:00:00.000Z", updatedAt: "2026-01-01T12:00:00.000Z" }, duplicate: false }
      },
      Pagination: {
        type: "object",
        required: ["nextCursor", "hasMore"],
        properties: { nextCursor: { type: ["string", "null"], format: "uuid" }, hasMore: { type: "boolean" } }
      },
      EventListItem: {
        type: "object",
        required: ["id", "eventType", "payload", "status", "createdAt", "updatedAt"],
        properties: {
          id: { type: "string", format: "uuid" }, eventType: { type: "string" }, payload: { type: "object", additionalProperties: true },
          status: { $ref: "#/components/schemas/EventStatus" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
        }
      },
      EventPage: {
        type: "object",
        required: ["data", "pagination"],
        properties: {
          data: { type: "array", items: { $ref: "#/components/schemas/EventListItem" } },
          pagination: { $ref: "#/components/schemas/Pagination" }
        }
      },
      EventAttempt: {
        type: "object",
        required: ["attemptNumber", "status", "responseStatusCode", "errorMessage", "durationMs", "attemptedAt"],
        properties: {
          attemptNumber: { type: "integer" }, status: { $ref: "#/components/schemas/DeliveryStatus" },
          responseStatusCode: { type: ["integer", "null"] }, errorMessage: { type: ["string", "null"] },
          durationMs: { type: ["integer", "null"] }, attemptedAt: { type: "string", format: "date-time" }
        }
      },
      EventDetails: {
        type: "object",
        required: ["id", "eventType", "payload", "status", "createdAt", "updatedAt", "deliveryTargets", "attempts"],
        properties: {
          id: { type: "string", format: "uuid" }, eventType: { type: "string" }, payload: { type: "object", additionalProperties: true },
          status: { $ref: "#/components/schemas/EventStatus" }, createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" },
          deliveryTargets: { type: "array", items: { type: "object", required: ["endpointId"], properties: { endpointId: { type: "string", format: "uuid" } } } },
          attempts: { type: "array", items: { $ref: "#/components/schemas/EventAttempt" } }
        }
      },
      ReplayAccepted: {
        type: "object",
        required: ["replayRequestId", "status"],
        properties: { replayRequestId: { type: "string", format: "uuid" }, status: { type: "string", enum: ["pending"] } },
        example: { replayRequestId: "66666666-6666-4666-8666-666666666666", status: "pending" }
      },
      DeliveryListItem: {
        type: "object",
        required: ["id", "attemptNumber", "status", "responseStatusCode", "errorMessage", "durationMs", "attemptedAt", "replayRequestId", "event", "endpoint"],
        properties: {
          id: { type: "string", format: "uuid" }, attemptNumber: { type: "integer" }, status: { $ref: "#/components/schemas/DeliveryStatus" },
          responseStatusCode: { type: ["integer", "null"] }, errorMessage: { type: ["string", "null"] },
          durationMs: { type: ["integer", "null"] }, attemptedAt: { type: "string", format: "date-time" },
          replayRequestId: { type: ["string", "null"], format: "uuid" },
          event: { type: "object", required: ["id", "eventType"], properties: { id: { type: "string", format: "uuid" }, eventType: { type: "string" } } },
          endpoint: { type: "object", required: ["id", "url"], properties: { id: { type: "string", format: "uuid" }, url: { type: "string", format: "uri" } } }
        }
      },
      DeliveryPage: {
        type: "object",
        required: ["data", "pagination"],
        properties: { data: { type: "array", items: { $ref: "#/components/schemas/DeliveryListItem" } }, pagination: { $ref: "#/components/schemas/Pagination" } }
      },
      DeliveryDetails: {
        allOf: [
          { $ref: "#/components/schemas/DeliveryListItem" },
          {
            type: "object",
            required: ["responseBody"],
            properties: {
              responseBody: { type: ["string", "null"] },
              attempts: {
                type: "array",
                items: {
                  type: "object",
                  required: ["id", "attemptNumber", "status", "responseStatusCode", "responseBody", "errorMessage", "durationMs", "attemptedAt"],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    attemptNumber: { type: "integer" },
                    status: { $ref: "#/components/schemas/DeliveryStatus" },
                    responseStatusCode: { type: ["integer", "null"] },
                    responseBody: { type: ["string", "null"] },
                    errorMessage: { type: ["string", "null"] },
                    durationMs: { type: ["integer", "null"] },
                    attemptedAt: { type: "string", format: "date-time" }
                  }
                }
              },
              event: { type: "object", required: ["id", "eventType", "status", "createdAt", "payload"], properties: { id: { type: "string", format: "uuid" }, eventType: { type: "string" }, status: { $ref: "#/components/schemas/EventStatus" }, createdAt: { type: "string", format: "date-time" }, payload: { type: "object", additionalProperties: true } } },
              endpoint: { type: "object", required: ["id", "url", "description", "isActive", "deletedAt"], properties: { id: { type: "string", format: "uuid" }, url: { type: "string", format: "uri" }, description: { type: ["string", "null"] }, isActive: { type: "boolean" }, deletedAt: { type: ["string", "null"], format: "date-time" } } }
            }
          }
        ]
      },
      DashboardStats: {
        type: "object",
        required: ["totalEvents", "deliveredEvents", "failedEvents", "pendingProcessingEvents", "activeEndpoints", "totalDeliveryAttempts", "successRate", "failureRate"],
        properties: {
          totalEvents: { type: "integer" }, deliveredEvents: { type: "integer" }, failedEvents: { type: "integer" },
          pendingProcessingEvents: { type: "integer", description: "Events whose status is pending or processing." },
          activeEndpoints: { type: "integer" },
          totalDeliveryAttempts: { type: "integer", description: "Includes normal delivery attempts and replay attempts." },
          successRate: { type: "number", description: "delivered attempts / all attempts as a percentage; zero when there are no attempts." },
          failureRate: { type: "number", description: "failed attempts / all attempts as a percentage; zero when there are no attempts." }
        },
        example: { totalEvents: 100, deliveredEvents: 85, failedEvents: 5, pendingProcessingEvents: 10, activeEndpoints: 3, totalDeliveryAttempts: 90, successRate: 80, failureRate: 20 }
      },
      DashboardStatsResponse: { type: "object", required: ["data"], properties: { data: { $ref: "#/components/schemas/DashboardStats" } } },
      ActivityEvent: {
        type: "object", required: ["id", "eventType", "status", "createdAt"],
        properties: { id: { type: "string", format: "uuid" }, eventType: { type: "string" }, status: { $ref: "#/components/schemas/EventStatus" }, createdAt: { type: "string", format: "date-time" } }
      },
      ActivityAttempt: {
        type: "object",
        required: ["id", "attemptNumber", "status", "responseStatusCode", "durationMs", "attemptedAt", "replayRequestId", "event", "endpoint"],
        properties: {
          id: { type: "string", format: "uuid" }, attemptNumber: { type: "integer" }, status: { $ref: "#/components/schemas/DeliveryStatus" },
          responseStatusCode: { type: ["integer", "null"] }, durationMs: { type: ["integer", "null"] }, attemptedAt: { type: "string", format: "date-time" },
          replayRequestId: { type: ["string", "null"], format: "uuid" },
          event: { type: "object", required: ["id", "eventType"], properties: { id: { type: "string", format: "uuid" }, eventType: { type: "string" } } },
          endpoint: { type: "object", required: ["id"], properties: { id: { type: "string", format: "uuid" } } }
        }
      },
      DashboardActivityResponse: {
        type: "object", required: ["data"],
        properties: {
          data: {
            type: "object", required: ["events", "deliveryAttempts"],
            properties: {
              events: { type: "array", items: { $ref: "#/components/schemas/ActivityEvent" } },
              deliveryAttempts: { type: "array", items: { $ref: "#/components/schemas/ActivityAttempt" } }
            }
          }
        }
      },
      DeliveryHealth: {
        type: "object",
        required: ["window", "delivered", "failed", "retrying", "pending", "successRate"],
        properties: {
          window: { type: "string", enum: ["24h", "7d", "30d"] }, delivered: { type: "integer" }, failed: { type: "integer" },
          retrying: { type: "integer" }, pending: { type: "integer" }, successRate: { type: "number", description: "delivered / (delivered + failed) as a percentage; zero when there are no terminal attempts." }
        },
        example: { window: "24h", delivered: 80, failed: 5, retrying: 2, pending: 0, successRate: 94.12 }
      },
      DeliveryHealthResponse: { type: "object", required: ["data"], properties: { data: { $ref: "#/components/schemas/DeliveryHealth" } } }
    }
  }
} as const;
