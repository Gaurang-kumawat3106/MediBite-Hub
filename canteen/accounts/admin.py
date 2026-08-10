from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.db.models import Count, Q, Sum
from .models import CustomUser, Outlet, VerifiedCustomer, PendingVerificationUser
from .models import Category, Product, Order, PlatformFeeConfig, PlatformFeeSlab
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

class VerifiedCustomerAdmin(CustomUserAdmin):
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(is_customer=True, is_active=True, is_email_verified=True)

class PendingVerificationUserAdmin(CustomUserAdmin):
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.filter(is_active=False)

admin.site.register(VerifiedCustomer, VerifiedCustomerAdmin)
admin.site.register(PendingVerificationUser, PendingVerificationUserAdmin)
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

@admin.register(PlatformFeeConfig)
class PlatformFeeConfigAdmin(admin.ModelAdmin):
    list_display = ('fee_amount', 'updated_at')


@admin.register(PlatformFeeSlab)
class PlatformFeeSlabAdmin(admin.ModelAdmin):
    list_display = ('min_price', 'max_price', 'fee_amount', 'updated_at')
    list_editable = ('fee_amount',)
    ordering = ('min_price',)

# ---- Order Admin ----
@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'outlet', 'total_amount', 'actual_amount', 'platform_fee', 'payment_status','status', 'cancelled_by', 'created_at')
    list_filter = ('outlet', 'status', 'created_at')
    change_list_template = 'admin/order_changelist.html'

    def changelist_view(self, request, extra_context=None):
        from django.utils import timezone
        from datetime import timedelta

        extra_context = extra_context or {}
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        valid_orders = Order.objects.filter(
            payment_status__in=['paid', 'SUCCESS', 'PAID']
        ).exclude(status='cancelled')

        today_orders = valid_orders.filter(created_at__gte=today_start)
        week_orders = valid_orders.filter(created_at__gte=week_start)
        month_orders = valid_orders.filter(created_at__gte=month_start)

        def coalesce_decimal(val):
            return val if val is not None else Decimal("0.00")

        def get_global_stats(orders_qs):
            return orders_qs.aggregate(
                total_orders=Count("id"),
                total_platform_fee=Sum("platform_fee"),
                total_sales=Sum("total_amount")
            )

        def get_outlet_stats(orders_qs):
            outlet_heads = list(
                CustomUser.objects.filter(is_outlet_head=True).select_related("outlet").order_by(
                    "username"
                )
            )

            bucket_agg_rows = list(
                orders_qs.values(
                    "outlet__manager_id",
                    "outlet__name",
                ).annotate(
                    total_orders=Count("id"),
                    total_actual_amount=Sum("actual_amount"),
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
                        "outlet_name": getattr(getattr(head, "outlet", None), "name", "No Outlet"),
                        "total_orders": row.get("total_orders") or 0,
                        "total_actual_amount": coalesce_decimal(row.get("total_actual_amount")),
                    }
                )
            return result

        global_today = get_global_stats(today_orders)
        global_week = get_global_stats(week_orders)
        global_month = get_global_stats(month_orders)

        for d in (global_today, global_week, global_month):
            d["total_platform_fee"] = coalesce_decimal(d.get("total_platform_fee"))
            d["total_sales"] = coalesce_decimal(d.get("total_sales"))

        extra_context["stats"] = {"today": global_today, "week": global_week, "month": global_month}
        
        outlet_today = {item['head_id']: item for item in get_outlet_stats(today_orders)}
        outlet_week = {item['head_id']: item for item in get_outlet_stats(week_orders)}
        outlet_month = {item['head_id']: item for item in get_outlet_stats(month_orders)}

        combined_outlet_stats = []
        outlet_heads = CustomUser.objects.filter(is_outlet_head=True).select_related("outlet").order_by("username")
        for head in outlet_heads:
            combined_outlet_stats.append({
                "outlet_name": getattr(getattr(head, "outlet", None), "name", "No Outlet"),
                "today": outlet_today.get(head.id, {}).get("total_actual_amount", Decimal("0.00")),
                "week": outlet_week.get(head.id, {}).get("total_actual_amount", Decimal("0.00")),
                "month": outlet_month.get(head.id, {}).get("total_actual_amount", Decimal("0.00")),
            })

        extra_context["combined_outlet_stats"] = combined_outlet_stats

        return super().changelist_view(request, extra_context=extra_context)
