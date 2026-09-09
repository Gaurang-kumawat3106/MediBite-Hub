import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from accounts.ws_auth import QuerySessionAuthMiddleware

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'canteen.settings')

import accounts.routing

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": QuerySessionAuthMiddleware(
        AuthMiddlewareStack(
            URLRouter(
                accounts.routing.websocket_urlpatterns
            )
        )
    ),
})