from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count, Q, Sum
from .models import CustomUser, Outlet
from .models import Category, Product, Order
from decimal import Decimal

# ---- Block / Unblock Actions ----
@admin.action(description="Block selected users")
def block_users(modeladmin, request, queryset):
    queryset.update(is_active=False)

@admin.action(description="Unblock selected users")
def unblock_users(modeladmin, request, queryset):
    queryset.update(is_active=True)

# ---- CustomUser Admin ----

class CustomUserAdmin(UserAdmin):
    model = CustomUser

    list_display = (
        'username',
        'email',
        'is_email_verified',
        'is_customer',
        'is_outlet_head',
        'is_staff',
        'is_active',
    )

    list_filter = ('is_customer', 'is_outlet_head', 'is_email_verified', 'is_active')

    actions = [block_users, unblock_users]

    # 🔑 USER EDIT PAGE
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {
            'fields': ('is_customer', 'is_outlet_head', 'is_email_verified'),
        }),
    )

    # 🔑 USER CREATE PAGE
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role Information', {
            'fields': ('is_customer', 'is_outlet_head', 'is_email_verified'),
        }),
    )


admin.site.register(CustomUser, CustomUserAdmin)

# ---- Outlet Admin ----
@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ('name', 'manager', 'is_approved', 'logo')
    list_filter = ('is_approved',)
    actions = ('approve_outlets', 'unapprove_outlets')

    @admin.action(description="Approve selected outlets")
    def approve_outlets(self, request, queryset):
        queryset.update(is_approved=True)

    @admin.action(description="Unapprove selected outlets")
    def unapprove_outlets(self, request, queryset):
        queryset.update(is_approved=False)

# ---- Order Admin ----
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'outlet', 'total_amount', 'payment_status','status', 'created_at')
    list_filter = ('outlet', 'status', 'created_at')
    change_list_template = 'admin/order_changelist.html'

    def changelist_view(self, request, extra_context=None):
        from django.utils import timezone
        from datetime import timedelta

        extra_context = extra_context or {}
        now = timezone.now()
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        valid_orders = Order.objects.exclude(status='cancelled')

        week_orders = valid_orders.filter(created_at__gte=week_start)
        month_orders = valid_orders.filter(created_at__gte=month_start)

        def coalesce_decimal(val):
            # Helps keep template rendering clean when SUM(filter=...) returns None
            return val if val is not None else Decimal("0.00")

        def get_global_bucket_stats(orders_qs):
            return orders_qs.aggregate(
                total_orders=Count("id"),
                total_sales=Sum("total_amount"),
                under_100_orders=Count("id", filter=Q(total_amount__lt=100)),
                under_100_sales=Sum("total_amount", filter=Q(total_amount__lt=100)),
                under_200_orders=Count(
                    "id", filter=Q(total_amount__gte=100, total_amount__lt=200)
                ),
                under_200_sales=Sum(
                    "total_amount",
                    filter=Q(total_amount__gte=100, total_amount__lt=200),
                ),
                under_500_orders=Count(
                    "id", filter=Q(total_amount__gte=200, total_amount__lt=500)
                ),
                under_500_sales=Sum(
                    "total_amount",
                    filter=Q(total_amount__gte=200, total_amount__lt=500),
                ),
                above_500_orders=Count("id", filter=Q(total_amount__gte=500)),
                above_500_sales=Sum("total_amount", filter=Q(total_amount__gte=500)),
            )

        def get_outlet_head_bucket_stats(orders_qs):
            # One outlet head = one outlet (via Outlet.manager OneToOneField), but we still
            # group by outlet manager from Order -> outlet -> manager to keep it consistent.
            outlet_heads = list(
                CustomUser.objects.filter(is_outlet_head=True).select_related("outlet").order_by(
                    "username"
                )
            )

            bucket_agg_rows = list(
                orders_qs.values(
                    "outlet__manager_id",
                    "outlet__manager__username",
                    "outlet__name",
                ).annotate(
                    total_orders=Count("id"),
                    total_sales=Sum("total_amount"),
                    under_100_orders=Count("id", filter=Q(total_amount__lt=100)),
                    under_100_sales=Sum("total_amount", filter=Q(total_amount__lt=100)),
                    under_200_orders=Count(
                        "id", filter=Q(total_amount__gte=100, total_amount__lt=200)
                    ),
                    under_200_sales=Sum(
                        "total_amount",
                        filter=Q(total_amount__gte=100, total_amount__lt=200),
                    ),
                    under_500_orders=Count(
                        "id", filter=Q(total_amount__gte=200, total_amount__lt=500)
                    ),
                    under_500_sales=Sum(
                        "total_amount",
                        filter=Q(total_amount__gte=200, total_amount__lt=500),
                    ),
                    above_500_orders=Count("id", filter=Q(total_amount__gte=500)),
                    above_500_sales=Sum(
                        "total_amount",
                        filter=Q(total_amount__gte=500),
                    ),
                )
            )

            row_by_manager_id = {
                row["outlet__manager_id"]: row
                for row in bucket_agg_rows
                if row.get("outlet__manager_id") is not None
            }

            result = []
            for head in outlet_heads:
                row = row_by_manager_id.get(head.id, {})

                result.append(
                    {
                        "head_id": head.id,
                        "head_username": head.username,
                        "outlet_name": getattr(getattr(head, "outlet", None), "name", ""),
                        "total_orders": row.get("total_orders") or 0,
                        "total_sales": coalesce_decimal(row.get("total_sales")),
                        "under_100_orders": row.get("under_100_orders") or 0,
                        "under_100_sales": coalesce_decimal(row.get("under_100_sales")),
                        "under_200_orders": row.get("under_200_orders") or 0,
                        "under_200_sales": coalesce_decimal(row.get("under_200_sales")),
                        "under_500_orders": row.get("under_500_orders") or 0,
                        "under_500_sales": coalesce_decimal(row.get("under_500_sales")),
                        "above_500_orders": row.get("above_500_orders") or 0,
                        "above_500_sales": coalesce_decimal(row.get("above_500_sales")),
                    }
                )
            return result

        global_week = get_global_bucket_stats(week_orders)
        global_month = get_global_bucket_stats(month_orders)

        # Ensure decimals are never None for template rendering
        for d in (global_week, global_month):
            d["total_sales"] = coalesce_decimal(d.get("total_sales"))
            d["under_100_sales"] = coalesce_decimal(d.get("under_100_sales"))
            d["under_200_sales"] = coalesce_decimal(d.get("under_200_sales"))
            d["under_500_sales"] = coalesce_decimal(d.get("under_500_sales"))
            d["above_500_sales"] = coalesce_decimal(d.get("above_500_sales"))

        extra_context["stats"] = {"week": global_week, "month": global_month}
        extra_context["outlet_head_stats_week"] = get_outlet_head_bucket_stats(week_orders)
        extra_context["outlet_head_stats_month"] = get_outlet_head_bucket_stats(month_orders)

        return super().changelist_view(request, extra_context=extra_context)
