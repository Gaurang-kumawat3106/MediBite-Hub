from django.contrib import admin
from django.urls import include, path
from accounts import views as accounts_views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    # OAuth / social login routes (Google)
    path('accounts/', include('allauth.urls')),

    # Application routes
    path('app/', include('accounts.urls')),
    path('', accounts_views.login_view, name='login'),
]

# ✅ STATIC + MEDIA dono serve karo
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)