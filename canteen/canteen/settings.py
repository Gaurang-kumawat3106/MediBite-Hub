# # import os
# # from pathlib import Path
# # import dj_database_url
# # from dotenv import load_dotenv
# # from urllib.parse import urlparse, parse_qsl

# # BASE_DIR = Path(__file__).resolve().parent.parent
# # # BASE_DIR = Path(file).resolve().parent.parent
# # # load_dotenv(BASE_DIR / '.env')
# # # ✅ Load .env
# # load_dotenv(os.path.join(BASE_DIR, '.env'))

# # SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-fallback-key')

# # DEBUG = os.getenv('DEBUG', 'False') == 'True'
# import os
# from pathlib import Path
# from dotenv import load_dotenv
# from urllib.parse import urlparse, parse_qsl

# # Initialize environment variables
# BASE_DIR = Path(__file__).resolve().parent.parent
# load_dotenv(BASE_DIR / '.env')

# SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')

# DEBUG = os.environ.get('DEBUG', 'True') == 'True'

# ALLOWED_HOSTS = ['medibite-hub.onrender.com', 'localhost', '127.0.0.1']

# # For Render's external hostname
# RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')
# if RENDER_EXTERNAL_HOSTNAME:
#     ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

# CSRF_TRUSTED_ORIGINS = ['https://*.onrender.com']

# INSTALLED_APPS = [
#     'daphne',
#     'django.contrib.admin',
#     'django.contrib.auth',
#     'django.contrib.contenttypes',
#     'django.contrib.sessions',
#     'django.contrib.messages',
#     'django.contrib.staticfiles',
#     'channels',
#     'accounts.apps.AccountsConfig',
# ]

# MIDDLEWARE = [
#     'django.middleware.security.SecurityMiddleware',
#     'whitenoise.middleware.WhiteNoiseMiddleware',
#     'django.contrib.sessions.middleware.SessionMiddleware',
#     'django.middleware.common.CommonMiddleware',
#     'django.middleware.csrf.CsrfViewMiddleware',
#     'django.contrib.auth.middleware.AuthenticationMiddleware',
#     'django.contrib.messages.middleware.MessageMiddleware',
#     'django.middleware.clickjacking.XFrameOptionsMiddleware',
# ]

# ROOT_URLCONF = 'canteen.urls'

# TEMPLATES = [
#     {
#         'BACKEND': 'django.template.backends.django.DjangoTemplates',
#         'DIRS': [os.path.join(BASE_DIR, 'templates')],
#         'APP_DIRS': True,
#         'OPTIONS': {
#             'context_processors': [
#                 'django.template.context_processors.debug',
#                 'django.template.context_processors.request',
#                 'django.contrib.auth.context_processors.auth',
#                 'django.contrib.messages.context_processors.messages',
#             ],
#         },
#     },
# ]

# WSGI_APPLICATION = 'canteen.wsgi.application'
# ASGI_APPLICATION = 'canteen.asgi.application'

# REDIS_URL = os.getenv('REDIS_URL')

# if REDIS_URL:
#     CHANNEL_LAYERS = {
#         "default": {
#             "BACKEND": "channels_redis.core.RedisChannelLayer",
#             "CONFIG": {
#                 "hosts": [os.getenv("REDIS_URL", "redis://127.0.0.1:6379")],
#             },
#         },
#     }
# else:
#     CHANNEL_LAYERS = {
#         "default": {
#             "BACKEND": "channels.layers.InMemoryChannelLayer",
#         },
#     }

# # ✅ Using an even safer, stripped way to parse DATABASE_URL
# DATABASE_URL = os.getenv("DATABASE_URL", "").strip().strip("'").strip('"')

# # DATABASE_URL:
# # DATABASES = {
# #     'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600)
# # }
# database_url = os.environ.get("DATABASE_URL")
# tmpPostgres = urlparse(database_url)
# # tmpPostgres = urlparse(os.getenv("DATABASE_URL"))
# DATABASES = {
#     'default': {
#         'ENGINE': 'django.db.backends.postgresql',
#         # 'NAME': str(tmpPostgres.path).replace('/', ''),
#         'NAME': tmpPostgres.path.replace('/', ''),
#         # 'NAME': tmpPostgres.path.decode('utf-8').replace('/', ''),
#         'USER': tmpPostgres.username,
#         'PASSWORD': tmpPostgres.password,
#         'HOST': tmpPostgres.hostname,
#         'PORT': 5432,
#         'OPTIONS': dict(parse_qsl(tmpPostgres.query)),
#     }
# }

