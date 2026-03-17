from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required

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
from .models import Cart, CartItem, Order, OrderItem

# ---------------- HOME ----------------



# ---------------- LOGIN ----------------
def login_view(request):
    if request.user.is_authenticated:
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
                login(request, user)
                next_url = request.POST.get('next') or next_url
                if next_url and next_url.startswith('/'):
                    return redirect(next_url)
                if user.is_customer:
                    return redirect('customer_home')
                if user.is_outlet_head:
                    return redirect('outlet_home')
                return redirect('customer_home')
            msg = 'Invalid username or password. Please try again.'
        else:
            msg = 'Please correct the errors below.'

    return render(request, 'accounts/login.html', {
        'form': form,
        'msg': msg,
        'next': next_url,
    })


# ---------------- LOGOUT ----------------
def logout_view(request):
    logout(request)
    return redirect('login')


# ---------------- REGISTER ----------------
def customer_register(request):
    form = CustomerSignupForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        form.save()
        return redirect('login')
    return render(request, 'accounts/customer_register.html', {'form': form})


def outlet_register(request):
    form = OutletSignupForm(request.POST or None)
    if request.method == 'POST' and form.is_valid():
        user = form.save()
        Outlet.objects.get_or_create(
            manager=user,
            defaults={"name": f"{user.username}'s Outlet"},
        )
        return redirect('login')
    return render(request, 'accounts/outlet_register.html', {'form': form})


# ---------------- CUSTOMER DASHBOARD ----------------
@login_required
def customer_home(request):
    if not request.user.is_customer:
        return redirect('login')

    outlets = Outlet.objects.all()

    return render(request, 'accounts/customer_home.html', {
        'outlets': outlets
    })


# ---------------- OUTLET HEAD DASHBOARD ----------------
@login_required
def outlet_home(request):
    if not request.user.is_outlet_head:
        return redirect('login')

    outlet = request.user.outlet   # 🔥 direct outlet
    categories = outlet.categories.all()
    products = outlet.products.all()

    return render(request, 'accounts/outlet_home.html', {
        'outlet': outlet,
        'categories': categories,
        'products': products
    })


# ---------------- OUTLET DETAIL (CUSTOMER + HEAD) ----------------
def outlet_detail(request, id):
    outlet = get_object_or_404(Outlet, id=id)
    ui = getattr(outlet, 'ui', None)
    is_owner = (
        request.user.is_authenticated
        and request.user.is_outlet_head
        and getattr(request.user, 'outlet', None) == outlet
    )

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

    outlet = request.user.outlet

    if request.method == 'POST':
        name = request.POST.get('name')
        if name:
            Category.objects.create(outlet=outlet, name=name)

    return redirect('outlet_home')


@login_required
def delete_category(request, category_id):
    if not request.user.is_outlet_head:
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

    outlet = request.user.outlet

    if request.method == 'POST':
        Product.objects.create(
            outlet=outlet,
            category_id=request.POST.get('category'),
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

    cart, created = Cart.objects.get_or_create(user=request.user)

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

    return render(request, 'accounts/cart.html', {
        'items': items,
        'total': total
    })
    
    
@login_required
def remove_from_cart(request, item_id):
    item = get_object_or_404(CartItem, id=item_id)
    item.delete()
    return redirect('cart')

@login_required
def place_order(request):

    cart = Cart.objects.get(user=request.user)
    items = cart.items.all()

    if not items:
        return redirect('cart')

    outlet = items.first().product.outlet

    order = Order.objects.create(
        user=request.user,
        outlet=outlet
    )

    for item in items:
        OrderItem.objects.create(
            order=order,
            product=item.product,
            quantity=item.quantity
        )

    items.delete()

    return redirect('customer_home')

@login_required
def outlet_orders(request):

    if not request.user.is_outlet_head:
        return redirect('login')

    outlet = request.user.outlet

    orders = Order.objects.filter(outlet=outlet).order_by('-created_at')

    return render(request, 'accounts/outlet_orders.html', {
        'orders': orders
    }) 
    
    
@login_required
def increase_quantity(request, item_id):
    item = get_object_or_404(CartItem, id=item_id)
    
    if item.cart.user == request.user:
        item.quantity += 1
        item.save()
        return redirect('cart')
    
    
@login_required
def decrease_quantity(request, item_id):
    item = get_object_or_404(CartItem, id=item_id)

    if item.cart.user == request.user:
        if item.quantity > 1:
            item.quantity -= 1
            item.save()
        else:
            item.delete()

    return redirect('cart')

   