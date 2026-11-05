import express from "express";
import cors from "cors";
import helmet from "helmet";
import apiV1Router from "./routes/api-v1";

const app = express();

// Security and request middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));
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
