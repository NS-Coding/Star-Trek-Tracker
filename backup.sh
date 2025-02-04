#!/bin/bash

# Define variables
CONTAINER_NAME="your_project_db_1"   # Change to your actual db container name or use docker-compose's naming convention.
DB_USER="postgres"
DB_NAME="startrekdb"
BACKUP_DIR="./backups"

# Ensure backup directory exists
mkdir -p $BACKUP_DIR

# Create backup file with current timestamp
BACKUP_FILE="$BACKUP_DIR/backup_$(date +"%Y%m%d_%H%M%S").sql"

# Run pg_dump from the PostgreSQL container
docker exec -t $CONTAINER_NAME pg_dump -U $DB_USER $DB_NAME > $BACKUP_FILE

echo "Backup saved to $BACKUP_FILE"
