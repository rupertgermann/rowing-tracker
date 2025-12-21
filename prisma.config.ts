// Prisma configuration for Rowing Tracker
// Supports both local Docker PostgreSQL and Supabase
import "dotenv/config";
import { defineConfig } from "prisma/config";

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
