import os
import re

# 1. Update frontend/src/app/outlet/orders/page.tsx
orders_file = 'frontend/src/app/outlet/orders/page.tsx'
with open(orders_file, 'r') as f:
    content = f.read()

content = content.replace(
    'handleUpdateStatus(order.id, "ready")',
    'handleUpdateStatus(order.id, "completed")'
)
content = content.replace(
    'order.status === "ready"',
    'order.status === "completed"'
)
content = content.replace(
    'case "ready": return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Ready</span>;',
    'case "completed": return <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">Ready</span>;'
)
with open(orders_file, 'w') as f:
    f.write(content)

# 2. Update frontend/src/app/outlet/home/page.tsx (Monthly collection)
home_file = 'frontend/src/app/outlet/home/page.tsx'
with open(home_file, 'r') as f:
    content = f.read()

if 'This Month Revenue' not in content:
    monthly_card = """
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
              <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-4 text-xl">
                <i className="fa-solid fa-calendar-days"></i>
              </div>
              <h3 className="text-gray-500 font-bold uppercase tracking-wider text-xs mb-1">This Month</h3>
              <div className="text-3xl font-black text-[#2b1b10]">₹{data?.stats?.month_collection || 0}</div>
            </div>
"""
    content = content.replace(
        'grid-cols-1 md:grid-cols-3',
        'grid-cols-1 md:grid-cols-4'
    )
    content = content.replace(
        '</div>\n        </div>\n      </main>',
        monthly_card + '          </div>\n        </div>\n      </main>'
    )
    with open(home_file, 'w') as f:
        f.write(content)

# 3. Update frontend/src/app/login/page.tsx (Password reset URL)
login_file = 'frontend/src/app/login/page.tsx'
with open(login_file, 'r') as f:
    content = f.read()

content = content.replace(
    '`${process.env.NEXT_PUBLIC_API_URL}/password-reset/`',
    '`${process.env.NEXT_PUBLIC_API_URL}/app/password-reset/`'
)
with open(login_file, 'w') as f:
    f.write(content)

# 4. Update canteen/canteen/urls.py (Password reset routes)
canteen_urls = 'canteen/canteen/urls.py'
with open(canteen_urls, 'r') as f:
    content = f.read()

if 'auth_views' not in content:
    content = content.replace('from django.contrib import admin', 'from django.contrib import admin\nfrom django.contrib.auth import views as auth_views')
    
if 'password-reset/' not in content:
    urls_addition = """
    path('password-reset/', auth_views.PasswordResetView.as_view(
        template_name='accounts/password_reset_form.html',
        email_template_name='accounts/email/password_reset_email.html',
        subject_template_name='accounts/email/password_reset_subject.txt',
        success_url='/password-reset/done/'
    ), name='password_reset'),
    path('password-reset/done/', auth_views.PasswordResetDoneView.as_view(
        template_name='accounts/password_reset_done.html'
    ), name='password_reset_done'),
    path('reset/<uidb64>/<token>/', auth_views.PasswordResetConfirmView.as_view(
        template_name='accounts/password_reset_confirm.html',
        success_url='/reset/done/'
    ), name='password_reset_confirm'),
    path('reset/done/', auth_views.PasswordResetCompleteView.as_view(
        template_name='accounts/password_reset_complete.html'
    ), name='password_reset_complete'),
"""
    content = content.replace('path(\'app/\', include(\'accounts.urls\')),', 'path(\'app/\', include(\'accounts.urls\')),\n' + urls_addition)
    with open(canteen_urls, 'w') as f:
        f.write(content)

print("Patch applied successfully.")
