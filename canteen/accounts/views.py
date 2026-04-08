from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from django.db import IntegrityError, transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from datetime import timedelta
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
import razorpay
from django.http import JsonResponse
from django.views.decorators.http import require_POST

from .forms import (
    LoginForm,
    CustomerSignupForm,
    OutletSignupForm,
    OutletForm,
    OutletThemeForm
)

from .models import (
    Outlet,
    OutletUI,
    Category,
    Product
)
from .models import Cart, CartItem, Order, OrderItem, OrderToken

TOKEN_VISIBLE_FOR = timedelta(hours=3)
UserModel = get_user_model()


def _is_pending_outlet_user(user):
    return (
        getattr(user, 'is_outlet_head', False)
        and hasattr(user, 'outlet')
        and not user.outlet.is_approved
    )

# ---------------- HOME ----------------



# ---------------- LOGIN ----------------
def login_view(request):
    if request.user.is_authenticated:
        if _is_pending_outlet_user(request.user):
            logout(request)
            return render(request, 'accounts/login.html', {
                'form': LoginForm(),
                'msg': 'Wait until the admin approves your outlet account.',
                'next': '',
                'show_approval_popup': True,
            })
        if request.user.is_customer:
            return redirect('customer_home')
        if request.user.is_outlet_head:
            return redirect('outlet_home')
        else:
            return redirect('customer_home')

    form = LoginForm(request.POST or None)
    msg = None
    next_url = request.GET.get('next', '')

    if request.method == 'POST':
        if form.is_valid():
            user = authenticate(
                request,
                username=form.cleaned_data['username'],
                password=form.cleaned_data['password']
            )
            if user is not None:
                if _is_pending_outlet_user(user):
                    msg = 'Wait until the admin approves your outlet account.'
                    return render(request, 'accounts/login.html', {
                        'form': form,
                        'msg': msg,
                        'next': next_url,
                        'show_approval_popup': True,
                    })
                login(request, user)
                next_url = request.POST.get('next') or next_url
                if next_url and next_url.startswith('/'):
                    request.session['next_url'] = next_url
                return redirect('welcome_splash')
            msg = 'Invalid username or password. Please try again.'
        else:
            msg = 'Please correct the errors below.'

    return render(request, 'accounts/login.html', {
        'form': form,
        'msg': msg,
        'next': next_url,
    })

# ---------------- WELCOME SPLASH ----------------
@login_required
def welcome_splash(request):
    next_url = request.session.pop('next_url', None)

    if _is_pending_outlet_user(request.user):
        logout(request)
        return render(request, 'accounts/login.html', {
            'form': LoginForm(),
            'msg': 'Wait until the admin approves your outlet account.',
            'next': '',
            'show_approval_popup': True,
        })

    # Ensure social login users have is_customer set if neither flag is set
    if not request.user.is_customer and not request.user.is_outlet_head:
        request.user.is_customer = True
        request.user.save()

    is_customer = request.user.is_customer
    name = request.user.username
    if getattr(request.user, 'is_outlet_head', False) and hasattr(request.user, 'outlet'):
        name = request.user.outlet.name
    
    # Where they go after the 3 second animation:
    if next_url:
        redirect_to = next_url
    elif is_customer:
        redirect_to = '/app/customer/home/'
    elif request.user.is_outlet_head:
        redirect_to = '/app/outlet/home/'
    else:
        # Fallback to customer home if they somehow lack both roles
        redirect_to = '/app/customer/home/'

    return render(request, 'accounts/welcome.html', {
        'user_name': name,
        'is_customer': is_customer,
        'redirect_to': redirect_to
    })


# ---------------- LOGOUT ----------------
def logout_view(request):
    logout(request)
    return redirect('login')


# ---------------- REGISTER ----------------
def customer_register(request):
    form = CustomerSignupForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        return redirect('customer_home')
    return render(request, 'accounts/customer_register.html', {'form': form})


