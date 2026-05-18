#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

docker-compose down
docker container prune -f
docker-compose build --no-cache
docker-compose up -d

sleep 30
docker-compose logs backend | tail -20
