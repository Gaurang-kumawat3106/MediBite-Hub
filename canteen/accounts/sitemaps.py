from django.contrib.sitemaps import Sitemap
from django.urls import reverse

from .models import Outlet, Product


class StaticViewSitemap(Sitemap):
    priority = 0.8
    changefreq = "weekly"

    def items(self):
        return [
            "customer_home",
        ]

    def location(self, item):
        return reverse(item)


class OutletSitemap(Sitemap):
    changefreq = "weekly"
    priority = 0.8

    def items(self):
        return Outlet.objects.filter(is_approved=True)

    def location(self, obj):
        return reverse("outlet_detail", args=[obj.id])