def outlet_register(request):
    form = OutletSignupForm(request.POST or None, request.FILES or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        outlet_name = form.cleaned_data.get('outlet_name') or f"{user.username}'s Outlet"
        outlet_logo = form.cleaned_data.get('logo')
        Outlet.objects.create(
            manager=user,
            name=outlet_name,
            logo=outlet_logo,
            is_approved=False,
        )
        # Don't log in unapproved outlet heads; ask them to wait for admin approval.
        return render(request, 'accounts/login.html', {
            'form': LoginForm(),
            'msg': 'Registration successful. Wait until the admin approves your outlet account.',
            'next': '',
            'show_approval_popup': True,
        })
    return render(request, 'accounts/outlet_register.html', {'form': form})


# ---------------- CUSTOMER DASHBOARD ----------------
@login_required
def customer_home(request):
    if not request.user.is_customer:
        return redirect('login')

    outlets = Outlet.objects.filter(is_approved=True)

    return render(request, 'accounts/customer_home.html', {
        'outlets': outlets
    })


# ---------------- OUTLET HEAD DASHBOARD ----------------
def get_order_stats(outlet):
    now = timezone.now()
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    valid_orders = Order.objects.filter(outlet=outlet).exclude(status='cancelled')

    week_orders = valid_orders.filter(created_at__gte=week_start)
    month_orders = valid_orders.filter(created_at__gte=month_start)

    def group_by_amount(qs):
        return {
            'under_100': qs.filter(total_amount__lt=100).count(),
            'under_200': qs.filter(total_amount__gte=100, total_amount__lt=200).count(),
            'under_500': qs.filter(total_amount__gte=200, total_amount__lt=500).count(),
            'above_500': qs.filter(total_amount__gte=500).count(),
        }

    return {
        'week': group_by_amount(week_orders),
        'month': group_by_amount(month_orders),
    }

@login_required
def outlet_home(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet   # 🔥 direct outlet
    ui = getattr(outlet, 'ui', None)  # 🔥 get UI settings if exists
    categories = outlet.categories.all()
    products = outlet.products.all()

    stats = get_order_stats(outlet)

    return render(request, 'accounts/outlet_home.html', {
        'outlet': outlet,
        'ui': ui,
        'categories': categories,
        'products': products,
        'stats': stats
    })


# ---------------- OUTLET DETAIL (CUSTOMER + HEAD) ----------------
def outlet_detail(request, id):
    outlet = get_object_or_404(Outlet, id=id)
    is_owner = (
        request.user.is_authenticated
        and request.user.is_outlet_head
        and getattr(request.user, 'outlet', None) == outlet
    )

    # Customers (and anonymous users) must not see unapproved outlets.
    if not outlet.is_approved and not is_owner and not getattr(request.user, 'is_staff', False):
        return redirect('customer_home')

    ui = getattr(outlet, 'ui', None)

    categories = Category.objects.filter(
        outlet=outlet,
        is_active=True
    ).prefetch_related('products')

    return render(request, 'accounts/outlet_detail.html', {
        'outlet': outlet,
        'ui': ui,
        'categories': categories,
        'is_owner': is_owner,
    })


# ---------------- OUTLET UI / THEME ----------------
@login_required
def manage_outlet_ui(request, outlet_id):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = get_object_or_404(
        Outlet,
        id=outlet_id,
        manager=request.user
    )

    ui, _ = OutletUI.objects.get_or_create(outlet=outlet)
    form = OutletThemeForm(request.POST or None, request.FILES or None, instance=ui)

    if request.method == 'POST' and form.is_valid():
        form.save()
        return redirect('outlet_detail', outlet.id)

    return render(request, 'accounts/manage_outlet_ui.html', {
        'outlet': outlet,
        'form': form
    })


# ---------------- CATEGORY MANAGEMENT ----------------
@login_required
def add_category(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet

    if request.method == 'POST':
        name = request.POST.get('name')
        if name:
            if Category.objects.filter(outlet=outlet, name=name).exists():
                # For now just redirect, but ideally show an error
                return redirect('outlet_home')
            Category.objects.create(outlet=outlet, name=name)

    return redirect('outlet_home')


@login_required
def delete_category(request, category_id):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    category = get_object_or_404(
        Category,
        id=category_id,
        outlet__manager=request.user
    )

    outlet_id = category.outlet.id
    category.delete()
    return redirect('outlet_detail', outlet_id)


# ---------------- PRODUCT MANAGEMENT ----------------
@login_required
def add_product(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet

    if request.method == 'POST':
        category_id = request.POST.get('category')
        # Check if category belongs to this outlet
        category = get_object_or_404(Category, id=category_id, outlet=outlet)
        
        Product.objects.create(
            outlet=outlet,
            category=category,
            name=request.POST.get('name'),
            price=request.POST.get('price'),
            image=request.FILES.get('image')
        )

    return redirect('outlet_home')


   # updates in march
@login_required  
def product_detail(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    return render(request, 'accounts/product_detail.html', {'product': product})

@login_required
def add_to_cart(request, product_id):
    product = get_object_or_404(Product, id=product_id)

    if not product.is_available:
        # Cannot add unavailable product
        return redirect('outlet_detail', product.outlet.id)

    cart, created = Cart.objects.get_or_create(user=request.user)

    # Check if cart already has items from another outlet
    if cart.items.exists():
        existing_outlet = cart.items.first().product.outlet
        if existing_outlet != product.outlet:
            # Option 1: Clear cart and add new product
            cart.items.all().delete()
            messages.info(request, f"Your cart was cleared to add items from {product.outlet.name}")
            # Option 2: Reject addition (simpler)
            # messages.warning(request, f"You can only order from one outlet at a time. Clear your cart first.")
            # return redirect('cart')

    item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product
    )

    if not created:
        item.quantity += 1
        item.save()

    return redirect('cart')

@login_required
def cart_view(request):
    cart, created = Cart.objects.get_or_create(user=request.user)
    items = cart.items.all()

    total = sum([item.total_price() for item in items])
    can_order = all(item.product.is_available for item in items) and bool(items)

    return render(request, 'accounts/cart.html', {
        'items': items,
        'total': total,
        'can_order': can_order,
        'razorpay_key_id': getattr(settings, "RAZORPAY_KEY_ID", "")
    })
@login_required
@require_POST
def create_razorpay_order(request):
    cart = get_object_or_404(Cart, user=request.user)
    items = cart.items.all()

    if not items:
        return JsonResponse({"success": False, "error": "Cart is empty"}, status=400)

    for item in items:
        if not item.product.is_available:
            return JsonResponse({"success": False, "error": f"{item.product.name} is unavailable"}, status=400)

    outlet = items.first().product.outlet
    total_amount = sum([item.total_price() for item in items])
    amount_in_paisa = int(total_amount * 100)

    # ✅ Create DB Order first
    order = Order.objects.create(
        user=request.user,
        outlet=outlet,
        total_amount=total_amount,
        status="pending",
        payment_status="unpaid"
    )

    # ✅ Create Razorpay order
    client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
    razorpay_order = client.order.create({
        "amount": amount_in_paisa,
        "currency": "INR",
        "payment_capture": 1
    })

    order.razorpay_order_id = razorpay_order["id"]
    order.save()

    return JsonResponse({
        "success": True,
        "razorpay_order_id": razorpay_order["id"],
        "amount": amount_in_paisa,
        "key": settings.RAZORPAY_KEY_ID
    })

# @login_required
# def cart_view(request):
#     cart, created = Cart.objects.get_or_create(user=request.user)

#     items = cart.items.all()

#     total = sum([item.total_price() for item in items])
#     can_order = all(item.product.is_available for item in items) and bool(items)

#     amount_in_paisa = int(total * 100) if total else 0
#     razorpay_order_id = None
#     if can_order and amount_in_paisa > 0:
#         client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
#         try:
#             payment = client.order.create({
#                 "amount": amount_in_paisa,
#                 "currency": "INR",
#                 "payment_capture": "1"
#             })
#             razorpay_order_id = payment['id']
#         except Exception as e:
#             print("Razorpay Error:", e)

#     return render(request, 'accounts/cart.html', {
#         'items': items,
#         'total': total,
#         'can_order': can_order,
#         'razorpay_order_id': razorpay_order_id,
#         'razorpay_key_id': getattr(settings, 'RAZORPAY_KEY_ID', ''),
#         'amount_in_paisa': amount_in_paisa
#     })
    
    
@login_required
def remove_from_cart(request, item_id):
    item = get_object_or_404(CartItem, id=item_id)
    item.delete()
    return redirect('cart')

@login_required
def place_order(request):
    # This was the old way without razorpay, now moved to payment_callback.
    # Keep it as fallback if needed or just redirect.
    return redirect('cart')


@csrf_exempt
def payment_callback(request):
    if request.method == "POST":
        payment_id = request.POST.get("razorpay_payment_id", "")
        razorpay_order_id = request.POST.get("razorpay_order_id", "")
        signature = request.POST.get("razorpay_signature", "")

        if not payment_id or not razorpay_order_id or not signature:
            messages.error(request, "Invalid payment response.")
            return redirect("cart")

        client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))

        params_dict = {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature
        }

        try:
            # ✅ Verify payment signature
            client.utility.verify_payment_signature(params_dict)

            # ✅ Find order using razorpay_order_id
            order = get_object_or_404(Order, razorpay_order_id=razorpay_order_id)

            # If already paid then skip
            if order.payment_status == "paid":
                return redirect("customer_orders")

            cart = get_object_or_404(Cart, user=order.user)
            items = cart.items.all()

            if not items:
                messages.error(request, "Cart empty. Order cannot be completed.")
                return redirect("cart")

            # Create OrderItems
            for item in items:
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    quantity=item.quantity
                )

            # Clear cart
            items.delete()

            # Update payment details
            order.payment_status = "paid"
            order.razorpay_payment_id = payment_id
            order.razorpay_signature = signature

            # 🔥 payment success => preparing
            order.status = "preparing"
            order.save()

            # Websocket notify outlet
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"outlet_{order.outlet.id}",
                {
                    "type": "new_order",
                    "order_id": order.id,
                    "customer_name": order.user.username,
                    "total_amount": str(order.total_amount)
                }
            )

            messages.success(request, "Payment successful! Order placed.")
            return redirect("customer_orders")

        except razorpay.errors.SignatureVerificationError:
            messages.error(request, "Payment verification failed.")
            return redirect("cart")

        except Exception as e:
            print("PAYMENT CALLBACK ERROR:", e)
            messages.error(request, "Something went wrong.")
            return redirect("cart")

    return redirect("cart")

