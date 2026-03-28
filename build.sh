#!/usr/bin/env bash
# exit on error
set -o errexit

# Install dependencies
pip install -r requirements.txt

# Migrate database
# Check if we are in the canteen directory, if not cd into it
if [ -d "canteen" ]; then
  cd canteen
fi

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py createsuperuser --no-input || true
