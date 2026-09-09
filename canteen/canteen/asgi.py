import os
from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'canteen.settings')

# Initialize Django ASGI application early to ensure AppRegistry is populated before importing models/auth
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from accounts.ws_auth import QuerySessionAuthMiddleware
import accounts.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": QuerySessionAuthMiddleware(
        AuthMiddlewareStack(
            URLRouter(
                accounts.routing.websocket_urlpatterns
            )
        )
    ),
})