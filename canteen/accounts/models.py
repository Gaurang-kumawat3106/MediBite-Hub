from django.contrib.auth.models import AbstractUser
from django.db import models


# ---------------- USER MODEL ----------------
class CustomUser(AbstractUser):
    is_customer = models.BooleanField(default=False)
    is_outlet_head = models.BooleanField(default=False)
    is_email_verified = models.BooleanField(default=False)

    def __str__(self):
        return self.username


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

    is_available = models.BooleanField(default=True)

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
        return self.product.price * self.quantity


# ---------------- ORDER ----------------

class Order(models.Model):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE)
    outlet = models.ForeignKey(Outlet, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
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