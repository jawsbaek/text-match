# Database Setup for text-match Project

This guide will help you set up a PostgreSQL database for the text-match project on your localhost.

## Prerequisites

Make sure PostgreSQL is installed and running on your system:

```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows
# Download and install from: https://www.postgresql.org/download/windows/
```

## Database Setup

### Method 1: Using the SQL Script

1. Run the setup script as the PostgreSQL superuser:

```bash
# Connect as postgres user and run the setup script
sudo -u postgres psql -f setup-db.sql
```

### Method 2: Manual Setup

If you prefer to set up manually, run these commands:

```bash
# Connect to PostgreSQL as superuser
sudo -u postgres psql

# Then run these SQL commands:
```

```sql
-- Create database
CREATE DATABASE textmatch_dev;

-- Create user with password
CREATE USER textmatch_user WITH PASSWORD 'textmatch_password_2025!';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE textmatch_dev TO textmatch_user;

-- Connect to the new database
\c textmatch_dev;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO textmatch_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO textmatch_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO textmatch_user;

-- Grant default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO textmatch_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO textmatch_user;

-- Exit PostgreSQL
\q
```

## Environment Configuration

Create a `.env` file in your project root with the following configuration:

```bash
# Database Configuration
DATABASE_URL=postgresql://textmatch_user:textmatch_password_2025!@localhost:5432/textmatch_dev

# Base URL
VITE_BASE_URL=http://localhost:3000

# Better Auth Secret (generate with the command below)
BETTER_AUTH_SECRET=your_secret_here

# Optional OAuth2 Providers
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Optional Netlify Identity
NETLIFY_IDENTITY_SITE=
NETLIFY_IDENTITY_AUD=
```

## Generate Auth Secret

Generate a secure secret for Better Auth:

```bash
bun run auth:secret
```

Copy the generated secret and add it to your `.env` file as `BETTER_AUTH_SECRET`.

## Database Migration

Once your database is set up and environment variables are configured, run the database migrations:

```bash
# Generate and run migrations
bun run db generate
bun run db migrate

# Optional: Seed the database
bun run db:seed
```

## Verify Connection

Test your database connection by starting the development server:

```bash
bun run dev
```

If everything is set up correctly, the application should start without database connection errors.

## Database Credentials Summary

- **Database Name**: `textmatch_dev`
- **Username**: `textmatch_user`
- **Password**: `textmatch_password_2025!`
- **Host**: `localhost`
- **Port**: `5432` (default PostgreSQL port)
- **Connection URL**: `postgresql://textmatch_user:textmatch_password_2025!@localhost:5432/textmatch_dev`

## Security Notes

⚠️ **Important**: The credentials provided here are for development purposes only. For production:

1. Use strong, unique passwords
2. Consider using environment-specific credentials
3. Enable SSL connections
4. Follow PostgreSQL security best practices
5. Never commit real credentials to version control

## Troubleshooting

### Common Issues

1. **PostgreSQL not running**: Make sure PostgreSQL service is started
2. **Permission denied**: Ensure you're running commands with appropriate privileges
3. **Database already exists**: If you need to reset, drop the database first:
   ```sql
   DROP DATABASE IF EXISTS textmatch_dev;
   DROP USER IF EXISTS textmatch_user;
   ```

### Connection Test

You can test the connection directly with psql:

```bash
psql postgresql://textmatch_user:textmatch_password_2025!@localhost:5432/textmatch_dev
```

If successful, you should see the PostgreSQL prompt for the textmatch_dev database.
