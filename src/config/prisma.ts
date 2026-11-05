import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL must be set to initialize Prisma Client.");
}

const adapter = new PrismaNeon({ connectionString });

export const prisma = new PrismaClient({
  adapter,
  omit: {
    endpoint: {
      encryptedSecret: true
    }
  }
});
