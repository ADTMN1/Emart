#!/usr/bin/env bash
#
# Provision the EMART local storage tree on a production host.
#
# Creates the three storage namespaces with the permissions the backend
# expects and prints the matching Nginx configuration. It is idempotent and
# only ever creates directories / adjusts ownership and modes inside the
# storage root — no file is ever read, moved or deleted.
#
# Usage:
#   sudo ./scripts/provision-storage.sh [--root /var/lib/emart/storage] [--owner emart]
#
set -euo pipefail

STORAGE_ROOT="/var/lib/emart/storage"
STORAGE_OWNER=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --root)  STORAGE_ROOT="$2"; shift 2 ;;
    --owner) STORAGE_OWNER="$2"; shift 2 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ "$(id -u)" -ne 0 ] && [ -z "$STORAGE_OWNER" ]; then
  echo "Run as root, or pass --owner <user> when the directories already exist." >&2
fi

echo "==> Storage root: ${STORAGE_ROOT}"

# Public namespaces: readable by the web server so it can serve the files.
# Private namespace: owner-only, never exposed over HTTP.
install -d -m 0755 "${STORAGE_ROOT}"
install -d -m 0755 "${STORAGE_ROOT}/products"
install -d -m 0755 "${STORAGE_ROOT}/shop-media"
install -d -m 0700 "${STORAGE_ROOT}/seller-documents"

if [ -n "$STORAGE_OWNER" ]; then
  echo "==> Setting owner to '${STORAGE_OWNER}'"
  chown -R "${STORAGE_OWNER}:${STORAGE_OWNER}" "${STORAGE_ROOT}"
  # The app user must be able to create files and nested directories.
  chmod 0755 "${STORAGE_ROOT}" "${STORAGE_ROOT}/products" "${STORAGE_ROOT}/shop-media"
  chmod 0700 "${STORAGE_ROOT}/seller-documents"
fi

echo "==> Resulting layout"
ls -ld "${STORAGE_ROOT}" "${STORAGE_ROOT}/products" "${STORAGE_ROOT}/shop-media" "${STORAGE_ROOT}/seller-documents"

if [ -n "$STORAGE_OWNER" ]; then
  echo "==> Verifying the app user can write"
  if [ "$(id -u)" -eq 0 ] && command -v runuser >/dev/null 2>&1; then
    runuser -u "${STORAGE_OWNER}" -- test -w "${STORAGE_ROOT}" \
      || { echo "FAIL: ${STORAGE_OWNER} cannot write to ${STORAGE_ROOT}" >&2; exit 1; }
    runuser -u "${STORAGE_OWNER}" -- test -w "${STORAGE_ROOT}/seller-documents" \
      || { echo "FAIL: ${STORAGE_OWNER} cannot write to the seller-documents namespace" >&2; exit 1; }
  elif [ "$(id -un)" = "${STORAGE_OWNER}" ]; then
    test -w "${STORAGE_ROOT}" \
      || { echo "FAIL: ${STORAGE_OWNER} cannot write to ${STORAGE_ROOT}" >&2; exit 1; }
    test -w "${STORAGE_ROOT}/seller-documents" \
      || { echo "FAIL: ${STORAGE_OWNER} cannot write to the seller-documents namespace" >&2; exit 1; }
  else
    echo "    (cannot switch users — skipped the write check; re-run as root to verify)"
  fi
  echo "    OK"
fi

cat <<'NGINX'

==> Matching Nginx configuration

    # Optional offload: serve the PUBLIC namespaces straight from disk and
    # proxy everything else (including the API and the document stream
    # endpoint) to the backend.
    #
    # CRITICAL: alias only the two public subtrees. Never alias
    # ${STORAGE_ROOT}/seller-documents — identity documents are private and
    # are readable only through the authenticated backend stream endpoint.
    location /uploads/products/ {
        alias ${STORAGE_ROOT}/products/;
        access_log off;
        add_header X-Content-Type-Options nosniff always;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location /uploads/shop-media/ {
        alias ${STORAGE_ROOT}/shop-media/;
        access_log off;
        add_header X-Content-Type-Options nosniff always;
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

==> Matching backend environment

    STORAGE_ROOT=${STORAGE_ROOT}
    STORAGE_PUBLIC_PATH_PREFIX=/uploads
    STORAGE_PUBLIC_BASE_URL=https://<your-public-api-host>
    STORAGE_DOCUMENT_URL_TTL=300

==> Health check

    curl -fsS http://127.0.0.1:5000/health
    ls -l ${STORAGE_ROOT}/products ${STORAGE_ROOT}/shop-media ${STORAGE_ROOT}/seller-documents
NGINX
