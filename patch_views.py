import os

filepath = 'canteen/accounts/views.py'
with open(filepath, 'r') as f:
    content = f.read()

if 'def csrf_token_view' not in content:
    # Add imports
    if 'from django.views.decorators.csrf import ensure_csrf_cookie' not in content:
        content = content.replace('from django.views.decorators.csrf import csrf_exempt', 'from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie\nfrom django.middleware.csrf import get_token')

    # Add view
    view_code = """
@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({'csrfToken': get_token(request)})

"""
    # Insert after imports
    # Find the last import
    last_import = content.rfind('import ')
    next_line = content.find('\n', last_import)
    
    content = content[:next_line+1] + view_code + content[next_line+1:]

    with open(filepath, 'w') as f:
        f.write(content)
    print("Added csrf_token_view")

