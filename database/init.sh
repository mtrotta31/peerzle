#!/bin/bash
set -e

echo "==================================="
echo "Peerzle Database Initialization"
echo "==================================="

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set"
  exit 1
fi

echo ""
echo "Running schema..."
psql "$DATABASE_URL" < database/schema.sql

echo ""
echo "Running migrations..."
for f in database/migrations/*.sql; do
  echo "  Running $f..."
  psql "$DATABASE_URL" < "$f"
done

echo ""
echo "Running seeds..."
psql "$DATABASE_URL" < database/seeds/first-responders.sql

echo ""
echo "==================================="
echo "Database initialization complete!"
echo "==================================="