# @csrf_exempt
# @login_required
# def payment_callback(request):
#     if request.method == "POST":
#         payment_id = request.POST.get('razorpay_payment_id', '')
#         razorpay_order_id = request.POST.get('razorpay_order_id', '')
#         signature = request.POST.get('razorpay_signature', '')

#         client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
#         params_dict = {
#             'razorpay_order_id': razorpay_order_id,
#             'razorpay_payment_id': payment_id,
#             'razorpay_signature': signature
#         }

#         try:
#             client.utility.verify_payment_signature(params_dict)
            
#             # Signature Valid -> Create Order
#             cart = get_object_or_404(Cart, user=request.user)
#             items = cart.items.all()

#             if not items:
#                 return redirect('cart')

#             # Ensure all items still available (optional but good)
#             for item in items:
#                 if not item.product.is_available:
#                     messages.error(request, f"{item.product.name} is no longer available.")
#                     return redirect('cart')

#             outlet = items.first().product.outlet
#             total_amount = sum([item.total_price() for item in items])

#             order = Order.objects.create(
#                 user=request.user,
#                 outlet=outlet,
#                 total_amount=total_amount,
#                 status='pending'
#             )

#             for item in items:
#                 OrderItem.objects.create(
#                     order=order,
#                     product=item.product,
#                     quantity=item.quantity
#                 )

