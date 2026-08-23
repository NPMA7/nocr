#!/usr/bin/env bash
# ==============================================================================
# Auto Backup PostgreSQL Database untuk NOCR
# ==============================================================================

set -euo pipefail

ENV_FILE="/var/www/nocr/.env"
CONTAINER_NAME="nocr_postgres"
DEFAULT_DB_NAME="nocr"
DEFAULT_DB_USER="postgres"
BASE_BACKUP_DIR="/backups/nocr"
RETENTION_DAYS=30
LOG_FILE="/var/log/nocr-db-backup.log"

# Log helper
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

# Baca environment variable jika file .env ada
if [ -f "$ENV_FILE" ]; then
    DB_NAME=$(grep -E '^DB_NAME=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    DB_USER=$(grep -E '^DB_USER=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
fi

DB_NAME="${DB_NAME:-$DEFAULT_DB_NAME}"
DB_USER="${DB_USER:-$DEFAULT_DB_USER}"

# Format tanggal untuk folder dan file
DATE_FOLDER=$(date '+%Y-%m-%d')
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')

TARGET_DIR="${BASE_BACKUP_DIR}/${DATE_FOLDER}"
BACKUP_FILE="${TARGET_DIR}/nocr_backup_${TIMESTAMP}.sql.gz"

log "Starting database backup for '$DB_NAME' from container '$CONTAINER_NAME'..."

# Pastikan container PostgreSQL berjalan
if ! docker ps --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
    log "ERROR: Container '$CONTAINER_NAME' tidak sedang berjalan!"
    exit 1
fi

# Buat folder backup per tanggal
mkdir -p "$TARGET_DIR"

# Eksekusi pg_dump dan kompresi dengan gzip
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
    log "SUCCESS: Backup berhasil disimpan di: $BACKUP_FILE ($FILE_SIZE)"
else
    log "ERROR: Terjadi kegagalan saat menjalankan pg_dump."
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Hapus backup lama lebih dari $RETENTION_DAYS hari jika ada
log "Membersihkan backup yang lebih lama dari $RETENTION_DAYS hari..."
find "$BASE_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true

log "Backup process completed."
