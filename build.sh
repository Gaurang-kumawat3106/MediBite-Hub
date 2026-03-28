#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

if [ -d "canteen" ]; then
  cd canteen
fi

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py createsuperuser --no-input || true

# Create default site
python manage.py shell << 'PYEOF'
from django.contrib.sites.models import Site
Site.objects.update_or_create(
    id=1,
    defaults={
        'domain': 'medibite-hub.onrender.com',
        'name': 'MediBite Hub'
    }
)
print("Site created/updated successfully")
PYEOF