#             items.delete()

#             # Trigger WebSocket notification to the outlet
#             channel_layer = get_channel_layer()
#             async_to_sync(channel_layer.group_send)(
#                 f"outlet_{outlet.id}",
#                 {
#                     "type": "new_order",
#                     "order_id": order.id,
#                     "customer_name": request.user.username,
#                     "total_amount": str(total_amount)
#                 }
#             )

#             messages.success(request, "Order placed successfully! Payment verified.")
#             return redirect('customer_orders')

#         except razorpay.errors.SignatureVerificationError:
#             messages.error(request, "Payment signature verification failed. Order not placed.")
#             return redirect('cart')

#     return redirect('cart')

@login_required
def customer_orders(request):
    if not request.user.is_customer:
        return redirect('login')
    orders = Order.objects.filter(user=request.user).order_by('-created_at')
    # Popup only if the token is still valid (<= 3 hours since completion).
    popup_token = None
    candidate = (
        OrderToken.objects.filter(user=request.user, is_viewed=False)
        .select_related('outlet', 'order')
        .order_by('-created_at')
        .first()
    )
    if candidate and getattr(candidate.order, "status", None) == "completed":
        candidate.remaining_seconds = _token_remaining_seconds(candidate)
        if candidate.remaining_seconds > 0:
            candidate.expires_at = _token_expires_at(candidate)
            popup_token = candidate
            popup_token.is_viewed = True
            popup_token.viewed_at = timezone.now()
            popup_token.save(update_fields=['is_viewed', 'viewed_at'])

    return render(request, 'accounts/customer_orders.html', {'orders': orders, 'popup_token': popup_token})

