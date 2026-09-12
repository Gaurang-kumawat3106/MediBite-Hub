import json
import logging
from django.conf import settings
from pywebpush import webpush, WebPushException
from accounts.models import PushSubscription

logger = logging.getLogger(__name__)

def send_user_push_notification(user, title, body, url=None):
    """
    Sends a Web Push notification to all active browser subscriptions of a given user.
    Automatically purges expired (404/410) subscriptions.
    """
    if not user:
        return 0

    subscriptions = PushSubscription.objects.filter(user=user)
    if not subscriptions.exists():
        logger.info(f"send_user_push_notification: No push subscriptions found for user {user.username}.")
        return 0

    vapid_private_key = getattr(settings, "VAPID_PRIVATE_KEY", None)
    vapid_email = getattr(settings, "VAPID_ADMIN_EMAIL", "mailto:admin@bhukkadbox.in")

    if not vapid_private_key:
        logger.warning("send_user_push_notification: VAPID_PRIVATE_KEY is not configured in settings.")
        return 0

    date_joined = getattr(user, 'date_joined', None)
    ts = int(date_joined.timestamp()) if date_joined and hasattr(date_joined, 'timestamp') else 0

    payload = json.dumps({
        "title": title,
        "body": body,
        "url": url or "/",
        "timestamp": ts
    })

    sent_count = 0
    stale_subscriptions = []

    for sub in subscriptions:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {
                "p256dh": sub.p256dh,
                "auth": sub.auth,
            }
        }

        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=vapid_private_key,
                vapid_claims={"sub": vapid_email}
            )
            sent_count += 1
            logger.info(f"send_user_push_notification: Push sent successfully to {user.username} (endpoint: ...{sub.endpoint[-20:]}).")
        except WebPushException as exc:
            logger.warning(f"send_user_push_notification: WebPushException for {user.username}: {exc}")
            # Status 404 Not Found or 410 Gone means subscription is invalid/expired
            if exc.response is not None and exc.response.status_code in (404, 410):
                stale_subscriptions.append(sub.id)
        except Exception as e:
            logger.exception(f"send_user_push_notification: Error sending push to {user.username}: {e}")

    if stale_subscriptions:
        PushSubscription.objects.filter(id__in=stale_subscriptions).delete()
        logger.info(f"send_user_push_notification: Cleaned up {len(stale_subscriptions)} expired subscription(s).")

    return sent_count


def notify_outlet_head_new_order(order):
    """
    Sends Web Push Notification to Outlet Head when a new paid order arrives.
    Target URL: /outlet/orders
    """
    try:
        if not order or not order.outlet or not order.outlet.manager:
            return

        manager = order.outlet.manager
        title = "🍽️ New Order Received!"
        body = f"Order #{order.id} (₹{order.total_amount}) placed by {order.user.username}."
        url = "/outlet/orders"

        send_user_push_notification(user=manager, title=title, body=body, url=url)
    except Exception as e:
        logger.exception(f"notify_outlet_head_new_order failed for Order #{order.id}: {e}")


def notify_customer_order_ready(order, token_no=None):
    """
    Sends Web Push Notification to Customer when order is Ready (completed).
    Target URL: /token
    """
    try:
        if not order or not order.user:
            return

        title = "🎉 Your Order is Ready!"
        token_info = f" Token #{token_no}" if token_no else ""
        body = f"Your order from {order.outlet.name} is ready!{token_info}"
        url = "/token"

        send_user_push_notification(user=order.user, title=title, body=body, url=url)
    except Exception as e:
        logger.exception(f"notify_customer_order_ready failed for Order #{order.id}: {e}")
