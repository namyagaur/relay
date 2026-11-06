import { Router } from "express";
import {
  createEndpointController,
  deleteEndpointController,
  getEndpointController,
  listEndpointsController,
  updateEndpointController
} from "../controllers/endpoint-controller";
import {
  createApiKeyController,
  createProjectController,
  currentProjectController,
  listApiKeysController,
  revokeApiKeyController
} from "../controllers/project-controller";
import { getDeliveryController, listDeliveriesController } from "../controllers/delivery-controller";
import {
  dashboardActivityController,
  dashboardDeliveryHealthController,
  dashboardStatsController
} from "../controllers/dashboard-controller";
import { getEventController, ingestEventController, listEventsController, replayEventController } from "../controllers/event-controller";
import { apiKeyAuth } from "../middleware/api-key-auth";

const router = Router();

router.post("/projects", createProjectController);
router.get("/auth/session", apiKeyAuth, currentProjectController);
router.get("/api-keys", apiKeyAuth, listApiKeysController);
router.post("/api-keys", apiKeyAuth, createApiKeyController);
router.delete("/api-keys/:id", apiKeyAuth, revokeApiKeyController);
router.post("/events", apiKeyAuth, ingestEventController);
router.get("/events", apiKeyAuth, listEventsController);
router.get("/events/:id", apiKeyAuth, getEventController);
router.post("/events/:id/replay", apiKeyAuth, replayEventController);
router.get("/deliveries", apiKeyAuth, listDeliveriesController);
router.get("/deliveries/:id", apiKeyAuth, getDeliveryController);
router.get("/dashboard/stats", apiKeyAuth, dashboardStatsController);
router.get("/dashboard/activity", apiKeyAuth, dashboardActivityController);
router.get("/dashboard/delivery-health", apiKeyAuth, dashboardDeliveryHealthController);

router.use("/endpoints", apiKeyAuth);
router.post("/endpoints", createEndpointController);
router.get("/endpoints", listEndpointsController);
router.get("/endpoints/:id", getEndpointController);
router.patch("/endpoints/:id", updateEndpointController);
router.delete("/endpoints/:id", deleteEndpointController);

export default router;
