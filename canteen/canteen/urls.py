from django.contrib import admin
from django.urls import include, path
from accounts import views as accounts_views
from django.conf import settings
from django.conf.urls.static import static
from django.contrib.sitemaps.views import sitemap
from accounts.sitemaps import StaticViewSitemap, OutletSitemap


sitemaps = {
    "static": StaticViewSitemap,
    "outlets": OutletSitemap,
}

urlpatterns = [
    path('admin/', admin.site.urls),
    # OAuth / social login routes removed

    # Application routes
    path('app/', include('accounts.urls')),
    path('', accounts_views.login_view, name='login'),
    path(
    "sitemap.xml",
    sitemap,
    {"sitemaps": sitemaps},
    name="django.contrib.sitemaps.views.sitemap",
),
]

# ✅ STATIC + MEDIA dono serve karo
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)