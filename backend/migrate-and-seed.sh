#!/bin/sh
# Container `migrate` do docker-compose: schema sempre em dia; seed so quando ainda nao ha destinos.
set -e
uv run --no-sync manage.py migrate --noinput
if uv run --no-sync manage.py shell -c "import sys; from apps.destinations.models import Destination; sys.exit(0 if Destination.objects.exists() else 1)"; then
  echo "Seed ja carregado."
else
  uv run --no-sync manage.py loaddata seed_data.json
fi
