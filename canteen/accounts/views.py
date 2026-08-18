import os
import json
from functools import wraps
from django.shortcuts import render, redirect, get_object_or_404
from django.db.models import Prefetch
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
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie
from django.middleware.csrf import get_token
import razorpay
from django.http import JsonResponse
from django.views.decorators.http import require_POST

def login_required_or_401(view_func):
    """
    Decorator for views that checks that the user is logged in.
    If the request is JSON/AJAX and user is not authenticated, returns HTTP 401 instead of 302 redirect.
    """
    @wraps(view_func)
    def _wrapped_view(request, *args, **kwargs):
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': False, 'error': 'Authentication required', 'login_required': True}, status=401)
            return redirect('login')
        return view_func(request, *args, **kwargs)
    return _wrapped_view

@ensure_csrf_cookie
def csrf_token_view(request):
    return JsonResponse({'csrfToken': get_token(request)})

@csrf_exempt
def health_check(request):
    return JsonResponse({
        'status': 'ok',
        'service': 'medibite-hub',
        'timestamp': timezone.now().isoformat(),
    })

from django.contrib.sites.shortcuts import get_current_site
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

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
import random

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
@csrf_exempt
def login_view(request):
    is_json = request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', '') or request.content_type == 'application/json'
    
    if request.user.is_authenticated:
        if _is_pending_outlet_user(request.user):
            logout(request)
            msg = 'Wait until the admin approves your outlet account.'
            if is_json: return JsonResponse({'success': False, 'msg': msg, 'pending_approval': True})
            return render(request, 'accounts/login.html', {
                'form': LoginForm(),
                'msg': msg,
                'next': '',
                'show_approval_popup': True,
            })
        
        request.session.save()
        if is_json:
            return JsonResponse({
                'success': True,
                'redirect': True,
                'role': 'outlet' if request.user.is_outlet_head else 'customer',
                'session_key': request.session.session_key,
                'user': {
                    'id': request.user.id,
                    'username': request.user.username,
                    'email': request.user.email,
                    'is_customer': request.user.is_customer,
                    'is_outlet_head': request.user.is_outlet_head,
                }
            })
        
        if request.user.is_customer:
            return redirect('customer_home')
        if request.user.is_outlet_head:
            return redirect('outlet_home')
        else:
            return redirect('customer_home')

    next_url = request.GET.get('next', '')
    msg = None

    if request.method == 'POST':
        username_input = None
        password_input = None

        # Handle JSON body or Form Data
        if request.content_type == 'application/json' or (not request.POST and request.body):
            try:
                body = json.loads(request.body.decode('utf-8'))
                username_input = body.get('username') or body.get('email')
                password_input = body.get('password')
            except Exception:
                pass

        if not username_input or not password_input:
            username_input = request.POST.get('username')
            password_input = request.POST.get('password')

        if not username_input or not password_input:
            form = LoginForm(request.POST or None)
            msg = 'Please enter both username/email and password.'
            if is_json: return JsonResponse({'success': False, 'msg': msg}, status=400)
            return render(request, 'accounts/login.html', {'form': form, 'msg': msg, 'next': next_url})

        login_identifier = username_input.strip()

        # Find user in DB by username or email (case-insensitive)
        db_user = UserModel.objects.filter(
            Q(username__iexact=login_identifier) | Q(email__iexact=login_identifier)
        ).first()

        # Authenticate using the db_user's canonical username if found, else original input
        target_username = db_user.username if db_user else login_identifier
        user = authenticate(request, username=target_username, password=password_input)

        if user is not None:
            if _is_pending_outlet_user(user):
                msg = 'Wait until the admin approves your outlet account.'
                if is_json: return JsonResponse({'success': False, 'msg': msg, 'pending_approval': True})
                return render(request, 'accounts/login.html', {
                    'form': LoginForm(request.POST or None),
                    'msg': msg,
                    'next': next_url,
                    'show_approval_popup': True,
                })
            login(request, user)
            
            # Unconditionally enable persistent session for 14 days
            request.session.set_expiry(1209600)
            request.session.save()
                
            next_url = request.POST.get('next') or next_url
            if next_url and next_url.startswith('/'):
                request.session['next_url'] = next_url
            
            if is_json:
                return JsonResponse({
                    'success': True,
                    'redirect': True,
                    'role': 'outlet' if user.is_outlet_head else 'customer',
                    'session_key': request.session.session_key,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'email': user.email,
                        'is_customer': user.is_customer,
                        'is_outlet_head': user.is_outlet_head,
                    }
                })
            
            return redirect('welcome_splash')

        # If authentication failed, diagnose reason for helpful message
        if db_user:
            if db_user.check_password(password_input):
                if not db_user.is_active or not getattr(db_user, 'is_email_verified', True):
                    msg = 'Your email address is not verified yet. Please check your email inbox for the verification link.'
                    if is_json:
                        return JsonResponse({
                            'success': False,
                            'msg': msg,
                            'unverified': True,
                            'email': db_user.email
                        })
                else:
                    msg = 'Account is disabled. Please contact support.'
                    if is_json: return JsonResponse({'success': False, 'msg': msg})
            else:
                msg = 'Invalid password. Please check your password and try again.'
                if is_json: return JsonResponse({'success': False, 'msg': msg})
        else:
            msg = 'No account found with this username or email address.'
            if is_json: return JsonResponse({'success': False, 'msg': msg})

        form = LoginForm(request.POST or None)
        return render(request, 'accounts/login.html', {'form': form, 'msg': msg, 'next': next_url})

    form = LoginForm()
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
@csrf_exempt
def logout_view(request):
    logout(request)
    return redirect('login')


# ---------------- REGISTER ----------------

def get_site_url(request=None):
    """
    Returns the absolute base URL with valid protocol (https:// or http://).
    Guarantees Brevo / Sendinblue link tracking never throws 'invalid URL: host missing' error.
    """
    site_url = os.environ.get('SITE_URL') or getattr(settings, 'SITE_URL', '')
    if not site_url and request:
        try:
            site_url = request.build_absolute_uri('/')
        except Exception:
            pass
    if not site_url:
        site_url = 'https://bhukkadbox.in'

    site_url = site_url.strip().rstrip('/')
    if not site_url.startswith('http://') and not site_url.startswith('https://'):
        proto = 'http://' if settings.DEBUG else 'https://'
        site_url = f"{proto}{site_url}"
    return site_url

def send_verification_email(request, user):
    base_url = get_site_url(request)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    verify_url = f"{base_url}/verify-email/{uid}/{token}/"
    mail_subject = 'Activate your Medibite account'

    message = render_to_string('accounts/email/verification_email.html', {
        'user': user,
        'site_url': base_url,
        'verify_url': verify_url,
        'uid': uid,
        'token': token,
    })

    try:
        send_mail(
            subject=mail_subject,
            message="",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=message,
            fail_silently=False
        )
        return 1
    except Exception as e:
        import traceback
        traceback.print_exc()
        return 0

