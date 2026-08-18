from django.contrib.auth import get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.utils.deprecation import MiddlewareMixin

UserModel = get_user_model()

class HeaderSessionMiddleware(MiddlewareMixin):
    """
    Middleware that enables session authentication via header ('X-Session-Key' or 'Authorization: Bearer <key>').
    This bypasses cross-site 3rd-party cookie blocking on Mobile browsers (iOS Safari, Mobile Chrome) 
    when Frontend (Vercel) and Backend (Render) are on different domains.
    """
    def process_request(self, request):
        # If user is already authenticated via cookies, no action needed
        if getattr(request, 'user', None) and request.user.is_authenticated:
            return

        session_key = None

        # Check X-Session-Key header
        header_key = request.headers.get('X-Session-Key')
        if header_key and header_key.strip():
            session_key = header_key.strip()
        else:
            # Check Authorization header (Bearer <session_key> or Session <session_key>)
            auth_header = request.headers.get('Authorization', '')
            if auth_header:
                parts = auth_header.split()
                if len(parts) == 2 and parts[0].lower() in ('bearer', 'session', 'token'):
                    session_key = parts[1].strip()

        if not session_key:
            return

        try:
            session = SessionStore(session_key=session_key)
            if session.exists(session_key):
                user_id = session.get('_auth_user_id')
                if user_id:
                    user = UserModel.objects.filter(pk=user_id, is_active=True).first()
                    if user:
                        request.user = user
                        request.session = session
        except Exception:
            # Fallback gracefully if session loading fails
            pass