@login_required
def cancel_order(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    if order.status == 'pending':
        if request.method == 'POST':
            order.status = 'cancelled'
            order.save()
    return redirect('customer_orders')

@login_required
def outlet_orders(request):

    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet

    orders = Order.objects.filter(outlet=outlet).order_by('-created_at')

    return render(request, 'accounts/outlet_orders.html', {
        'orders': orders
    }) 


def generate_token_for_order(order):
    """
    Create a daily sequential token for the outlet.
    Token number will not repeat for the same outlet on the same day.
    """
    # If already exists, don't duplicate.
    existing = OrderToken.objects.filter(order=order).first()
    if existing:
        return existing

    token_date = timezone.localdate()
    outlet = order.outlet
    user = order.user

    for _ in range(5):
        with transaction.atomic():
            latest = (
                OrderToken.objects.filter(outlet=outlet, token_date=token_date)
                .order_by('-token_no')
                .first()
            )
            next_no = 1 if latest is None else (latest.token_no + 1)
            try:
                token_obj = OrderToken.objects.create(
                    order=order,
                    outlet=outlet,
                    user=user,
                    token_date=token_date,
                    token_no=next_no,
                )
                
                # Trigger WebSocket notification for token
                channel_layer = get_channel_layer()
                async_to_sync(channel_layer.group_send)(
                    f"user_{user.id}",
                    {
                        "type": "token_update",
                        "order_id": order.id,
                        "token_no": next_no,
                        "message": f"Your order token is #{next_no}"
                    }
                )
                return token_obj
            except IntegrityError:
                # Likely a race condition; retry with the latest token number.
                continue

    # If we reached here, something is wrong (repeated unique constraint collisions).
    raise IntegrityError("Could not generate a unique token number for the order.")


def _token_expires_at(token: OrderToken):
    completed_at = getattr(token.order, "completed_at", None) or token.created_at
    return completed_at + TOKEN_VISIBLE_FOR


def _token_remaining_seconds(token: OrderToken):
    remaining = (_token_expires_at(token) - timezone.now()).total_seconds()
    return int(remaining) if remaining > 0 else 0

@login_required
def update_order_status(request, order_id):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')
    order = get_object_or_404(Order, id=order_id, outlet=request.user.outlet)
    if request.method == 'POST':
        new_status = request.POST.get('status')
        old_status = order.status
        if new_status in ['preparing', 'completed', 'delivered', 'cancelled']:
            order.status = new_status
            if new_status == 'completed' and old_status != 'completed':
                order.completed_at = timezone.now()
            order.save()
            if new_status == 'completed' and old_status != 'completed':
                # Generate token only when an order becomes "completed".
                generate_token_for_order(order)
            
            # Trigger WebSocket notification for status change
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"user_{order.user.id}",
                {
                    "type": "order_update",
                    "order_id": order.id,
                    "status": new_status,
                    "message": f"Your order status is now: {new_status}"
                }
            )
    return redirect('outlet_orders')


@login_required
def customer_token(request):
    if not request.user.is_customer:
        return redirect('login')

    tokens_qs = (
        OrderToken.objects.filter(user=request.user)
        .select_related('outlet', 'order')
        .order_by('-created_at')
    )

    tokens = []
    for t in tokens_qs:
        # Only show tokens for completed orders, and only for 3 hours after completion.
        if getattr(t.order, "status", None) != "completed":
            continue
        t.remaining_seconds = _token_remaining_seconds(t)
        if t.remaining_seconds <= 0:
            continue
        t.expires_at = _token_expires_at(t)
        tokens.append(t)

    popup_token = next((t for t in tokens if not t.is_viewed), None)
    if popup_token:
        popup_token.is_viewed = True
        popup_token.viewed_at = timezone.now()
        popup_token.save(update_fields=['is_viewed', 'viewed_at'])

    return render(request, 'accounts/customer_token.html', {
        'tokens': tokens,
        'popup_token': popup_token,
    })
    
    
@login_required
def increase_quantity(request, item_id):
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    item.quantity += 1
    item.save()
    return redirect('cart')
    
    
@login_required
def decrease_quantity(request, item_id):
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    if item.quantity > 1:
        item.quantity -= 1
        item.save()
    else:
        item.delete()

    return redirect('cart')

# ---------------- PRODUCT AVAILABILITY MANAGEMENT ----------------

@login_required
def outlet_products_view(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet
    categories = Category.objects.filter(outlet=outlet).prefetch_related('products')
    
    return render(request, 'accounts/outlet_products.html', {
        'outlet': outlet,
        'categories': categories,
    })

@login_required
def toggle_availability(request, product_id):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')
    
    product = get_object_or_404(Product, id=product_id, outlet=request.user.outlet)
    
    if request.method == 'POST':
        product.is_available = not product.is_available
        product.save()
        
    return redirect('outlet_products')


   