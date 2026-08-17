import re

file_path = 'canteen/accounts/views.py'
with open(file_path, 'r') as f:
    content = f.read()

# Make sure we import Prefetch if not already
if 'from django.db.models import Prefetch' not in content:
    content = content.replace('from django.shortcuts import render', 'from django.shortcuts import render\nfrom django.db.models import Prefetch')

# Fix outlet_detail query
bad_query = """    categories = Category.objects.filter(
        outlet=outlet,
        is_active=True
    ).prefetch_related('products')"""

good_query = """    categories = Category.objects.filter(
        outlet=outlet,
        is_active=True
    ).prefetch_related(
        Prefetch('products', queryset=Product.objects.filter(is_available=True))
    )"""

content = content.replace(bad_query, good_query)

with open(file_path, 'w') as f:
    f.write(content)

print("Backend patched successfully.")
