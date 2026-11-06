import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set to initialize Prisma Client.");
}

function createTestAdapter(url: string) {
  const hostname = new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error("Integration tests require a loopback PostgreSQL DATABASE_URL.");
  }
  const { PrismaPg } = require("@prisma/adapter-pg") as typeof import("@prisma/adapter-pg");
  return new PrismaPg({ connectionString: url });
}

const adapter = process.env.RELAY_TEST_DATABASE === "local"
  ? createTestAdapter(connectionString)
  : new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({
  adapter,
  omit: {
    endpoint: {
      encryptedSecret: true
    }
  }
});