#     # DATABASES = {
#     #     'default': {
#     #         'ENGINE': 'django.db.backends.sqlite3',
#     #         'NAME': BASE_DIR / 'db.sqlite3',
#     #     }
#     # }

# AUTH_PASSWORD_VALIDATORS = [
#     {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
#     {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
#     {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
#     {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
# ]

# LANGUAGE_CODE = 'en-us'
# TIME_ZONE = 'UTC'
# USE_I18N = True
# USE_TZ = True

# STATIC_URL = '/static/'
# STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]
# STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

# STORAGES = {
#     "default": {
#         "BACKEND": "django.core.files.storage.FileSystemStorage",
#     },
#     "staticfiles": {
#         "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
#     },
# }

# MEDIA_URL = '/media/'
# MEDIA_ROOT = BASE_DIR / 'media'

# DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# AUTH_USER_MODEL = 'accounts.CustomUser'

# AUTHENTICATION_BACKENDS = (
#     'django.contrib.auth.backends.ModelBackend',
# )

# LOGIN_URL = "/accounts/login/"
# LOGIN_REDIRECT_URL = "/app/welcome/"
# LOGOUT_REDIRECT_URL = "/"

# if os.getenv('RENDER'):
#     EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
# else:
#     EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

# EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
# EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
# EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
# EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
# EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
# DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')




import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url  # ✅ Added this back

# Initialize environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ.get('SECRET_KEY', 'your-secret-key-here')

DEBUG = os.environ.get('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = ['medibite-hub.onrender.com', 'localhost', '127.0.0.1']

# For Render's external hostname
RENDER_EXTERNAL_HOSTNAME = os.getenv('RENDER_EXTERNAL_HOSTNAME')
if RENDER_EXTERNAL_HOSTNAME:
    ALLOWED_HOSTS.append(RENDER_EXTERNAL_HOSTNAME)

CSRF_TRUSTED_ORIGINS = ['https://*.onrender.com']

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'channels',
    'accounts.apps.AccountsConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'canteen.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [os.path.join(BASE_DIR, 'templates')],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'canteen.wsgi.application'
ASGI_APPLICATION = 'canteen.asgi.application'

REDIS_URL = os.getenv('REDIS_URL')

if REDIS_URL:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {
                "hosts": [os.getenv("REDIS_URL", "redis://127.0.0.1:6379")],
            },
        },
    }
else:
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels.layers.InMemoryChannelLayer",
        },
    }

# ==========================================
# ✅ DATABASE CONFIGURATION FIX
# ==========================================

# Database Configuration (Fixed to match working structure)
database_url = os.environ.get("DATABASE_URL")

if database_url:
    # Adding their original strip() logic here just to be safe with hidden quotes
    clean_url = database_url.strip().strip("'").strip('"')

    try:
        tmpPostgres = urlparse(clean_url)

# Safety check: if path comes back as bytes, decode it to string
        db_name = tmpPostgres.path
        if isinstance(db_name, bytes):
            db_name = db_name.decode('utf-8')

        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': db_name.replace('/', ''),
                'USER': tmpPostgres.username,
                'PASSWORD': tmpPostgres.password,
                'HOST': tmpPostgres.hostname,
                'PORT': 5432,
                'OPTIONS': dict(parse_qsl(tmpPostgres.query)),
            }
        }
    except Exception as e:
        print(f"Error parsing DATABASE_URL, falling back to SQLite: {e}")
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
else:
    # Fallback to SQLite for local development if no DATABASE_URL
    print("PDBDM")
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# 1. Safely grab the URL and strip any accidental quotes from the .env file
# raw_db_url = os.environ.get("DATABASE_URL", "").strip().strip("'").strip('"')

# if raw_db_url:
#     # 2. If a URL is found, let dj_database_url handle all the complex parsing securely
#     print("doe")
#     DATABASES = {
#         'default': dj_database_url.parse(
#             raw_db_url,
#             conn_max_age=600,
#             conn_health_checks=True,
#         )
#     }
# else:
#     # 3. Safe fallback for local development if the .env isn't loaded properly
#     print("pdbdm")
#     DATABASES = {
#         'default': {
#             'ENGINE': 'django.db.backends.sqlite3',
#             'NAME': BASE_DIR / 'db.sqlite3',
#         }
#     }

# # ==========================================

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, 'static')]
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.CustomUser'

AUTHENTICATION_BACKENDS = (
    'django.contrib.auth.backends.ModelBackend',
)

LOGIN_URL = "/accounts/login/"
LOGIN_REDIRECT_URL = "/app/welcome/"
LOGOUT_REDIRECT_URL = "/"

if os.getenv('RENDER'):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'

EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL')