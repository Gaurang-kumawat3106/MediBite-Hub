#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

if [ -d "canteen" ]; then
  cd canteen
fi

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py createsuperuser --no-input || true

# Create default site more robustly
python manage.py shell << 'PYEOF'
import os
from django.contrib.sites.models import Site
from django.db import IntegrityError

domain = os.getenv('RENDER_EXTERNAL_HOSTNAME', 'medibite-hub.onrender.com')
name = 'MediBite Hub'

try:
    # Use the same SITE_ID as settings.py
    site_id = int(os.getenv('SITE_ID', 1))
    site, created = Site.objects.get_or_create(
        pk=site_id,
        defaults={'domain': domain, 'name': name}
    )
    if not created:
        site.domain = domain
        site.name = name
        site.save()
    print(f"Site ensured: ID={site.id}, Domain={site.domain}")
except Exception as e:
    print(f"Error ensuring site {site_id}: {e}")
    # Fallback to ensure *at least one* site exists
    site = Site.objects.first()
    if not site:
        site = Site.objects.create(domain=domain, name=name)
        print(f"Created fresh site: ID={site.id}, Domain={site.domain}")
    else:
        print(f"Site exists but ID mismatch: Found ID={site.id}, expected {site_id}")
PYEOF