@csrf_exempt
def customer_register(request):
    is_json = request.headers.get('Accept') == 'application/json'
    form = CustomerSignupForm(request.POST or None)
    if request.method == 'POST':
        if form.is_valid():
            user = form.save()
            email_sent = send_verification_email(request, user)
            msg = 'Registration successful. Please check your email to verify your account.' if email_sent else 'Registration successful, but we could not send the verification email due to a server error. Please try resending later.'
            if is_json:
                return JsonResponse({'success': True, 'msg': msg})
            if email_sent:
                messages.success(request, msg)
            else:
                messages.warning(request, msg)
            return redirect('login')
        else:
            if is_json:
                return JsonResponse({'success': False, 'errors': form.errors, 'msg': 'Please correct the errors below.'})
    return render(request, 'accounts/customer_register.html', {'form': form})


@csrf_exempt
def outlet_register(request):
    is_json = request.headers.get('Accept') == 'application/json'
    form = OutletSignupForm(request.POST or None, request.FILES or None)
    if request.method == 'POST':
        if form.is_valid():
            user = form.save()
            outlet_name = form.cleaned_data.get('outlet_name') or f"{user.username}'s Outlet"
            outlet_logo = form.cleaned_data.get('logo')
            Outlet.objects.create(
                manager=user,
                name=outlet_name,
                logo=outlet_logo,
                is_approved=False,
                is_featured=False
            )
            email_sent = send_verification_email(request, user)
            msg = 'Registration successful. Please wait for admin approval and check your email for verification.'
            if is_json:
                return JsonResponse({'success': True, 'msg': msg})
            if email_sent:
                messages.success(request, msg)
            else:
                messages.warning(request, msg)
            return redirect('login')
        else:
            if is_json:
                return JsonResponse({'success': False, 'errors': form.errors, 'msg': 'Please correct the errors below.'})
    return render(request, 'accounts/outlet_register.html', {'form': form})

# ---------------- EMAIL VERIFICATION ----------------
def verify_email(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = UserModel.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, UserModel.DoesNotExist):
        user = None

    if user is not None and default_token_generator.check_token(user, token):
        user.is_email_verified = True
        user.is_active = True
        user.save(update_fields=['is_email_verified', 'is_active'])
        messages.success(request, 'Your email has been verified! You can now log in.')
        return render(request, 'accounts/email_verification_success.html')
    else:
        messages.error(request, 'The verification link was invalid or has expired.')
        return render(request, 'accounts/email_verification_invalid.html')

def resend_verification_email(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        try:
            user = UserModel.objects.get(email=email)
            if user.is_active:
                messages.info(request, 'Your account is already verified. Please log in.')
            else:
                email_sent = send_verification_email(request, user)
                if email_sent:
                    messages.success(request, 'Verification email sent successfully.')
                else:
                    messages.error(request, 'Failed to send verification email due to a server error.')
        except UserModel.DoesNotExist:
            messages.error(request, 'No user found with this email address.')
    return render(request, 'accounts/resend_verification.html')


# ---------------- FORGOT PASSWORD ----------------
def mask_email(email):
    if not email or '@' not in email:
        return email
    user_part, domain_part = email.split('@', 1)
    if len(user_part) <= 1:
        masked_user = user_part + "*"
    elif len(user_part) <= 2:
        masked_user = user_part[0] + "*"
    elif len(user_part) <= 4:
        masked_user = user_part[0] + "*" * (len(user_part) - 2) + user_part[-1]
    else:
        masked_user = user_part[:2] + "*" * (len(user_part) - 4) + user_part[-2:]
    return f"{masked_user}@{domain_part}"

def mask_username(username):
    if not username:
        return username
    if len(username) <= 1:
        return username + "*"
    elif len(username) <= 2:
        return username[0] + "*" * (len(username) - 1)
    elif len(username) <= 4:
        return username[0] + "*" * (len(username) - 2) + username[-1]
    else:
        return username[:2] + "*" * (len(username) - 4) + username[-2:]

# Helper to send password reset email
def send_reset_email_for_user(request, user):
    base_url = get_site_url(request)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    reset_url = f"{base_url}/password-reset-confirm/{uid}/{token}/"

    mail_subject = "Password Reset Request"

    message = render_to_string('accounts/email/password_reset_email.html', {
        'user': user,
        'site_url': base_url,
        'reset_url': reset_url,
        'uid': uid,
        'token': token,
    })

    send_mail(
        subject=mail_subject,
        message="",
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=message,
        fail_silently=False
    )

# Helper to check rate limiting for security
def is_password_reset_rate_limited(request, email):
    ip = request.META.get('REMOTE_ADDR')
    email_key = f"pwd_reset_email_{email.lower()}"
    ip_key = f"pwd_reset_ip_{ip}"
    
    # Max 3 requests per 15 minutes per email/IP
    email_count = cache.get(email_key, 0)
    ip_count = cache.get(ip_key, 0)
    
    if email_count >= 3 or ip_count >= 10:
        return True
        
    cache.set(email_key, email_count + 1, 900)  # 15 minutes expiry
    cache.set(ip_key, ip_count + 1, 900)
    return False

# ---------------- PASSWORD RESET ----------------
def password_reset_request(request):
    if request.method == 'POST':
        email = request.POST.get('email', '').strip()
        if not email:
            messages.error(request, 'Please enter a valid email address.')
            return render(request, 'accounts/password_reset_form.html')

        # Rate limiting check
        if is_password_reset_rate_limited(request, email):
            messages.error(request, 'Too many password reset attempts. Please try again in 15 minutes.')
            return render(request, 'accounts/password_reset_form.html')

        # Get active users matching email
        users = UserModel.objects.filter(email__iexact=email, is_active=True)

        if users.count() == 1:
            user = users.first()
            send_reset_email_for_user(request, user)
            messages.success(request, "We've emailed you instructions for setting your password.")
            return redirect('login')

        elif users.count() > 1:
            users_data = []
            for u in users:
                masked_name = mask_username(u.username)
                outlet_name = ""
                if u.is_outlet_head and hasattr(u, 'outlet'):
                    outlet_name = u.outlet.name
                users_data.append({
                    'id': u.pk,
                    'masked_username': masked_name,
                    'is_outlet_head': u.is_outlet_head,
                    'outlet_name': outlet_name,
                })
            return render(request, 'accounts/password_reset_select.html', {
                'users_data': users_data,
                'email': email
            })
        else:
            # Prevent account enumeration: show success even if no active accounts match
            messages.success(request, "We've emailed you instructions for setting your password.")
            return redirect('login')

    return render(request, 'accounts/password_reset_form.html')

def password_reset_select(request):
    if request.method != 'POST':
        return redirect('password_reset')

    user_id = request.POST.get('user_id')
    email = request.POST.get('email', '').strip()

    if not user_id or not email:
        messages.error(request, 'Invalid request. Please try again.')
        return redirect('password_reset')

    # Rate limiting check
    if is_password_reset_rate_limited(request, email):
        messages.error(request, 'Too many password reset attempts. Please try again in 15 minutes.')
        return redirect('password_reset')

    try:
        # Fetch target user securely, enforcing matching email and is_active=True
        user = UserModel.objects.get(pk=user_id, email__iexact=email, is_active=True)
    except UserModel.DoesNotExist:
        # Handle tempering/invalid selection gracefully
        messages.error(request, 'Invalid account selection. Please try again.')
        return redirect('password_reset')

    send_reset_email_for_user(request, user)
    messages.success(request, "We've emailed you instructions for setting your password.")
    return redirect('login')

def password_reset_confirm(request, uidb64, token):
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = UserModel.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, UserModel.DoesNotExist):
        user = None

    # DEBUG LOGS BEFORE RESET
    print("\n================ PASSWORD RESET CONFIRM DEBUG ================")
    if user:
        print(f"[DEBUG] Loaded User ID: {user.pk}")
        print(f"[DEBUG] Username: {user.username}")
        print(f"[DEBUG] Email: {user.email}")
        print(f"[DEBUG] Password Hash before reset: {user.password}")
    else:
        print("[DEBUG] User not found.")
    print(f"[DEBUG] Token: {token}")

    token_valid = default_token_generator.check_token(user, token) if user else False
    print(f"[DEBUG] Is Token Valid? {token_valid}")

    if user is not None and token_valid:
        if request.method == 'POST':
            new_password = request.POST.get('new_password')
            confirm_password = request.POST.get('confirm_password')
            print(f"[DEBUG] POST request received. New password length: {len(new_password) if new_password else 0}")

            if new_password and confirm_password:
                if new_password != confirm_password:
                    print("[DEBUG] Passwords mismatch.")
                    messages.error(request, 'Passwords do not match. Please try again.')
                else:
                    try:
                        # Secure password strength validation using standard Django password validators
                        validate_password(new_password, user)
                        print("[DEBUG] Password validated successfully.")
                        
                        user.set_password(new_password)
                        print(f"[DEBUG] Called set_password. New Password Hash in memory: {user.password}")
                        
                        user.save()
                        print("[DEBUG] Called user.save() successfully.")
                        
                        # Verify from DB directly
                        db_user = UserModel.objects.get(pk=user.pk)
                        print(f"[DEBUG] Verifying DB state after save. Password Hash in DB: {db_user.password}")
                        
                        messages.success(request, 'Your password has been successfully reset! You can now log in.')
                        print("==============================================================\n")
                        return redirect('login')
                    except ValidationError as e:
                        print(f"[DEBUG] Password validation failed: {e.messages}")
                        for error in e.messages:
                            messages.error(request, error)
            else:
                messages.error(request, 'Please fill in both password fields.')

        print("==============================================================\n")
        return render(request, 'accounts/password_reset_confirm.html', {'validlink': True})
    else:
        print("[DEBUG] Link is invalid.")
        print("==============================================================\n")
        messages.error(request, 'The password reset link was invalid, possibly because it has already been used.')
        return render(request, 'accounts/password_reset_confirm.html', {'validlink': False})


