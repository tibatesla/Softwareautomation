#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/azureuser/backups/postgres"
RETENTION_DAYS=14
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
FILENAME="chestone_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec chestone_postgres_db pg_dump -U chestone chestone | gzip > "${BACKUP_DIR}/${FILENAME}"

# Prune backups older than the retention window.
find "$BACKUP_DIR" -name "chestone_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) backup complete: ${FILENAME} (${SIZE})" >> "${BACKUP_DIR}/backup.log"
