from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser, Outlet
from .models import Category, Product
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
        'is_customer',
        'is_outlet_head',
        'is_staff',
        'is_active',
    )

    list_filter = ('is_customer', 'is_outlet_head', 'is_active')

    actions = [block_users, unblock_users]

    # 🔑 USER EDIT PAGE
    fieldsets = UserAdmin.fieldsets + (
        ('Role Information', {
            'fields': ('is_customer', 'is_outlet_head'),
        }),
    )

    # 🔑 USER CREATE PAGE
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Role Information', {
            'fields': ('is_customer', 'is_outlet_head'),
        }),
    )


admin.site.register(CustomUser, CustomUserAdmin)

# ---- Outlet Admin ----
@admin.register(Outlet)
class OutletAdmin(admin.ModelAdmin):
    list_display = ('name', 'manager', 'logo')


