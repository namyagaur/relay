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
  revokeApiKeyController
} from "../controllers/project-controller";
import { apiKeyAuth } from "../middleware/api-key-auth";

const router = Router();

router.post("/projects", createProjectController);
router.post("/api-keys", apiKeyAuth, createApiKeyController);
router.delete("/api-keys/:id", apiKeyAuth, revokeApiKeyController);

router.use("/endpoints", apiKeyAuth);
router.post("/endpoints", createEndpointController);
router.get("/endpoints", listEndpointsController);
router.get("/endpoints/:id", getEndpointController);
router.patch("/endpoints/:id", updateEndpointController);
router.delete("/endpoints/:id", deleteEndpointController);

export default router;
