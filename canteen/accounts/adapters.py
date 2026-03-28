from allauth.socialaccount.adapter import DefaultSocialAccountAdapter


class CustomSocialAccountAdapter(DefaultSocialAccountAdapter):
    def save_user(self, request, sociallogin, form=None):
        user = super().save_user(request, sociallogin, form=form)

        # Default: Google-signin users become Customers.
        # Admin can later promote them to Outlet Head.
        if not getattr(user, "is_outlet_head", False) and not getattr(user, "is_customer", False):
            user.is_customer = True
            user.save(update_fields=["is_customer"])

        return user

