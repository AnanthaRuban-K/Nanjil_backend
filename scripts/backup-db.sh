#!/usr/bin/env bash
#
# Database backup script for Nanjil MEP Service
#
# Usage:
#   chmod +x scripts/backup-db.sh
#   ./scripts/backup-db.sh
#
# Cron (daily at 2 AM):
#   0 2 * * * /path/to/backend/scripts/backup-db.sh >> /var/log/nanjil-backup.log 2>&1

set -euo pipefail

# ── Configuration ───────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/nanjil_mep}"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="nanjil_mep_${TIMESTAMP}.sql.gz"

# ── Create backup directory ─────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting backup..."

# ── Dump and compress ───────────────────────────────
pg_dump "$DB_URL" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_DIR}/${FILENAME}"

SIZE=$(du -h "${BACKUP_DIR}/${FILENAME}" | cut -f1)
echo "[$(date)] Backup created: ${FILENAME} (${SIZE})"

# ── Cleanup old backups ─────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "nanjil_mep_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
echo "[$(date)] Cleaned up ${DELETED} old backup(s)"

echo "[$(date)] Backup complete."

# ── Restore instructions ───────────────────────────
# gunzip -c backups/nanjil_mep_20250720_020000.sql.gz | psql "$DATABASE_URL"