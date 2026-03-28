from django.urls import path
from . import views

urlpatterns = [
    path('', views.login_view, name='login'),
    path('welcome/', views.welcome_splash, name='welcome_splash'),
    # path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),

    path('register/customer/', views.customer_register, name='customer_register'),
    path('register/outlet/', views.outlet_register, name='outlet_register'),

    path('customer/home/', views.customer_home, name='customer_home'),
    path('outlet/home/', views.outlet_home, name='outlet_home'),

    path('outlet/<int:id>/', views.outlet_detail, name='outlet_detail'),
    path('outlet/<int:outlet_id>/ui/', views.manage_outlet_ui, name='manage_outlet_ui'),

    # 🔥 THESE WERE MISSING
    path('outlet/add-category/', views.add_category, name='add_category'),
    path('outlet/add-product/', views.add_product, name='add_product'),
    path('outlet/category/delete/<int:category_id>/', views.delete_category, name='delete_category'),
    
    
       
   # updates in march
   
   path('product/<int:product_id>/', views.product_detail, name='product_detail'),

path('cart/', views.cart_view, name='cart'),

path('add-to-cart/<int:product_id>/', views.add_to_cart, name='add_to_cart'),

path('remove-from-cart/<int:item_id>/', views.remove_from_cart, name='remove_from_cart'),

path('place-order/', views.place_order, name='place_order'),

path('outlet/orders/', views.outlet_orders, name='outlet_orders'),
path('outlet/order/<int:order_id>/update-status/', views.update_order_status, name='update_order_status'),


path('cart/increase/<int:item_id>/', views.increase_quantity, name='increase_quantity'),
path('cart/decrease/<int:item_id>/', views.decrease_quantity, name='decrease_quantity'),

path('customer/orders/', views.customer_orders, name='customer_orders'),
path('customer/token/', views.customer_token, name='customer_token'),
path('customer/order/<int:order_id>/cancel/', views.cancel_order, name='cancel_order'),

path('outlet/products/', views.outlet_products_view, name='outlet_products'),
path('outlet/product/<int:product_id>/toggle/', views.toggle_availability, name='toggle_availability'),
]