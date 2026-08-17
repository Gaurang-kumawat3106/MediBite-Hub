import re

file_path = 'canteen/accounts/views.py'
with open(file_path, 'r') as f:
    content = f.read()

# Replace edit_product body
new_edit_product = """@login_required
def edit_product(request, product_id):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')
    
    product = get_object_or_404(Product, id=product_id, outlet=request.user.outlet)
    
    if request.method == 'POST':
        if request.headers.get('Accept') == 'application/json' or request.headers.get('x-requested-with') == 'XMLHttpRequest':
            name = request.POST.get('name')
            price = request.POST.get('price')
            category_id = request.POST.get('category')
            image = request.FILES.get('image')
            
            if name: product.name = name
            if price:
                try: product.price = float(price)
                except ValueError: pass
            if category_id:
                cat = get_object_or_404(Category, id=category_id, outlet=request.user.outlet)
                product.category = cat
            if image: product.image = image
            
            product.save()
            return JsonResponse({'success': True})
            
        action = request.POST.get('action')
        if action == 'delete':
            product_id_str = product.id
            product_name_str = product.name
            product.delete()
            
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "customers",
                {
                    "type": "product_deactivated",
                    "product_id": product_id_str,
                    "product_name": product_name_str,
                }
            )
            
            messages.success(request, f"Product deleted successfully.")
            return redirect('outlet_products')
        elif action == 'increase':
            product.price += 10
            product.save()
            messages.success(request, f"Price increased by ₹10.")
        elif action == 'decrease':
            if product.price >= 10:
                product.price -= 10
            else:
                product.price = 0
            product.save()
            messages.success(request, f"Price decreased by ₹10.")
        elif action == 'set_price':
            new_price = request.POST.get('price')
            if new_price:
                try:
                    product.price = float(new_price)
                    product.save()
                    messages.success(request, f"Price updated successfully.")
                except ValueError:
                    messages.error(request, "Invalid price format.")
        return redirect('edit_product', product_id=product.id)

    return render(request, 'accounts/edit_product.html', {'product': product})
"""

content = re.sub(r'@login_required\ndef edit_product\(request, product_id\):.*?return render\(request, \'accounts/edit_product\.html\', {\'product\': product}\)', new_edit_product, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(content)

print("Backend edit_product patched successfully.")