# ---------------- CUSTOMER DASHBOARD ----------------
# @login_required
# def customer_home(request):
#     if not request.user.is_customer:
#         return redirect('login')

#     outlets = Outlet.objects.filter(is_approved=True)

#     return render(request, 'accounts/customer_home.html', {
#         'outlets': outlets
#     })
import time

@login_required_or_401
def customer_home(request):
    total_start = time.perf_counter()

    if not request.user.is_customer:
        return redirect('login')

    t1 = time.perf_counter()

    outlets = Outlet.objects.filter(is_approved=True)

    outlets = list(outlets)

    t2 = time.perf_counter()

    if request.headers.get('Accept') == 'application/json':
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

# ---------------- OUTLET HEAD DASHBOARD ----------------
def get_order_stats(outlet):
    from django.db.models import Sum
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    valid_orders = Order.objects.filter(
        outlet=outlet, 
        payment_status__in=['paid', 'SUCCESS', 'PAID']
    ).exclude(status='cancelled')

    today_orders = valid_orders.filter(created_at__gte=today_start)
    week_orders = valid_orders.filter(created_at__gte=week_start)
    month_orders = valid_orders.filter(created_at__gte=month_start)

    def total_collection(qs):
        return qs.aggregate(Sum('actual_amount'))['actual_amount__sum'] or 0

    return {
        'today_orders': valid_orders.exclude(status='delivered').count(),
        'today_collection': total_collection(today_orders),
        'week_collection': total_collection(week_orders),
        'month_collection': total_collection(month_orders),
    }

@login_required_or_401
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

    if request.headers.get('Accept') == 'application/json':
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
    user = getattr(request, 'user', None)
    is_authenticated = bool(user and getattr(user, 'is_authenticated', False))
    is_owner = (
        is_authenticated
        and getattr(user, 'is_outlet_head', False)
        and getattr(user, 'outlet', None) == outlet
    )

    # Customers (and anonymous users) must not see unapproved outlets.
    if not outlet.is_approved and not is_owner and not getattr(user, 'is_staff', False):
        return redirect('customer_home')

    ui = getattr(outlet, 'ui', None)

    categories = Category.objects.filter(
        outlet=outlet,
        is_active=True
    ).prefetch_related(
        Prefetch('products', queryset=Product.objects.filter(is_available=True))
    )

    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
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
                            'product_name': p.name,
                            'customer_price': float(p.customer_price),
                            'price': float(p.customer_price),
                            'is_available': p.is_available,
                            'image_url': p.image.url if p.image else None
                        } for p in c.products.all()
                    ]
                } for c in categories
            ]
        })

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
@csrf_exempt
@login_required_or_401
def add_category(request):
    if not getattr(request.user, 'is_outlet_head', False):
        return JsonResponse({'success': False, 'error': 'Unauthorized: Not an outlet operator'}, status=403)
    if _is_pending_outlet_user(request.user):
        return JsonResponse({'success': False, 'error': 'Account pending approval'}, status=403)
    outlet = getattr(request.user, 'outlet', None)
    if not outlet:
        return JsonResponse({'success': False, 'error': 'No outlet associated with this account'}, status=400)

    if request.method == 'POST':
        name = request.POST.get('name')
        if not name:
            try:
                body = json.loads(request.body.decode('utf-8'))
                name = body.get('name')
            except Exception:
                pass

        if not name or not name.strip():
            return JsonResponse({'success': False, 'error': 'Category name cannot be empty.'}, status=400)

        name = name.strip()
        existing = Category.objects.filter(outlet=outlet, name__iexact=name).first()
        if existing:
            if not existing.is_active:
                existing.is_active = True
                existing.save(update_fields=['is_active'])
                return JsonResponse({'success': True, 'category': {'id': existing.id, 'name': existing.name, 'products': []}, 'message': f'Category "{name}" reactivated.'})
            return JsonResponse({'success': False, 'error': f'Category "{name}" already exists.'}, status=400)

        cat = Category.objects.create(outlet=outlet, name=name, is_active=True)
        return JsonResponse({
            'success': True,
            'category': {
                'id': cat.id,
                'name': cat.name,
                'products': []
            },
            'message': f'Category "{name}" added successfully.'
        })

    return redirect('outlet_home')


