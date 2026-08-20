from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.urls import include, path, re_path
from accounts import views as accounts_views
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.contrib.sitemaps.views import sitemap
from accounts.sitemaps import StaticViewSitemap, OutletSitemap


sitemaps = {
    "static": StaticViewSitemap,
    "outlets": OutletSitemap,
}

urlpatterns = [
    path('admin/', admin.site.urls),

    # Application routes
    path('app/', include('accounts.urls')),
    path('health/', accounts_views.health_check, name='health_root'),

    path('password-reset/', accounts_views.password_reset_request, name='password_reset_root'),
    path('password-reset/select/', accounts_views.password_reset_select, name='password_reset_select_root'),
    path('password-reset-confirm/<uidb64>/<token>/', accounts_views.password_reset_confirm, name='password_reset_confirm_root'),
    path('reset/<uidb64>/<token>/', accounts_views.password_reset_confirm, name='password_reset_confirm_alias'),

    path('', accounts_views.login_view, name='login'),
    path(
        "sitemap.xml",
        sitemap,
        {"sitemaps": sitemaps},
        name="django.contrib.sitemaps.views.sitemap",
    ),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)