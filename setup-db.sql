-- PostgreSQL Database Setup for text-match project
-- Run this script as a PostgreSQL superuser (e.g., postgres)

-- Create database
CREATE DATABASE textmatch_dev;

-- Create user with password
CREATE USER textmatch_user WITH PASSWORD 'textmatch_password_2025!';

-- Grant all privileges on the database to the user
GRANT ALL PRIVILEGES ON DATABASE textmatch_dev TO textmatch_user;

-- Connect to the new database and grant schema privileges
\c textmatch_dev;

-- Grant privileges on the public schema
GRANT ALL ON SCHEMA public TO textmatch_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO textmatch_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO textmatch_user;

-- Grant default privileges for future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO textmatch_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO textmatch_user;

-- Display connection information
\echo 'Database setup complete!'
\echo 'Database: textmatch_dev'
\echo 'User: textmatch_user'
\echo 'Password: textmatch_password_2025!'
\echo 'Connection URL: postgresql://textmatch_user:textmatch_password_2025!@localhost:5432/textmatch_dev'
