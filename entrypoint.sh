#!/bin/bash
set -e

# Start PostgreSQL service
echo "Starting PostgreSQL..."
service postgresql start

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -p 5432; do
  sleep 1
done

# Initialize database role and database name to match default project settings
echo "Initializing PostgreSQL roles and database..."
sudo -u postgres psql -c "DO \$\$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'root') THEN CREATE ROLE root WITH SUPERUSER LOGIN PASSWORD 'root'; END IF; END \$\$;"
sudo -u postgres psql -c "SELECT 1 FROM pg_database WHERE datname = 'davinci'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE davinci OWNER root;"

# Run the database setup script to migrate tables
echo "Running schema setup migrations..."
node scripts/setup-pg.js

# Start the Next.js production server
echo "Starting Next.js Server..."
exec npm start
