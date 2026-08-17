import os
import re

filepath = 'canteen/accounts/views.py'
with open(filepath, 'r') as f:
    content = f.read()

# We need to find `def customer_home(request):` and replace the end of it where it does `return response`
# Wait, `customer_home` has:
"""
    response = render(request, 'accounts/customer_home.html', {
        'outlets': outlets
    })

    t3 = time.perf_counter()

    print("=" * 60)
    print(f"AUTH CHECK: {t1 - total_start:.4f}s")
    print(f"DB QUERY:   {t2 - t1:.4f}s")
    print(f"TEMPLATE:   {t3 - t2:.4f}s")
    print(f"TOTAL:      {t3 - total_start:.4f}s")
    print("=" * 60)

    return response
"""
# Let's just find `def customer_home(request):`
# And add the JSON check before `return response` or `response = render...`

def patch_customer_home(content):
    target = "    response = render(request, 'accounts/customer_home.html', {"
    replacement = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'outlets': [
                {
                    'id': o.id,
                    'name': o.name,
                    'logo_url': o.logo.url if o.logo else None
                } for o in outlets
            ],
            'username': request.user.username
        })
    
    response = render(request, 'accounts/customer_home.html', {"""
    if target in content:
        return content.replace(target, replacement)
    return content

def patch_outlet_home(content):
    # outlet_home ends with:
    """
    return render(request, 'accounts/outlet_home.html', {
        'outlet': outlet,
        'ui': ui,
        'categories': categories,
        'products': products,
        'stats': stats
    })
    """
    target = "    return render(request, 'accounts/outlet_home.html', {"
    replacement = """    if request.headers.get('Accept') == 'application/json':
        return JsonResponse({
            'success': True,
            'outlet': {
                'id': outlet.id,
                'name': outlet.name,
                'logo_url': outlet.logo.url if outlet.logo else None
            },
            'username': request.user.username,
            'stats': stats
        })

    return render(request, 'accounts/outlet_home.html', {"""
    if target in content:
        return content.replace(target, replacement)
    return content

new_content = patch_customer_home(content)
new_content = patch_outlet_home(new_content)

if new_content != content:
    with open(filepath, 'w') as f:
        f.write(new_content)
    print("Patched customer_home and outlet_home successfully!")
else:
    print("Could not find the targets.")

