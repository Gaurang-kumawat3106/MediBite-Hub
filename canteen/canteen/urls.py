from django.contrib import admin
from django.contrib.auth import views as auth_views
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

    path('password-reset/', auth_views.PasswordResetView.as_view(
        template_name='accounts/password_reset_form.html',
        email_template_name='accounts/email/password_reset_email.html',
        subject_template_name='accounts/email/password_reset_subject.txt',
        success_url='/password-reset/done/'
    ), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='accounts/password_reset_done.html'
    ), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='accounts/password_reset_confirm.html',
        success_url='/reset/done/'
    ), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='accounts/password_reset_complete.html'
    ), name='password_reset_complete'),

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