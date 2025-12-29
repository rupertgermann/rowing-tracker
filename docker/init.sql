-- Initial database setup for rowing-tracker
-- This script runs automatically when the PostgreSQL container is first created

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a comment to verify the database was initialized
COMMENT ON DATABASE rowing_tracker IS 'Rowing Tracker Application Database - Initialized via Docker';
