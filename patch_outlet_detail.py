import os

filepath = 'canteen/accounts/views.py'
with open(filepath, 'r') as f:
    content = f.read()

def patch_outlet_detail(content):
    target = "    return render(request, 'accounts/outlet_detail.html', {"
    replacement = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'outlet': {
                'id': outlet.id,
                'name': outlet.name,
                'logo_url': outlet.logo.url if outlet.logo else None
            },
            'categories': [
                {
                    'id': c.id,
                    'name': c.name,
                    'products': [
                        {
                            'id': p.id,
                            'name': p.name,
                            'customer_price': p.customer_price,
                            'image_url': p.image.url if p.image else None
                        } for p in c.products.all()
                    ]
                } for c in categories
            ]
        })

    return render(request, 'accounts/outlet_detail.html', {"""
    
    if target in content:
        return content.replace(target, replacement)
    return content

new_content = patch_outlet_detail(content)

if new_content != content:
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Patched outlet_detail successfully!")
else:
    print("Could not find the target in outlet_detail.")

