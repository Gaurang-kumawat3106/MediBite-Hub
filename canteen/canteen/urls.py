
from django.contrib import admin
from django.urls import include, path
from accounts import views as accounts_views
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    # path('', accounts_views.index, name='index'),
    path('', accounts_views.login_view, name='login'),


]+ static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
