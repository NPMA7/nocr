#!/usr/bin/env bash
# ==============================================================================
# Auto Backup PostgreSQL Database untuk NOCR & Sync ke Google Drive
# ==============================================================================

set -euo pipefail

ENV_FILE="/var/www/nocr/.env"
CONTAINER_NAME="nocr_postgres"
DEFAULT_DB_NAME="nocr"
DEFAULT_DB_USER="postgres"
BASE_BACKUP_DIR="/backups/nocr"
RETENTION_DAYS=30
LOG_FILE="/var/log/nocr-db-backup.log"
RCLONE_REMOTE="gdrive"

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

log "========================================================"
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
    log "SUCCESS: Backup lokal berhasil disimpan di: $BACKUP_FILE ($FILE_SIZE)"
else
    log "ERROR: Terjadi kegagalan saat menjalankan pg_dump."
    rm -f "$BACKUP_FILE"
    exit 1
fi

# Upload ke Google Drive via rclone jika remote dikonfigurasi
if command -v rclone &> /dev/null; then
    if rclone listremotes 2>/dev/null | grep -Eq "^${RCLONE_REMOTE}:"; then
        log "Uploading backup to Google Drive (${RCLONE_REMOTE}:${DATE_FOLDER})..."
        if rclone copy "$BACKUP_FILE" "${RCLONE_REMOTE}:${DATE_FOLDER}/" --retries 3 --low-level-retries 10 2>> "$LOG_FILE"; then
            log "SUCCESS: Backup berhasil di-upload ke Google Drive (${RCLONE_REMOTE}:${DATE_FOLDER}/nocr_backup_${TIMESTAMP}.sql.gz)"
            
            # Bersihkan file Google Drive lama (> RETENTION_DAYS hari)
            log "Membersihkan backup Google Drive yang lebih lama dari $RETENTION_DAYS hari..."
            rclone delete "${RCLONE_REMOTE}:" --min-age "${RETENTION_DAYS}d" --rmdirs 2>> "$LOG_FILE" || true
        else
            log "WARNING: Gagal mengunggah backup ke Google Drive. Cek konfigurasi rclone dan log."
        fi
    else
        log "INFO: Remote Google Drive '${RCLONE_REMOTE}:' belum terkonfigurasi di rclone. Lewati upload GDrive."
    fi
else
    log "INFO: rclone tidak ditemukan. Lewati upload GDrive."
fi

# Hapus backup lokal lama lebih dari $RETENTION_DAYS hari jika ada
log "Membersihkan backup lokal yang lebih lama dari $RETENTION_DAYS hari..."
find "$BASE_BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -mtime +"$RETENTION_DAYS" -exec rm -rf {} + 2>/dev/null || true

log "Backup process completed."
log "========================================================"