@csrf_exempt
@login_required_or_401
def delete_category(request, category_id):
    if not getattr(request.user, 'is_outlet_head', False):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    if _is_pending_outlet_user(request.user):
        return JsonResponse({'success': False, 'error': 'Account pending approval'}, status=403)

    category = get_object_or_404(
        Category,
        id=category_id,
        outlet=getattr(request.user, 'outlet', None)
    )

    cat_name = category.name
    category.delete()
    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', '') or request.method == 'POST':
        return JsonResponse({'success': True, 'message': f'Category "{cat_name}" deleted successfully.'})
    return redirect('outlet_products')


# ---------------- PRODUCT MANAGEMENT ----------------
@csrf_exempt
@login_required_or_401
def add_product(request):
    if not getattr(request.user, 'is_outlet_head', False):
        return JsonResponse({'success': False, 'error': 'Unauthorized: Not an outlet operator'}, status=403)
    if _is_pending_outlet_user(request.user):
        return JsonResponse({'success': False, 'error': 'Account pending approval'}, status=403)

    outlet = getattr(request.user, 'outlet', None)
    if not outlet:
        return JsonResponse({'success': False, 'error': 'No outlet associated with this account'}, status=400)

    if request.method == 'POST':
        name = (request.POST.get('name') or '').strip()
        price_val = request.POST.get('price')
        category_id = request.POST.get('category')

        if not name:
            return JsonResponse({'success': False, 'error': 'Product name is required.'}, status=400)
        if not price_val:
            return JsonResponse({'success': False, 'error': 'Product price is required.'}, status=400)
        if not category_id:
            return JsonResponse({'success': False, 'error': 'Please select a valid category.'}, status=400)

        try:
            price = float(price_val)
            if price < 0:
                return JsonResponse({'success': False, 'error': 'Price cannot be negative.'}, status=400)
        except (ValueError, TypeError):
            return JsonResponse({'success': False, 'error': 'Invalid price format.'}, status=400)

        try:
            category = Category.objects.get(id=category_id, outlet=outlet)
        except Category.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Selected category does not exist for this outlet.'}, status=404)

        product = Product.objects.create(
            outlet=outlet,
            category=category,
            name=name,
            price=price
        )
        if request.FILES.get('image'):
            product.image = request.FILES.get('image')
            product.save()

        return JsonResponse({
            'success': True,
            'message': f'Product "{product.name}" added successfully.',
            'product': {
                'id': product.id,
                'name': product.name,
                'customer_price': float(product.customer_price),
                'price': float(product.price),
                'is_available': product.is_available,
                'image_url': product.image.url if product.image else None,
                'category_id': category.id
            }
        })

    return redirect('outlet_home')


@csrf_exempt
@login_required_or_401
def delete_product(request, product_id):
    if not getattr(request.user, 'is_outlet_head', False):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    if _is_pending_outlet_user(request.user):
        return JsonResponse({'success': False, 'error': 'Account pending approval'}, status=403)

    product = get_object_or_404(Product, id=product_id, outlet=getattr(request.user, 'outlet', None))
    prod_id = product.id
    prod_name = product.name
    product.delete()

    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            "customers",
            {
                "type": "product_deactivated",
                "product_id": prod_id,
                "product_name": prod_name,
            }
        )
    except Exception:
        pass

    return JsonResponse({'success': True, 'message': f'Product "{prod_name}" deleted successfully.'})


   # updates in march
@login_required  
def product_detail(request, product_id):
    product = get_object_or_404(Product, id=product_id)
    return render(request, 'accounts/product_detail.html', {'product': product})

@csrf_exempt
@login_required_or_401
def add_to_cart(request, product_id):
    product = get_object_or_404(Product.objects.select_related('outlet'), id=product_id)

    is_ajax = (
        request.headers.get('x-requested-with') == 'XMLHttpRequest' 
        or 'application/json' in request.headers.get('Accept', '') 
        or request.GET.get('ajax') == '1'
    )

    if not product.is_available:
        if is_ajax:
            return JsonResponse({'success': False, 'message': 'Product is unavailable'}, status=400)
        return redirect('outlet_detail', product.outlet.id)

    cart, _ = Cart.objects.get_or_create(user=request.user)

    # Check if cart already has items from another outlet in 1 query
    first_item = cart.items.select_related('product').first()
    if first_item and first_item.product.outlet_id != product.outlet_id:
        cart.items.all().delete()
        messages.info(request, f"Your cart was cleared to add items from {product.outlet.name}")

    item, created = CartItem.objects.get_or_create(
        cart=cart,
        product=product
    )

    if not created:
        item.quantity += 1
        item.save(update_fields=['quantity'])

    if is_ajax:
        return JsonResponse({
            'success': True, 
            'message': f'{product.name} added to cart.',
            'item_id': item.id,
            'quantity': item.quantity
        })

    return redirect('cart')

@csrf_exempt
@login_required_or_401
def cart_view(request):
    cart, created = Cart.objects.get_or_create(user=request.user)
    items = cart.items.select_related('product__outlet').all()

    total = sum(item.total_price() for item in items)
    can_order = all(item.product.is_available for item in items) and bool(items)

    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
        return JsonResponse({
            'success': True,
            'items': [
                {
                    'id': item.id,
                    'product_id': item.product.id,
                    'product_name': item.product.name,
                    'name': item.product.name,
                    'product_price': float(item.product.customer_price),
                    'price': float(item.product.customer_price),
                    'quantity': item.quantity,
                    'total_price': float(item.total_price()),
                    'is_available': item.product.is_available,
                    'image_url': item.product.image.url if item.product.image else None,
                    'outlet_name': item.product.outlet.name
                } for item in items
            ],
            'total': float(total),
            'total_price': float(total),
            'can_order': can_order,
            'razorpay_key_id': getattr(settings, "RAZORPAY_KEY_ID", "")
        })
    return render(request, 'accounts/cart.html', {
        'items': items,
        'total': total,
        'can_order': can_order,
        'razorpay_key_id': getattr(settings, "RAZORPAY_KEY_ID", "")
    })

