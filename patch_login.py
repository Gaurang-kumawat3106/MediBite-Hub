import os
import re

filepath = 'canteen/accounts/views.py'
with open(filepath, 'r') as f:
    content = f.read()

old_login_def = """def login_view(request):
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
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            
            # Print login debug info
            print("\\n================ LOGIN VIEW DEBUG ================")
            print(f"[DEBUG] Login attempt for Username: {username}")
            
            # Find user in DB
            try:
                db_user = UserModel.objects.get(username=username)
                print(f"[DEBUG] Found User in DB: {db_user.username} (ID: {db_user.pk}), Email: {db_user.email}")
                print(f"[DEBUG] Password Hash in DB: {db_user.password}")
                print(f"[DEBUG] check_password validation result: {db_user.check_password(password)}")
            except UserModel.DoesNotExist:
                print("[DEBUG] User not found in DB.")

            user = authenticate(
                request,
                username=username,
                password=password
            )
            print(f"[DEBUG] authenticate() result: {user}")
            print("==================================================\\n")

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
                
                # Unconditionally enable persistent session for 14 days
                request.session.set_expiry(1209600)
                    
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
    })"""

new_login_def = """def login_view(request):
    is_json = request.headers.get('Accept') == 'application/json'
    
    if request.user.is_authenticated:
        if _is_pending_outlet_user(request.user):
            logout(request)
            msg = 'Wait until the admin approves your outlet account.'
            if is_json: return JsonResponse({'success': False, 'msg': msg})
            return render(request, 'accounts/login.html', {
                'form': LoginForm(),
                'msg': msg,
                'next': '',
                'show_approval_popup': True,
            })
        
        if is_json: return JsonResponse({'success': True, 'redirect': True, 'role': 'outlet' if request.user.is_outlet_head else 'customer'})
        
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
            username = form.cleaned_data['username']
            password = form.cleaned_data['password']
            
            # Print login debug info
            print("\\n================ LOGIN VIEW DEBUG ================")
            print(f"[DEBUG] Login attempt for Username: {username}")
            
            # Find user in DB
            try:
                db_user = UserModel.objects.get(username=username)
                print(f"[DEBUG] Found User in DB: {db_user.username} (ID: {db_user.pk}), Email: {db_user.email}")
                print(f"[DEBUG] Password Hash in DB: {db_user.password}")
                print(f"[DEBUG] check_password validation result: {db_user.check_password(password)}")
            except UserModel.DoesNotExist:
                print("[DEBUG] User not found in DB.")

            user = authenticate(
                request,
                username=username,
                password=password
            )
            print(f"[DEBUG] authenticate() result: {user}")
            print("==================================================\\n")

            if user is not None:
                if _is_pending_outlet_user(user):
                    msg = 'Wait until the admin approves your outlet account.'
                    if is_json: return JsonResponse({'success': False, 'msg': msg})
                    return render(request, 'accounts/login.html', {
                        'form': form,
                        'msg': msg,
                        'next': next_url,
                        'show_approval_popup': True,
                    })
                login(request, user)
                
                # Unconditionally enable persistent session for 14 days
                request.session.set_expiry(1209600)
                    
                next_url = request.POST.get('next') or next_url
                if next_url and next_url.startswith('/'):
                    request.session['next_url'] = next_url
                
                if is_json: return JsonResponse({'success': True, 'redirect': True, 'role': 'outlet' if user.is_outlet_head else 'customer'})
                
                return redirect('welcome_splash')
            msg = 'Invalid username or password. Please try again.'
            if is_json: return JsonResponse({'success': False, 'msg': msg})
        else:
            msg = 'Please correct the errors below.'
            if is_json: return JsonResponse({'success': False, 'msg': msg, 'errors': form.errors})

    return render(request, 'accounts/login.html', {
        'form': form,
        'msg': msg,
        'next': next_url,
    })"""

if old_login_def in content:
    content = content.replace(old_login_def, new_login_def)
    with open(filepath, 'w') as f:
        f.write(content)
    print("Patched login_view successfully!")
else:
    print("Could not find the exact old_login_def block.")
