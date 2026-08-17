import os

filepath = 'canteen/accounts/views.py'
with open(filepath, 'r') as f:
    content = f.read()

def patch_view(content, target, replacement):
    if target in content and replacement not in content:
        return content.replace(target, replacement)
    return content

# cart_view
target_cart = "    return render(request, 'accounts/cart.html', {"
replacement_cart = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'items': [
                {
                    'id': item.id,
                    'product_id': item.product.id,
                    'name': item.product.name,
                    'price': float(item.product.customer_price),
                    'quantity': item.quantity,
                    'image_url': item.product.image.url if item.product.image else None,
                    'outlet_name': item.product.outlet.name
                } for item in items
            ],
            'total': float(total),
            'can_order': can_order,
            'razorpay_key_id': getattr(settings, "RAZORPAY_KEY_ID", "")
        })
    return render(request, 'accounts/cart.html', {"""

# customer_orders
target_customer_orders = "    return render(request, 'accounts/customer_orders.html', {'orders': orders, 'popup_token': popup_token})"
replacement_customer_orders = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'orders': [
                {
                    'id': o.id,
                    'status': o.status,
                    'payment_status': o.payment_status,
                    'total_amount': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'outlet_name': o.outlet.name,
                    'token_number': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'items': [
                        {
                            'id': i.id,
                            'product_name': i.product.name if i.product else i.product_name,
                            'quantity': i.quantity,
                            'price': float(i.unit_price)
                        } for i in o.items.all()
                    ]
                } for o in orders
            ],
            'popup_token': {
                'id': popup_token.id,
                'order_id': popup_token.order.id,
                'token_number': str(popup_token.token_no),
                'outlet_name': popup_token.outlet.name,
                'remaining_seconds': getattr(popup_token, 'remaining_seconds', 0)
            } if popup_token else None
        })
    return render(request, 'accounts/customer_orders.html', {'orders': orders, 'popup_token': popup_token})"""

# outlet_orders
target_outlet_orders = "    return render(request, 'accounts/outlet_orders.html', {"
replacement_outlet_orders = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'orders': [
                {
                    'id': o.id,
                    'status': o.status,
                    'payment_status': o.payment_status,
                    'total_amount': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'customer_name': o.user.username if o.user else "Guest",
                    'token_number': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'items': [
                        {
                            'id': i.id,
                            'product_name': i.product.name if i.product else i.product_name,
                            'quantity': i.quantity,
                            'price': float(i.unit_price)
                        } for i in o.items.all()
                    ]
                } for o in orders
            ]
        })
    return render(request, 'accounts/outlet_orders.html', {"""

# outlet_delivered_orders
target_outlet_delivered_orders = "    return render(request, 'accounts/outlet_delivered_orders.html', {"
replacement_outlet_delivered_orders = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'orders': [
                {
                    'id': o.id,
                    'status': o.status,
                    'payment_status': o.payment_status,
                    'total_amount': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'customer_name': o.user.username if o.user else "Guest",
                    'token_number': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'items': [
                        {
                            'id': i.id,
                            'product_name': i.product.name if i.product else i.product_name,
                            'quantity': i.quantity,
                            'price': float(i.unit_price)
                        } for i in o.items.all()
                    ]
                } for o in orders
            ]
        })
    return render(request, 'accounts/outlet_delivered_orders.html', {"""

# customer_token
target_customer_token = "    return render(request, 'accounts/customer_token.html', {"
replacement_customer_token = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'tokens': [
                {
                    'id': t.id,
                    'order_id': t.order.id,
                    'token_number': str(t.token_no),
                    'outlet_name': t.outlet.name,
                    'remaining_seconds': getattr(t, 'remaining_seconds', 0)
                } for t in tokens
            ],
            'popup_token': {
                'id': popup_token.id,
                'order_id': popup_token.order.id,
                'token_number': str(popup_token.token_no),
                'outlet_name': popup_token.outlet.name,
                'remaining_seconds': getattr(popup_token, 'remaining_seconds', 0)
            } if popup_token else None
        })
    return render(request, 'accounts/customer_token.html', {"""

# outlet_products_view
target_outlet_products = "    return render(request, 'accounts/outlet_products.html', {"
replacement_outlet_products = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'categories': [
                {
                    'id': c.id,
                    'name': c.name,
                    'products': [
                        {
                            'id': p.id,
                            'name': p.name,
                            'customer_price': float(p.customer_price),
                            'is_available': p.is_available,
                            'image_url': p.image.url if p.image else None
                        } for p in c.products.all()
                    ]
                } for c in categories
            ]
        })
    return render(request, 'accounts/outlet_products.html', {"""

new_content = content
new_content = patch_view(new_content, target_cart, replacement_cart)
new_content = patch_view(new_content, target_customer_orders, replacement_customer_orders)
new_content = patch_view(new_content, target_outlet_orders, replacement_outlet_orders)
new_content = patch_view(new_content, target_outlet_delivered_orders, replacement_outlet_delivered_orders)
new_content = patch_view(new_content, target_customer_token, replacement_customer_token)
new_content = patch_view(new_content, target_outlet_products, replacement_outlet_products)

if new_content != content:
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Patched all dashboard views successfully!")
else:
    print("Could not find some targets or already patched.")
