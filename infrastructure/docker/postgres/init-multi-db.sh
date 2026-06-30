#!/bin/bash
# Creates additional databases listed in POSTGRES_MULTIPLE_DATABASES, skipping
# the one already created by the official postgres image (POSTGRES_DB).
set -e

if [ -z "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  exit 0
fi

IFS=',' read -ra dbs <<< "$POSTGRES_MULTIPLE_DATABASES"
for db in "${dbs[@]}"; do
  db="$(echo -n "$db" | xargs)"
  if [ "$db" = "$POSTGRES_DB" ] || [ -z "$db" ]; then
    continue
  fi
  echo "Creating database: $db"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<-EOSQL
    CREATE DATABASE "$db";
    GRANT ALL PRIVILEGES ON DATABASE "$db" TO "$POSTGRES_USER";
EOSQL
done
