// Prisma configuration for Rowing Tracker
// Supports both local Docker PostgreSQL and Supabase
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load environment variables from .env.local first, then .env
config({ path: ".env.local" });
config({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for migrations if available (Supabase), otherwise use DATABASE_URL
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"]!,
  },
});
