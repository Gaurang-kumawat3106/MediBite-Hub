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
    site, created = Site.objects.get_or_create(
        id=1,
        defaults={'domain': domain, 'name': name}
    )
    if not created:
        site.domain = domain
        site.name = name
        site.save()
    print(f"Site ensured: ID={site.id}, Domain={site.domain}")
except Exception as e:
    print(f"Error ensuring site: {e}")
    # Fallback to update any existing site if ID 1 is problematic
    site = Site.objects.first()
    if site:
        site.domain = domain
        site.name = name
        site.save()
        print(f"Updated existing site instead: ID={site.id}, Domain={site.domain}")
    else:
        site = Site.objects.create(domain=domain, name=name)
        print(f"Created new site: ID={site.id}, Domain={site.domain}")
PYEOF