@csrf_exempt
@login_required_or_401
@require_POST
def create_razorpay_order(request):
    """
    Creates a Razorpay payment order and simultaneously snapshots the cart
    into an internal Order + OrderItems. This is the source of truth for what
    was purchased — the callback/webhook must NEVER re-read the cart.

    Flow:
      1. Read cart & validate items.
      2. Inside transaction.atomic():
         a. Create internal Order with amounts.
         b. Create OrderItems (snapshot: unit_price + platform_fee captured NOW).
         c. Call Razorpay API to create the payment order.
         d. Store razorpay_order_id on the internal Order.
      3. Return razorpay_order_id + amount to frontend.
    """
    cart = get_object_or_404(Cart, user=request.user)
    items = list(cart.items.select_related('product').all())  # evaluate now

    if not items:
        return JsonResponse({"success": False, "error": "Cart is empty"}, status=400)

    for item in items:
        if not item.product.is_available:
            return JsonResponse({"success": False, "error": f"{item.product.name} is unavailable"}, status=400)

    outlet = items[0].product.outlet

    # Calculate amounts from the cart snapshot
    actual_amount = sum(item.outlet_total() for item in items)
    platform_fee = sum(item.platform_fee_total() for item in items)
    total_amount = sum(item.total_price() for item in items)
    amount_in_paisa = int(total_amount * 100)

    try:
        with transaction.atomic():
            # Step 1: Create the internal Order record
            order = Order.objects.create(
                user=request.user,
                outlet=outlet,
                total_amount=total_amount,
                actual_amount=actual_amount,
                platform_fee=platform_fee,
                status="pending",
                payment_status="unpaid"
            )

            # Step 2: Snapshot the cart into OrderItems RIGHT NOW.
            # These records are the immutable source of truth for what was ordered.
            # The cart may change after this point — it will NOT affect this order.
            for item in items:
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    quantity=item.quantity,
                    unit_price=item.product.price,           # base price snapshot
                    platform_fee=item.product.get_platform_fee()  # fee snapshot
                )

            # Step 3: Create the Razorpay order using the exact same amount
            # that is stored on the internal Order.
            key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
            key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)

            if not key_id or not key_secret:
                if settings.DEBUG:
                    import uuid
                    rzp_id = f"order_dev_{uuid.uuid4().hex[:14]}"
                    order.razorpay_order_id = rzp_id
                    order.save(update_fields=["razorpay_order_id"])
                    return JsonResponse({
                        "success": True,
                        "razorpay_order_id": rzp_id,
                        "amount": amount_in_paisa,
                        "key": "rzp_test_placeholder",
                        "dev_mode": True
                    })
                return JsonResponse({"success": False, "error": "Razorpay credentials are not configured."}, status=500)

            client = razorpay.Client(auth=(key_id, key_secret))
            razorpay_order = client.order.create({
                "amount": amount_in_paisa,
                "currency": "INR",
                "payment_capture": 1
            })

            # Step 4: Link the Razorpay order ID to our internal Order
            order.razorpay_order_id = razorpay_order["id"]
            order.save(update_fields=["razorpay_order_id"])

    except Exception as e:
        print("CREATE_RAZORPAY_ORDER ERROR:", e)
        return JsonResponse({"success": False, "error": "Failed to create payment order. Please check gateway config."}, status=500)

    return JsonResponse({
        "success": True,
        "razorpay_order_id": razorpay_order["id"],
        "amount": amount_in_paisa,
        "key": getattr(settings, "RAZORPAY_KEY_ID", "")
    })



    
@csrf_exempt
@login_required_or_401
def remove_from_cart(request, item_id):
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    item.delete()
    if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'message': 'Item removed from cart.'})
    return redirect('cart')

@login_required
def place_order(request):
    # This was the old way without razorpay, now moved to payment_callback.
    # Keep it as fallback if needed or just redirect.
    return redirect('cart')


@csrf_exempt
def payment_callback(request):
    """
    Razorpay payment callback handler.

    Security & correctness guarantees:
    ─────────────────────────────────
    1. OrderItems are NEVER rebuilt from the current cart here.
       They were already snapshotted in create_razorpay_order().
    2. The Razorpay payment amount is verified against the amount stored
       on the internal Order (server-side truth) — not from the frontend.
    3. select_for_update() prevents duplicate processing on concurrent callbacks.
    4. If the Order is already marked 'paid', we return immediately (idempotent).
    5. The cart is cleared only after the Order is successfully confirmed as paid.
    """
    is_json = 'application/json' in request.headers.get('Accept', '')

    if request.method != "POST":
        if is_json: return JsonResponse({"success": False, "error": "Invalid request method."})
        return redirect("cart")

    payment_id = request.POST.get("razorpay_payment_id", "")
    razorpay_order_id = request.POST.get("razorpay_order_id", "")
    signature = request.POST.get("razorpay_signature", "")

    if not payment_id or not razorpay_order_id or not signature:
        if is_json: return JsonResponse({"success": False, "error": "Invalid payment response."})
        messages.error(request, "Invalid payment response.")
        return redirect("cart")

    is_dev_order = razorpay_order_id.startswith("order_dev_") and settings.DEBUG
    client = None

    if not is_dev_order:
        key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
        key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
        if not key_id or not key_secret:
            if is_json: return JsonResponse({"success": False, "error": "Payment credentials not configured."})
            messages.error(request, "Payment credentials not configured.")
            return redirect("cart")

        client = razorpay.Client(auth=(key_id, key_secret))
        params_dict = {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": payment_id,
            "razorpay_signature": signature
        }

        try:
            # ── Step 1: Verify HMAC signature ────────────────────────────────────
            client.utility.verify_payment_signature(params_dict)
        except razorpay.errors.SignatureVerificationError:
            if is_json: return JsonResponse({"success": False, "error": "Payment verification failed."})
            messages.error(request, "Payment verification failed.")
            return redirect("cart")
        except Exception as e:
            print("PAYMENT_CALLBACK SIGNATURE ERROR:", e)
            if is_json: return JsonResponse({"success": False, "error": "Something went wrong during payment verification."})
            messages.error(request, "Something went wrong during payment verification.")
            return redirect("cart")

    try:
        with transaction.atomic():
            # ── Step 2: Load the Order using the Razorpay order ID ───────────
            # select_for_update() locks the row, preventing duplicate processing
            # if the callback is fired more than once concurrently.
            try:
                order = (
                    Order.objects
                    .select_for_update()
                    .get(razorpay_order_id=razorpay_order_id)
                )
            except Order.DoesNotExist:
                if is_json: return JsonResponse({"success": False, "error": "Order not found."})
                messages.error(request, "Order not found.")
                return redirect("cart")

            # ── Step 3: Idempotency guard ─────────────────────────────────────
            # If this order is already paid (callback received before), do nothing.
            if order.payment_status == "paid":
                if is_json: return JsonResponse({"success": True, "redirect_url": "/orders"})
                return redirect("customer_orders")

            # ── Step 4: Server-side amount verification ───────────────────────
            if not is_dev_order and client:
                try:
                    rzp_payment = client.payment.fetch(payment_id)
                    rzp_amount_paisa = rzp_payment.get("amount", 0)
                    expected_amount_paisa = int(order.total_amount * 100)
                    if rzp_amount_paisa != expected_amount_paisa:
                        if is_json: return JsonResponse({"success": False, "error": "Payment amount mismatch."})
                        messages.error(request, "Payment amount mismatch.")
                        return redirect("cart")
                except Exception as err:
                    print(f"PAYMENT_CALLBACK: Amount check skipped (non-fatal): {err}")

            # ── Step 5: Verify order has items (the snapshot must exist) ──────
            # The OrderItems were created in create_razorpay_order().
            # We do NOT create OrderItems here. If they are missing, something
            # went wrong during order creation — do not proceed.
            if not order.items.exists():
                print(f"PAYMENT_CALLBACK: Order {order.id} has no items — refusing to mark paid.")
                if is_json: return JsonResponse({"success": False, "error": "Order has no items. Please contact support."})
                messages.error(request, "Order has no items. Please contact support.")
                return redirect("cart")

            # ── Step 6: Mark the Order as paid ───────────────────────────────
            order.payment_status = "paid"
            order.razorpay_payment_id = payment_id
            order.razorpay_signature = signature
            order.status = "preparing"  # 🔥 payment success → immediately preparing
            order.save(update_fields=[
                "payment_status",
                "razorpay_payment_id",
                "razorpay_signature",
                "status"
            ])

            # ── Step 7: Clear the cart ────────────────────────────────────────
            # Only clear CartItems belonging to this order's outlet.
            # This correctly handles the case where the user added items from a
            # different outlet in another tab while this payment was in progress.
            try:
                cart = Cart.objects.get(user=order.user)
                # Remove only items that belong to this order's outlet
                cart.items.filter(product__outlet=order.outlet).delete()
            except Cart.DoesNotExist:
                pass  # Cart may have already been cleared or never existed

        # ── Step 8: WebSocket notification to outlet ─────────────────────────
        # Done outside the atomic block so a WebSocket failure doesn't roll back
        # the already-committed payment.
        try:
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
        except Exception as ws_error:
            print(f"PAYMENT_CALLBACK WEBSOCKET ERROR (non-fatal): {ws_error}")

        if is_json: return JsonResponse({"success": True, "redirect_url": "/orders"})
        messages.success(request, "Payment successful! Order placed.")
        return redirect("customer_orders")

    except Exception as e:
        print("PAYMENT CALLBACK ERROR:", e)
        import traceback
        traceback.print_exc()
        if is_json: return JsonResponse({"success": False, "error": "Something went wrong while confirming your order. Please try again."})
        messages.error(request, "Something went wrong while confirming your order. Please try again.")
        return redirect("cart")



