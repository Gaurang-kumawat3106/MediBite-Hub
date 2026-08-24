import time
from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

# In-memory slab cache for zero-query platform fee resolution
_CACHED_SLABS = None
_CACHED_CONFIG = None
_SLABS_CACHE_TIME = 0
_SLABS_CACHE_TTL = 60  # seconds

def invalidate_platform_fee_cache():
    global _CACHED_SLABS, _CACHED_CONFIG, _SLABS_CACHE_TIME
    _CACHED_SLABS = None
    _CACHED_CONFIG = None
    _SLABS_CACHE_TIME = 0

def _get_slabs_and_config():
    global _CACHED_SLABS, _CACHED_CONFIG, _SLABS_CACHE_TIME
    now = time.time()
    if _CACHED_SLABS is None or (now - _SLABS_CACHE_TIME) > _SLABS_CACHE_TTL:
        try:
            _CACHED_SLABS = list(PlatformFeeSlab.objects.all().order_by('-min_price'))
            _CACHED_CONFIG = PlatformFeeConfig.objects.first()
            _SLABS_CACHE_TIME = now
        except Exception:
            return [], None
    return _CACHED_SLABS, _CACHED_CONFIG

def get_platform_fee_for_price(price):
    """Return platform fee for a given base product price using cached in-memory slabs."""
    try:
        price = Decimal(str(price))
        slabs, config = _get_slabs_and_config()
        for slab in slabs:
            if slab.min_price <= price and (slab.max_price is None or slab.max_price >= price):
                return slab.fee_amount
        return config.fee_amount if config else Decimal('0.00')
    except Exception:
        return Decimal('0.00')


# ---------------- USER MODEL ----------------
class CustomUser(AbstractUser):
    is_customer = models.BooleanField(default=False)
    is_outlet_head = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.username

class VerifiedCustomer(CustomUser):
    class Meta:
        proxy = True
        verbose_name = 'Verified Customer'
        verbose_name_plural = 'Verified Customers'

class PendingVerificationUser(CustomUser):
    class Meta:
        proxy = True
        verbose_name = 'Pending Verification User'
        verbose_name_plural = 'Pending Verification Users'


# ---------------- OUTLET ----------------
class Outlet(models.Model):
    name = models.CharField(max_length=50)
    logo = models.ImageField(upload_to='outlet_logos/', blank=True, null=True)
    is_approved = models.BooleanField(default=False)

    manager = models.OneToOneField(   # 🔥 ONE outlet = ONE outlet head
        CustomUser,
        on_delete=models.CASCADE,
        limit_choices_to={'is_outlet_head': True},
        related_name='outlet'
    )

    def __str__(self):
        return self.name


# ---------------- OUTLET UI ----------------
class OutletUI(models.Model):
    outlet = models.OneToOneField(
        Outlet,
        on_delete=models.CASCADE,
        related_name='ui'
    )

    banner = models.ImageField(
        upload_to='outlet_banners/',
        blank=True,
        null=True
    )
    banner2 = models.ImageField(
        upload_to='outlet_banners/',
        blank=True,
        null=True
    )
    banner3 = models.ImageField(
        upload_to='outlet_banners/',
        blank=True,
        null=True
    )

    banner_active = models.BooleanField(default=True)
    theme_color = models.CharField(max_length=30, default='#0d6efd')

    layout_type = models.CharField(
        max_length=20,
        choices=[
            ('classic', 'Classic'),
            ('modern', 'Modern'),
            ('minimal', 'Minimal')
        ],
        default='classic'
    )

    def __str__(self):
        return f"UI - {self.outlet.name}"


# ---------------- CATEGORY ----------------
class Category(models.Model):
    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.CASCADE,
        related_name='categories'
    )

    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('outlet', 'name')  # 🔥 same outlet me duplicate category nahi

    def __str__(self):
        return f"{self.name} ({self.outlet.name})"


# ---------------- PRODUCT ----------------
class Product(models.Model):
    outlet = models.ForeignKey(
        Outlet,
        on_delete=models.CASCADE,
        related_name='products'
    )

    category = models.ForeignKey(
        Category,
        on_delete=models.CASCADE,
        related_name='products'
    )

    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=8, decimal_places=2)

    image = models.ImageField(
        upload_to='products/',
        blank=True,
        null=True
    )
    image_url_str = models.TextField(blank=True, null=True)

    quantity = models.IntegerField(null=True, blank=True, default=None)
    is_available = models.BooleanField(default=True)

    def get_platform_fee(self):
        return get_platform_fee_for_price(self.price)

    @property
    def customer_price(self):
        try:
            base = Decimal(str(self.price))
        except Exception:
            base = Decimal('0.00')
        return base + self.get_platform_fee()

    def __str__(self):
        return f"{self.name} - {self.outlet.name}"
    
    
   # updates in march
   
   # ---------------- CART ----------------
