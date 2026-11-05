import type { NextFunction, Request, Response } from "express";
import { prisma } from "../config/prisma";
import { hashApiKey, isWellFormedApiKey } from "../utils/api-key";

const LAST_USED_UPDATE_INTERVAL_MS = 5 * 60 * 1000;

function unauthorized(res: Response): void {
  res.status(401).json({
    error: { code: "UNAUTHORIZED", message: "A valid bearer API key is required." }
  });
}

export async function apiKeyAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authorization = req.get("authorization");
  const match = authorization?.match(/^([A-Za-z]+) (relay_[A-Za-z0-9_-]{43})$/);
  if (!match || match[1].toLowerCase() !== "bearer" || !isWellFormedApiKey(match[2])) {
    unauthorized(res);
    return;
  }

  try {
    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: hashApiKey(match[2]) },
      select: {
        id: true,
        projectId: true,
        revokedAt: true,
        project: { select: { id: true, name: true } }
      }
    });

    if (!apiKey || apiKey.revokedAt || apiKey.projectId !== apiKey.project.id) {
      unauthorized(res);
      return;
    }

    req.authenticatedProject = apiKey.project;
    req.authenticatedApiKeyId = apiKey.id;
    const staleBefore = new Date(Date.now() - LAST_USED_UPDATE_INTERVAL_MS);
    await prisma.apiKey.updateMany({
      where: {
        id: apiKey.id,
        revokedAt: null,
        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: staleBefore } }]
      },
      data: { lastUsedAt: new Date() }
    });

    next();
  } catch (error) {
    next(error);
  }
}