# ──────────────────────────────────────────────────────────────────────────────
# RAZORPAY WEBHOOK
# ──────────────────────────────────────────────────────────────────────────────
# This endpoint is called by Razorpay's servers (not the browser).
# It is a server-to-server safety net for cases where payment_callback()
# was never reached (network drop, tab closed, etc.).
#
# Security model
# ──────────────
# 1. Raw body is read ONCE and used for HMAC-SHA256 verification before any
#    JSON parsing — prevents body-substitution attacks.
# 2. RAZORPAY_WEBHOOK_SECRET is never hardcoded; it is loaded from settings
#    which reads it exclusively from the environment / .env file.
# 3. select_for_update() inside transaction.atomic() prevents duplicate
#    processing when both payment_callback() and the webhook fire together.
# 4. OrderItems are NEVER created here — they were snapshotted in
#    create_razorpay_order(). This view only flips payment_status to "paid".
# ──────────────────────────────────────────────────────────────────────────────

import hmac
import hashlib
import json as _json

@csrf_exempt
def payment_webhook(request):
    """
    Razorpay server-to-server webhook handler.

    Registers at: /app/payment/webhook/
    Configure in Razorpay Dashboard → Webhooks → Active events:
      ✅ payment.captured
      ✅ order.paid   (optional but recommended)

    Authentication: HMAC-SHA256 of raw request body using RAZORPAY_WEBHOOK_SECRET.
    """
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    # ── 1. Reject if webhook secret is not configured ─────────────────────────
    webhook_secret = getattr(settings, "RAZORPAY_WEBHOOK_SECRET", None)
    if not webhook_secret:
        # Misconfiguration — log loudly but return 500 so Razorpay retries
        print("WEBHOOK: RAZORPAY_WEBHOOK_SECRET is not set in settings/env.")
        return JsonResponse({"error": "Webhook not configured"}, status=500)

    # ── 2. Read raw body (must happen before any framework parsing) ───────────
    raw_body = request.body  # bytes

    # ── 3. Verify Razorpay webhook signature ──────────────────────────────────
    received_signature = request.headers.get("X-Razorpay-Signature", "")
    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(expected_signature, received_signature):
        print(f"WEBHOOK: Signature mismatch — possible spoofed request.")
        return JsonResponse({"error": "Invalid signature"}, status=400)

    # ── 4. Parse JSON payload ─────────────────────────────────────────────────
    try:
        payload = _json.loads(raw_body.decode("utf-8"))
    except (_json.JSONDecodeError, UnicodeDecodeError) as e:
        print(f"WEBHOOK: Failed to parse payload: {e}")
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    event = payload.get("event", "")
    print(f"WEBHOOK: Received event '{event}'")

    # ── 5. Only handle payment.captured and order.paid ────────────────────────
    if event not in ("payment.captured", "order.paid"):
        # Acknowledge unknown events so Razorpay does not keep retrying them
        return JsonResponse({"status": "ignored", "event": event}, status=200)

    # ── 6. Extract the Razorpay order ID from the payload ────────────────────
    try:
        if event == "payment.captured":
            razorpay_order_id = payload["payload"]["payment"]["entity"]["order_id"]
            payment_id        = payload["payload"]["payment"]["entity"]["id"]
            rzp_amount_paisa  = payload["payload"]["payment"]["entity"]["amount"]
        else:  # order.paid
            razorpay_order_id = payload["payload"]["order"]["entity"]["id"]
            payment_id        = payload["payload"]["payment"]["entity"]["id"]
            rzp_amount_paisa  = payload["payload"]["payment"]["entity"]["amount"]
    except (KeyError, TypeError) as e:
        print(f"WEBHOOK: Unexpected payload structure for event '{event}': {e}")
        return JsonResponse({"error": "Unexpected payload structure"}, status=400)

    # ── 7. Find our internal Order ────────────────────────────────────────────
    try:
        with transaction.atomic():
            # select_for_update() locks the row — prevents a race condition where
            # payment_callback() and the webhook both try to mark the order paid
            # at the same time.
            try:
                order = (
                    Order.objects
                    .select_for_update()
                    .get(razorpay_order_id=razorpay_order_id)
                )
            except Order.DoesNotExist:
                # Razorpay may fire the webhook before our DB has committed the
                # order (very rare). Return 200 so Razorpay does not blacklist
                # our endpoint; it will retry automatically.
                print(f"WEBHOOK: Order not found for razorpay_order_id={razorpay_order_id}")
                return JsonResponse({"status": "order_not_found"}, status=200)

            # ── 8. Idempotency guard ──────────────────────────────────────────
            # If payment_callback() already handled this, do nothing.
            if order.payment_status == "paid":
                print(f"WEBHOOK: Order {order.id} already paid — skipping.")
                return JsonResponse({"status": "already_paid"}, status=200)

            # ── 9. Server-side amount verification ────────────────────────────
            expected_amount_paisa = int(order.total_amount * 100)
            if rzp_amount_paisa != expected_amount_paisa:
                print(
                    f"WEBHOOK AMOUNT MISMATCH: Order {order.id} "
                    f"expected {expected_amount_paisa} paisa, "
                    f"got {rzp_amount_paisa} paisa."
                )
                return JsonResponse({"error": "Amount mismatch"}, status=400)

            # ── 10. Verify snapshot items exist ───────────────────────────────
            if not order.items.exists():
                print(f"WEBHOOK: Order {order.id} has no items — cannot confirm.")
                return JsonResponse({"error": "Order has no items"}, status=400)

            # ── 11. Mark order as paid ────────────────────────────────────────
            order.payment_status      = "paid"
            order.razorpay_payment_id = payment_id
            order.status              = "preparing"
            order.save(update_fields=[
                "payment_status",
                "razorpay_payment_id",
                "status",
            ])

            # ── 12. Clear cart (surgical — only this outlet's items) ──────────
            try:
                cart = Cart.objects.get(user=order.user)
                cart.items.filter(product__outlet=order.outlet).delete()
            except Cart.DoesNotExist:
                pass  # already cleared by payment_callback(), or never existed

        # ── 13. WebSocket notification — outside atomic block ─────────────────
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"outlet_{order.outlet.id}",
                {
                    "type": "new_order",
                    "order_id": order.id,
                    "customer_name": order.user.username,
                    "total_amount": str(order.total_amount),
                }
            )
        except Exception as ws_err:
            print(f"WEBHOOK WEBSOCKET ERROR (non-fatal): {ws_err}")

        print(f"WEBHOOK: Order {order.id} successfully confirmed via webhook.")
        return JsonResponse({"status": "ok"}, status=200)

    except Exception as e:
        import traceback as _tb
        print(f"WEBHOOK ERROR: {e}")
        _tb.print_exc()
        # Return 500 so Razorpay retries the webhook delivery
        return JsonResponse({"error": "Internal server error"}, status=500)



