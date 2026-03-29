#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

if [ -d "canteen" ]; then
  cd canteen
fi

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py createsuperuser --no-input || true

# Django site creation removed because django.contrib.sites is no longer installed.