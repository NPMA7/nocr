#!/usr/bin/env bash
# ==============================================================================
# Script untuk Sync seluruh folder backup lokal ke Google Drive
# ==============================================================================

set -euo pipefail

BASE_BACKUP_DIR="/backups/nocr"
RCLONE_REMOTE="gdrive"
LOG_FILE="/var/log/nocr-db-backup.log"

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE"
}

if ! command -v rclone &> /dev/null; then
    echo "ERROR: rclone belum terinstall."
    exit 1
fi

if ! rclone listremotes 2>/dev/null | grep -Eq "^${RCLONE_REMOTE}:"; then
    echo "ERROR: Remote '${RCLONE_REMOTE}:' belum terkonfigurasi di rclone."
    echo "Silakan hubungkan Google Drive terlebih dahulu."
    exit 1
fi

log "Menyinkronkan seluruh folder backup lokal ($BASE_BACKUP_DIR) ke Google Drive (${RCLONE_REMOTE}:)..."
rclone copy "$BASE_BACKUP_DIR" "${RCLONE_REMOTE}:" --progress --retries 3

log "SUCCESS: Sinkronisasi seluruh backup ke Google Drive selesai."