@login_required_or_401
def customer_orders(request):
    if not request.user.is_customer:
        return redirect('login')
    
    # Only show orders that are not unpaid (e.g., paid, cancelled, pending but not unpaid)
    orders = Order.objects.filter(user=request.user).exclude(payment_status='unpaid').select_related('outlet', 'token').prefetch_related('items__product').order_by('-created_at')
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

    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
        return JsonResponse({
            'success': True,
            'orders': [
                {
                    'id': o.id,
                    'status': o.status,
                    'payment_status': o.payment_status,
                    'total_amount': float(o.total_amount),
                    'total_price': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'completed_at': o.completed_at.isoformat() if o.completed_at else None,
                    'outlet_name': o.outlet.name,
                    'token_number': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'token': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'items': [
                        {
                            'id': i.id,
                            'product_name': i.product.name if i.product else getattr(i, 'product_name', 'Item'),
                            'name': i.product.name if i.product else getattr(i, 'product_name', 'Item'),
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
                'token': str(popup_token.token_no),
                'outlet_name': popup_token.outlet.name,
                'remaining_seconds': getattr(popup_token, 'remaining_seconds', 0)
            } if popup_token else None
        })
    return render(request, 'accounts/customer_orders.html', {'orders': orders, 'popup_token': popup_token})

@csrf_exempt
@login_required_or_401
def cancel_order(request, order_id):
    order = get_object_or_404(Order, id=order_id, user=request.user)
    if order.status == 'pending':
        if request.method == 'POST':
            order.status = 'cancelled'
            order.cancelled_by = 'customer'
            order.save()
            if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
                return JsonResponse({'success': True, 'status': 'cancelled'})
    if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'success': False, 'error': 'Cannot cancel this order.'})
    return redirect('customer_orders')

@login_required_or_401
def outlet_orders(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet

    orders = Order.objects.filter(
        outlet=outlet,
        payment_status__in=['paid', 'SUCCESS', 'PAID']
    ).exclude(status='delivered').select_related('user').prefetch_related(
        'items__product', 'token'
    ).order_by('-created_at')

    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
        return JsonResponse({
            'success': True,
            'orders': [
                {
                    'id': o.id,
                    'status': o.status,
                    'payment_status': o.payment_status,
                    'total_amount': float(o.total_amount),
                    'total_price': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'completed_at': o.completed_at.isoformat() if o.completed_at else None,
                    'customer_name': o.user.username if o.user else "Guest",
                    'token_number': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'token': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'items': [
                        {
                            'id': i.id,
                            'product_name': i.product.name if i.product else getattr(i, 'product_name', 'Item'),
                            'name': i.product.name if i.product else getattr(i, 'product_name', 'Item'),
                            'quantity': i.quantity,
                            'price': float(i.unit_price)
                        } for i in o.items.all()
                    ]
                } for o in orders
            ]
        })
    return render(request, 'accounts/outlet_orders.html', {
        'orders': orders
    }) 

@login_required_or_401
def outlet_delivered_orders(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')
        
    outlet = request.user.outlet
    now = timezone.now()
    
    filter_val = request.GET.get('time_filter', 'all')
    orders = Order.objects.filter(
        outlet=outlet,
        status='delivered',
        payment_status__in=['paid', 'SUCCESS', 'PAID']
    ).select_related('user').prefetch_related(
        'items__product', 'token'
    ).order_by('-completed_at')
    
    if filter_val == '1h':
        orders = orders.filter(completed_at__gte=now - timedelta(hours=1))
    elif filter_val == '3h':
        orders = orders.filter(completed_at__gte=now - timedelta(hours=3))
    elif filter_val == '6h':
        orders = orders.filter(completed_at__gte=now - timedelta(hours=6))
    elif filter_val == 'today':
        orders = orders.filter(completed_at__gte=now.replace(hour=0, minute=0, second=0, microsecond=0))
    elif filter_val == 'yesterday':
        yesterday = now - timedelta(days=1)
        start = yesterday.replace(hour=0, minute=0, second=0, microsecond=0)
        end = now.replace(hour=0, minute=0, second=0, microsecond=0)
        orders = orders.filter(completed_at__gte=start, completed_at__lt=end)
    elif filter_val in ('week', 'this_week'):
        week_start = (now - timedelta(days=now.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
        orders = orders.filter(completed_at__gte=week_start)
    elif filter_val in ('month', 'this_month'):
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        orders = orders.filter(completed_at__gte=month_start)
        
    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
        return JsonResponse({
            'success': True,
            'orders': [
                {
                    'id': o.id,
                    'status': o.status,
                    'payment_status': o.payment_status,
                    'total_amount': float(o.total_amount),
                    'total_price': float(o.total_amount),
                    'created_at': o.created_at.isoformat(),
                    'completed_at': o.completed_at.isoformat() if o.completed_at else None,
                    'customer_name': o.user.username if o.user else "Guest",
                    'token_number': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'token': str(getattr(o, 'token', None).token_no) if getattr(o, 'token', None) else None,
                    'items': [
                        {
                            'id': i.id,
                            'product_name': i.product.name if i.product else getattr(i, 'product_name', 'Item'),
                            'name': i.product.name if i.product else getattr(i, 'product_name', 'Item'),
                            'quantity': i.quantity,
                            'price': float(i.unit_price)
                        } for i in o.items.all()
                    ]
                } for o in orders
            ]
        })
    return render(request, 'accounts/outlet_delivered_orders.html', {
        'orders': orders,
        'filter_val': filter_val
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
            next_no = random.randint(1, 999)
            if OrderToken.objects.filter(outlet=outlet, token_date=token_date, token_no=next_no).exists():
                continue
            
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
                # Likely a race condition; retry with a new token number.
                continue

    # If we reached here, something is wrong (repeated unique constraint collisions).
    raise IntegrityError("Could not generate a unique token number for the order.")


def _token_expires_at(token: OrderToken):
    completed_at = getattr(token.order, "completed_at", None) or token.created_at
    return completed_at + TOKEN_VISIBLE_FOR


def _token_remaining_seconds(token: OrderToken):
    remaining = (_token_expires_at(token) - timezone.now()).total_seconds()
    return int(remaining) if remaining > 0 else 0

@csrf_exempt
@login_required_or_401
def update_order_status(request, order_id):
    if not getattr(request.user, 'is_outlet_head', False):
        return JsonResponse({'success': False, 'error': 'Unauthorized: Not an outlet operator'}, status=403)
    if _is_pending_outlet_user(request.user):
        return JsonResponse({'success': False, 'error': 'Account pending approval'}, status=403)
    
    outlet = getattr(request.user, 'outlet', None)
    if not outlet:
        return JsonResponse({'success': False, 'error': 'No outlet associated with this account'}, status=400)

    order = get_object_or_404(Order, id=order_id, outlet=outlet)
    if request.method == 'POST':
        new_status = request.POST.get('status')
        if not new_status:
            try:
                body = json.loads(request.body.decode('utf-8'))
                new_status = body.get('status')
            except Exception:
                pass
        
        if new_status == 'ready':
            new_status = 'completed'
        
        old_status = order.status
        if new_status in ['pending', 'preparing', 'completed', 'delivered', 'cancelled']:
            order.status = new_status
            if new_status == 'cancelled':
                order.cancelled_by = 'outlet'
            if new_status == 'completed' and old_status != 'completed':
                order.completed_at = timezone.now()
            order.save()

            token_no = None
            if new_status == 'completed':
                # Generate token only when an order becomes "completed".
                token_obj = generate_token_for_order(order)
                if token_obj:
                    token_no = token_obj.token_no
            
            # Trigger WebSocket notifications for status change to both customer and outlet
            try:
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"user_{order.user.id}",
                        {
                            "type": "order_update",
                            "order_id": order.id,
                            "status": new_status,
                            "token_no": token_no,
                            "message": f"Your order status is now: {new_status}"
                        }
                    )
                    async_to_sync(channel_layer.group_send)(
                        f"outlet_{outlet.id}",
                        {
                            "type": "order_update",
                            "order_id": order.id,
                            "status": new_status,
                            "token_no": token_no
                        }
                    )
            except Exception as ws_err:
                print("WS broadcast warning:", ws_err)

            return JsonResponse({'success': True, 'status': order.status, 'token_no': token_no})
    return JsonResponse({'success': False, 'error': 'Invalid request'}, status=400)


@login_required_or_401
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

    if request.headers.get('Accept') == 'application/json':
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
    return render(request, 'accounts/customer_token.html', {
        'tokens': tokens,
        'popup_token': popup_token,
    })
    
    
@csrf_exempt
@login_required_or_401
def increase_quantity(request, item_id):
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    item.quantity += 1
    item.save()
    if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
        return JsonResponse({'success': True, 'quantity': item.quantity})
    return redirect('cart')
    
    
@csrf_exempt
@login_required_or_401
def decrease_quantity(request, item_id):
    item = get_object_or_404(CartItem, id=item_id, cart__user=request.user)
    if item.quantity > 1:
        item.quantity -= 1
        item.save()
        if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'quantity': item.quantity})
    else:
        item.delete()
        if 'application/json' in request.headers.get('Accept', '') or request.headers.get('x-requested-with') == 'XMLHttpRequest':
            return JsonResponse({'success': True, 'quantity': 0, 'deleted': True})

    return redirect('cart')

# ---------------- PRODUCT AVAILABILITY MANAGEMENT ----------------

@login_required_or_401
def outlet_products_view(request):
    if not request.user.is_outlet_head:
        return redirect('login')
    if _is_pending_outlet_user(request.user):
        logout(request)
        return redirect('login')

    outlet = request.user.outlet
    categories = Category.objects.filter(outlet=outlet).prefetch_related('products')
    
    if request.headers.get('Accept') == 'application/json':
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
    return render(request, 'accounts/outlet_products.html', {
        'outlet': outlet,
        'categories': categories,
    })

@csrf_exempt
@login_required_or_401
def toggle_availability(request, product_id):
    if not getattr(request.user, 'is_outlet_head', False):
        return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=403)
    if _is_pending_outlet_user(request.user):
        return JsonResponse({'success': False, 'error': 'Account pending approval'}, status=403)
    
    product = get_object_or_404(Product, id=product_id, outlet=getattr(request.user, 'outlet', None))
    
    if request.method == 'POST':
        product.is_available = not product.is_available
        product.save()

        if not product.is_available:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                "customers",
                {
                    "type": "product_deactivated",
                    "product_id": product.id,
                    "product_name": product.name,
                }
            )
            
        return JsonResponse({'success': True, 'is_available': product.is_available})
    return JsonResponse({'success': False, 'error': 'Invalid request'})

@csrf_exempt
@login_required_or_401
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


@csrf_exempt
@login_required_or_401
@require_POST
def reorder(request, order_id):
    if not request.user.is_customer:
        if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
            return JsonResponse({'success': False, 'error': 'Unauthorized'}, status=401)
        return redirect('login')
    
    old_order = get_object_or_404(Order, id=order_id, user=request.user)
    cart, _ = Cart.objects.get_or_create(user=request.user)
    
    # Check if cart has items from a different outlet
    if cart.items.exists():
        existing_outlet = cart.items.first().product.outlet
        if existing_outlet != old_order.outlet:
            # Clear cart to ensure reorder works smoothly with the correct outlet
            cart.items.all().delete()
            messages.info(request, f"Your cart was cleared to add items from {old_order.outlet.name}.")
    
    unavailable_items = []
    
    for order_item in old_order.items.all():
        if order_item.product.is_available:
            cart_item, created = CartItem.objects.get_or_create(
                cart=cart,
                product=order_item.product,
                defaults={'quantity': order_item.quantity}
            )
            if not created:
                cart_item.quantity += order_item.quantity
                cart_item.save()
        else:
            unavailable_items.append(order_item.product.name)
            
    if unavailable_items:
        msg = f"The following items are no longer available: {', '.join(unavailable_items)}"
        messages.warning(request, msg)
    else:
        msg = "Items successfully added to your cart."
        messages.success(request, msg)
        
    if request.headers.get('Accept') == 'application/json' or 'application/json' in request.headers.get('Accept', ''):
        return JsonResponse({'success': True, 'redirect_url': '/cart', 'message': msg})
        
    return redirect('cart')