class Cart(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Cart - {self.user.username}"


# ---------------- CART ITEM ----------------
class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField(default=1)

    def total_price(self):
        return self.product.customer_price * self.quantity

    def outlet_total(self):
        return self.product.price * self.quantity

    def platform_fee_total(self):
        return self.product.get_platform_fee() * self.quantity


# ---------------- ORDER ----------------

class Order(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    actual_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    platform_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Razorpay fields
    payment_status = models.CharField(max_length=20, default="unpaid")
    razorpay_order_id = models.CharField(max_length=200, null=True, blank=True)
    razorpay_payment_id = models.CharField(max_length=200, null=True, blank=True)
    razorpay_signature = models.CharField(max_length=500, null=True, blank=True)

    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('preparing', 'Preparing'),
            ('completed', 'Completed'),
            ('delivered', 'Delivered'),
            ('cancelled', 'Cancelled')
        ],
        default='pending'
    )
    cancelled_by = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        choices=[
            ('customer', 'Customer'),
            ('outlet', 'Outlet Head')
        ]
    )

    class Meta:
        indexes = [
            models.Index(fields=['user', 'created_at'], name='order_user_created_idx'),
            models.Index(fields=['outlet', 'status', 'created_at'], name='order_outlet_st_crt_idx'),
            models.Index(fields=['outlet', 'status', 'completed_at'], name='order_outlet_st_cmp_idx'),
        ]

    def __str__(self):
        return f"Order {self.id} - {self.user.username}"
# class Order(models.Model):
#     user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
#     outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
#     created_at = models.DateTimeField(auto_now_add=True)
#     total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
#     completed_at = models.DateTimeField(null=True, blank=True)

#     status = models.CharField(
#         max_length=20,
#         choices=[
#             ('pending', 'Pending'),
#             ('preparing', 'Preparing'),
#             ('completed', 'Completed'),
#             ('delivered', 'Delivered'),
#             ('cancelled', 'Cancelled')
#         ],
#         default='pending'
#     )

#     def __str__(self):
#         return f"Order {self.id} - {self.user.username}"


# ---------------- ORDER ITEM ----------------
class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()

    # --- Price snapshot (captured at checkout, never changes) ---
    # These fields store the exact prices at the moment the order was created.
    # They are independent of future product price changes.
    unit_price = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        help_text="Product base price at the time of order"
    )
    platform_fee = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        help_text="Platform fee per unit at the time of order"
    )

    @property
    def customer_unit_price(self):
        """Total price per unit (base + platform fee) at time of order."""
        return self.unit_price + self.platform_fee

    @property
    def line_total(self):
        """Total amount for this line item."""
        return self.customer_unit_price * self.quantity


# ---------------- ORDER TOKEN ----------------
# Token is generated when the outlet marks an order as "completed".
# Token number never repeats for the same `outlet` on the same day.
class OrderToken(models.Model):
    order = models.OneToOneField(
        'Order',
        on_delete=models.CASCADE,
        related_name='token'
    )
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE, related_name='tokens')
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name='tokens')

    token_date = models.DateField()
    token_no = models.PositiveIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    # Used to show a one-time popup to the customer.
    is_viewed = models.BooleanField(default=False)
    viewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['outlet', 'token_date', 'token_no'],
                name='unique_outlet_token_per_day',
            )
        ]
        indexes = [
            models.Index(fields=['outlet', 'token_date']),
            models.Index(fields=['user', 'token_date']),
        ]

    def __str__(self):
        return f'{self.outlet.name} - Token #{self.token_no}'

# ---------------- PLATFORM FEE CONFIG ----------------
class PlatformFeeConfig(models.Model):
    fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Platform Fee Configuration (Fallback)'
        verbose_name_plural = 'Platform Fee Configuration (Fallback)'

    def __str__(self):
        return f"Platform Fee: ₹{self.fee_amount}"


class PlatformFeeSlab(models.Model):
    min_price = models.DecimalField(max_digits=10, decimal_places=2)
    max_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Leave blank for no upper limit",
    )
    fee_amount = models.DecimalField(max_digits=10, decimal_places=2)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['min_price']
        verbose_name = 'Platform Fee Slab'
        verbose_name_plural = 'Platform Fee Slabs'

    def __str__(self):
        upper = f"₹{self.max_price}" if self.max_price is not None else "∞"
        return f"₹{self.min_price}–{upper} → ₹{self.fee_amount}"

@receiver([post_save, post_delete], sender=PlatformFeeSlab)
@receiver([post_save, post_delete], sender=PlatformFeeConfig)
def on_platform_fee_change(sender, **kwargs):
    invalidate_platform_fee_cache()
