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
from django.apps import apps

domain = os.getenv('RENDER_EXTERNAL_HOSTNAME', 'medibite-hub.onrender.com')
name = 'MediBite Hub'

try:
    site_id = int(os.getenv('SITE_ID', 1))
    
    # Prefix old sites to avoid unique constraint on domain
    for old_site in Site.objects.exclude(id=site_id):
        if old_site.domain == domain:
            old_site.domain = f"old-{old_site.id}-{domain}"
            old_site.save()

    # Create or update the correct site
    site, created = Site.objects.get_or_create(
        id=site_id,
        defaults={'domain': domain, 'name': name}
    )
    if not created:
        site.domain = domain
        site.name = name
        site.save()
        
    print(f"Site ensured: ID={site.id}, Domain={site.domain}")

    # Ensure all Google SocialApps are linked to this site
    if apps.is_installed('allauth.socialaccount'):
        from allauth.socialaccount.models import SocialApp
        for app in SocialApp.objects.all():
            app.sites.add(site)
            print(f"Linked SocialApp '{app.name}' to Site ID={site.id}")

except Exception as e:
    print(f"Error ensuring site {os.getenv('SITE_ID', 1)}: {e}")
PYEOF