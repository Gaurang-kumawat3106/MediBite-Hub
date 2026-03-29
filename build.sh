#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt

if [ -d "canteen" ]; then
  cd canteen
fi

python manage.py collectstatic --no-input
python manage.py migrate
python manage.py createsuperuser --no-input || true

# Automatically create/update the 'boss' superuser
python manage.py shell << 'PYEOF'
from django.contrib.auth import get_user_model

User = get_user_model()
try:
    user, created = User.objects.get_or_create(username='boss')
    user.email = 'gaurangkumawat026@gmail.com'
    user.set_password('developin2026')
    user.is_staff = True
    user.is_superuser = True
    user.save()
    if created:
        print("Superuser 'boss' created successfully.")
    else:
        print("Superuser 'boss' updated successfully.")
except Exception as e:
    print(f"Failed to configure superuser 'boss': {e}")
PYEOF