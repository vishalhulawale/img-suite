#!/bin/bash
# init-letsencrypt.sh
# Bootstrap Let's Encrypt SSL certificates for the first time.
# This script is idempotent — it skips if certs already exist.
#
# Usage: BACKEND_IMAGE=... FRONTEND_IMAGE=... ./init-letsencrypt.sh

set -e

DOMAIN="smartpdfsuite.com"
EMAIL="${CERTBOT_EMAIL:-admin@smartpdfsuite.com}"
COMPOSE_CMD="BACKEND_IMAGE=${BACKEND_IMAGE} FRONTEND_IMAGE=${FRONTEND_IMAGE} docker compose"

# Check if certificates already exist
if docker volume inspect pdf-suite_certbot_conf &>/dev/null; then
  CERT_EXISTS=$(docker run --rm -v pdf-suite_certbot_conf:/etc/letsencrypt alpine sh -c \
    "test -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem && echo yes || echo no")
  if [ "$CERT_EXISTS" = "yes" ]; then
    echo "✅ SSL certificates already exist for ${DOMAIN}. Skipping initialization."
    exit 0
  fi
fi

echo "=== Initializing Let's Encrypt for ${DOMAIN} ==="

# Step 1: Create a self-signed placeholder so nginx can start
echo "→ Creating placeholder self-signed certificate..."
docker run --rm \
  -v pdf-suite_certbot_conf:/etc/letsencrypt \
  alpine sh -c "
    mkdir -p /etc/letsencrypt/live/${DOMAIN} &&
    apk add --no-cache openssl &&
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
      -keyout /etc/letsencrypt/live/${DOMAIN}/privkey.pem \
      -out /etc/letsencrypt/live/${DOMAIN}/fullchain.pem \
      -subj '/CN=${DOMAIN}'
  "

# Step 2: Start nginx (it needs the placeholder cert to boot)
echo "→ Starting frontend (nginx)..."
eval "${COMPOSE_CMD} up -d frontend"

# Wait for nginx to be ready
sleep 5

# Step 3: Remove placeholder cert
echo "→ Removing placeholder certificate..."
docker run --rm \
  -v pdf-suite_certbot_conf:/etc/letsencrypt \
  alpine sh -c "rm -rf /etc/letsencrypt/live/${DOMAIN} /etc/letsencrypt/archive/${DOMAIN} /etc/letsencrypt/renewal/${DOMAIN}.conf"

# Step 4: Request real certificate from Let's Encrypt
echo "→ Requesting certificate from Let's Encrypt..."
docker run --rm \
  -v pdf-suite_certbot_conf:/etc/letsencrypt \
  -v pdf-suite_certbot_www:/var/www/certbot \
  certbot/certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "${DOMAIN}" \
    -d "www.${DOMAIN}" \
    --email "${EMAIL}" \
    --agree-tos \
    --no-eff-email \
    --non-interactive \
    --force-renewal

# Step 5: Reload nginx to pick up the real cert
echo "→ Reloading nginx with real certificate..."
docker exec pdf-suite-frontend nginx -s reload

echo "✅ SSL certificates successfully obtained for ${DOMAIN}!"
