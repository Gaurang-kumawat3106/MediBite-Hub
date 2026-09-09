from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.contrib.sessions.backends.db import SessionStore


@database_sync_to_async
def get_user_from_session_key(session_key: str):
    if not session_key:
        return AnonymousUser()
    try:
        session = SessionStore(session_key=session_key)
        if session.exists(session_key):
            user_id = session.get('_auth_user_id')
            if user_id:
                UserModel = get_user_model()
                user = UserModel.objects.filter(pk=user_id, is_active=True).first()
                if user:
                    return user
    except Exception:
        pass
    return AnonymousUser()


class QuerySessionAuthMiddleware:
    """
    ASGI Middleware that authenticates WebSocket connections using a 'session_key' 
    passed in the URL query string (e.g., ws://.../ws/orders/?session_key=<key>).
    This enables seamless WebSocket authentication when frontend and backend run on different domains.
    """
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        user = scope.get("user")
        if not user or user.is_anonymous:
            query_string = scope.get("query_string", b"").decode("utf-8")
            params = parse_qs(query_string)
            session_key = None
            if "session_key" in params and params["session_key"]:
                session_key = params["session_key"][0]
            elif "sessionid" in params and params["sessionid"]:
                session_key = params["sessionid"][0]
            elif "token" in params and params["token"]:
                session_key = params["token"][0]

            if session_key:
                authenticated_user = await get_user_from_session_key(session_key)
                if authenticated_user and not authenticated_user.is_anonymous:
                    scope["user"] = authenticated_user

        return await self.inner(scope, receive, send)
