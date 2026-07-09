from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

User = get_user_model()

class PasswordResetTests(TestCase):
    def setUp(self):
        cache.clear()
        self.email = "test@example.com"
        # Create users
        self.user1 = User.objects.create_user(
            username="userone",
            email=self.email,
            password="oldpassword123",
            is_active=True
        )

    def test_single_account_reset_sends_email(self):
        response = self.client.post(reverse('password_reset'), {'email': self.email})
        # Should redirect to login with a success message
        self.assertRedirects(response, reverse('login'))
        
    def test_account_enumeration_protection(self):
        # Non-existent email should still redirect to login with success message
        response = self.client.post(reverse('password_reset'), {'email': 'nonexistent@example.com'})
        self.assertRedirects(response, reverse('login'))
        
    def test_multiple_accounts_reset_renders_select_page(self):
        # Create a second user with the same email
        self.user2 = User.objects.create_user(
            username="usertwo",
            email=self.email,
            password="anotherpassword123",
            is_active=True
        )
        
        response = self.client.post(reverse('password_reset'), {'email': self.email})
        # Should render the select account page (not redirect)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'accounts/password_reset_select.html')
        # Check that both usernames are present in masked form in the context
        users_data = response.context['users_data']
        self.assertEqual(len(users_data), 2)
        masked_usernames = [u['masked_username'] for u in users_data]
        # userone should be masked
        self.assertIn("us***ne", masked_usernames)
        self.assertIn("us***wo", masked_usernames)

    def test_select_account_sends_email(self):
        self.user2 = User.objects.create_user(
            username="usertwo",
            email=self.email,
            password="anotherpassword123",
            is_active=True
        )
        
        # Post to select view
        response = self.client.post(reverse('password_reset_select'), {
            'email': self.email,
            'user_id': self.user2.pk
        })
        self.assertRedirects(response, reverse('login'))

    def test_select_account_invalid_email_mismatch_fails(self):
        # Trying to reset user1 but providing a mismatched email
        response = self.client.post(reverse('password_reset_select'), {
            'email': 'wrong@example.com',
            'user_id': self.user1.pk
        })
        self.assertRedirects(response, reverse('password_reset'))

    def test_password_reset_confirm_updates_password(self):
        # Generate token for user1
        uidb64 = urlsafe_base64_encode(force_bytes(self.user1.pk))
        token = default_token_generator.make_token(self.user1)
        
        # Test confirm page GET
        url = reverse('password_reset_confirm', kwargs={'uidb64': uidb64, 'token': token})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'accounts/password_reset_confirm.html')
        self.assertTrue(response.context['validlink'])
        
        # Test confirm page POST (passwords mismatch)
        response = self.client.post(url, {
            'new_password': 'newpassword12345',
            'confirm_password': 'mismatchpassword'
        })
        self.assertEqual(response.status_code, 200)
        # Verify password is not updated yet
        self.user1.refresh_from_db()
        self.assertTrue(self.user1.check_password("oldpassword123"))
        
        # Test confirm page POST (success)
        response = self.client.post(url, {
            'new_password': 'newpassword12345',
            'confirm_password': 'newpassword12345'
        })
        self.assertRedirects(response, reverse('login'))
        self.user1.refresh_from_db()
        self.assertTrue(self.user1.check_password("newpassword12345"))
        self.assertFalse(self.user1.check_password("oldpassword123"))

    def test_rate_limiting(self):
        # Make 3 requests
        for _ in range(3):
            self.client.post(reverse('password_reset'), {'email': self.email})
            
        # 4th request should trigger rate limit error and render form with error msg
        response = self.client.post(reverse('password_reset'), {'email': self.email})
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, 'accounts/password_reset_form.html')
