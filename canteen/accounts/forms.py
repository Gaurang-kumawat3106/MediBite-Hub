from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import CustomUser
from .models import Outlet, OutletUI, Category, Product

# ---- LOGIN FORM ----
class LoginForm(forms.Form):
    username = forms.CharField(
        max_length=150,
        strip=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your username',
            'autocomplete': 'username',
        })
    )
    password = forms.CharField(
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Enter your password',
            'autocomplete': 'current-password',
        })
    )

# ---- SIGNUP FORMS ----
class CustomerSignupForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'password1', 'password2')

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_customer = True
        if commit:
            user.save()
        return user




# outlet head porpose
class OutletSignupForm(UserCreationForm):
    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'password1', 'password2')

    def save(self, commit=True):
        user = super().save(commit=False)
        user.is_outlet_head = True
        user.is_staff = True  # Grant staff status Home
        if commit:
            user.save()
        return user
    
class OutletForm(forms.ModelForm):
    class Meta:
        model = Outlet
        fields = ['name', 'logo']

class OutletThemeForm(forms.ModelForm):
    class Meta:
        model = OutletUI
        fields = ['banner', 'banner_active', 'theme_color', 'layout_type']

             
# 



class CategoryForm(forms.ModelForm):
    class Meta:
        model = Category
        fields = ['name']


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ['category', 'name', 'price', 'image', 'is_available']
