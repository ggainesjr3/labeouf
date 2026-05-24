#!/bin/sh
set -e

export SERVER_NAME="${SERVER_NAME:-_}"
export BACKEND_URL="${BACKEND_URL:-http://backend:3001}"

envsubst '${SERVER_NAME} ${BACKEND_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
