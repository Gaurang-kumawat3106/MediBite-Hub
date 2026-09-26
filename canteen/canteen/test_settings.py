# Test-only settings: forces SQLite so tests never touch the Neon production DB.
# Usage: python manage.py test --settings=canteen.test_settings ...
from canteen.settings import *  # noqa: F401, F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Disable SSL redirect for tests
SECURE_SSL_REDIRECT = False

# Silence Channels during tests (no Redis needed)
CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels.layers.InMemoryChannelLayer',
    }
}

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]
