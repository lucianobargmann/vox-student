-- QA Database Initialization Script
-- This script runs when the PostgreSQL container starts for the first time

-- Set timezone to UTC for consistent testing
SET timezone = 'UTC';

-- Create database if it doesn't exist (already handled by POSTGRES_DB)
-- CREATE DATABASE IF NOT EXISTS voxstudent_qa;

-- Grant permissions to the voxstudent user
GRANT ALL PRIVILEGES ON DATABASE voxstudent_qa TO voxstudent;

-- Ensure UTF8 encoding
ALTER DATABASE voxstudent_qa SET client_encoding = 'UTF8';
ALTER DATABASE voxstudent_qa SET timezone = 'UTC';

-- Log initialization
SELECT 'QA Database initialized successfully' AS status;