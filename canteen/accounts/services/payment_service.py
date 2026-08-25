import logging
from datetime import timedelta
from django.db import transaction
from django.utils import timezone
from django.conf import settings
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import razorpay

from accounts.models import Order, CartItem

logger = logging.getLogger(__name__)

def finalize_paid_order(razorpay_order_id, payment_id, signature=None, source="callback"):
    """
    Guaranteed idempotent finalization for a paid order.
    
    Guarantees:
    1. Order payment status transition to 'paid' and status to 'preparing' is done in an
       isolated atomic transaction with row-level locking (select_for_update).
    2. Once payment status is committed as 'paid', NO downstream failure (stock deduction,
       cart clearing, WebSocket alert) will ever roll back the order payment status.
    3. Stock deduction failures set fulfillment_status='failed' (order stays 'paid')
       and will be retried asynchronously.
    4. WebSocket alerts execute strictly outside the DB transaction.
    """
    if not razorpay_order_id:
        return False, "Missing razorpay_order_id", 400

    order = None
    already_paid = False

    # 1. Critical Isolated Database Transaction: Mark Order as Paid
    try:
        with transaction.atomic():
            try:
                order = Order.objects.select_for_update().get(razorpay_order_id=razorpay_order_id)
            except Order.DoesNotExist:
                logger.warning(f"finalize_paid_order: Order with razorpay_order_id={razorpay_order_id} not found.")
                return False, "Order not found", 404

            # Idempotency Guard
            if order.payment_status == "paid":
                logger.info(f"finalize_paid_order: Order #{order.id} is already marked paid.")
                already_paid = True
            else:
                # Validate order has items snapshot before marking paid
                if not order.items.exists():
                    logger.error(f"finalize_paid_order: Order #{order.id} has no items snapshotted!")
                    return False, "Order has no items snapshotted", 400

                order.payment_status = "paid"
                order.status = "preparing"
                order.razorpay_payment_id = payment_id or order.razorpay_payment_id
                if signature:
                    order.razorpay_signature = signature
                order.payment_verified_at = timezone.now()
                order.payment_source = source
                order.save(update_fields=[
                    "payment_status",
                    "status",
                    "razorpay_payment_id",
                    "razorpay_signature",
                    "payment_verified_at",
                    "payment_source"
                ])
                logger.info(f"finalize_paid_order: Order #{order.id} marked as PAID via {source}.")

    except Exception as e:
        logger.exception(f"finalize_paid_order: DB transaction error for razorpay_order_id={razorpay_order_id}: {e}")
        return False, "Database error during payment finalization", 500

    # If already paid, we return success immediately
    if already_paid:
        return True, "already_paid", 200

    # 2. Safe Post-Processing Step 1: Stock Deduction
    _deduct_stock_safely(order)

    # 3. Safe Post-Processing Step 2: Cart Cleanup (Target only items from this order's outlet)
    _clear_cart_safely(order)

    # 4. Safe Post-Processing Step 3: WebSocket Live Order Notification to Outlet
    _notify_outlet_websocket_safely(order)

    return True, "payment_finalized", 200


def _deduct_stock_safely(order):
    """
    Deducts product quantities for the order.
    If an error occurs, fulfillment_status is set to 'failed' without rolling back the paid order.
    """
    try:
        if order.fulfillment_status == "deducted":
            return

        with transaction.atomic():
            for item in order.items.select_related('product').all():
                prod = item.product
                if prod and prod.quantity is not None:
                    new_qty = max(0, prod.quantity - item.quantity)
                    prod.quantity = new_qty
                    if new_qty == 0:
                        prod.is_available = False
                    prod.save(update_fields=['quantity', 'is_available'])

            order.fulfillment_status = "deducted"
            order.save(update_fields=['fulfillment_status'])
            logger.info(f"_deduct_stock_safely: Stock successfully deducted for Order #{order.id}.")
    except Exception as e:
        logger.exception(f"_deduct_stock_safely: Failed stock deduction for Order #{order.id}: {e}")
        try:
            order.fulfillment_status = "failed"
            order.save(update_fields=['fulfillment_status'])
        except Exception:
            pass


def _clear_cart_safely(order):
    """
    Clears items from user's cart belonging to the order's outlet.
    Non-blocking: failure will not revert order status.
    """
    try:
        CartItem.objects.filter(cart__user=order.user, product__outlet=order.outlet).delete()
        logger.info(f"_clear_cart_safely: Cart items cleared for user {order.user.username}, outlet {order.outlet.name}.")
    except Exception as e:
        logger.warning(f"_clear_cart_safely: Failed cart cleanup for Order #{order.id}: {e}")


def _notify_outlet_websocket_safely(order):
    """
    Sends WebSocket live order notification to outlet staff dashboard.
    Runs strictly outside DB transaction. Failure is logged and non-blocking.
    """
    try:
        channel_layer = get_channel_layer()
        if channel_layer:
            async_to_sync(channel_layer.group_send)(
                f"outlet_{order.outlet.id}",
                {
                    "type": "new_order",
                    "order_id": order.id,
                    "customer_name": order.user.username,
                    "total_amount": str(order.total_amount)
                }
            )
            logger.info(f"_notify_outlet_websocket_safely: WS event sent for Order #{order.id} to group outlet_{order.outlet.id}.")
    except Exception as ws_err:
        logger.warning(f"_notify_outlet_websocket_safely: WebSocket push failed for Order #{order.id}: {ws_err}")


def retry_failed_stock_deductions():
    """
    Retries stock deductions for all paid orders with fulfillment_status='failed'.
    """
    failed_orders = Order.objects.filter(payment_status="paid", fulfillment_status="failed")
    count = 0
    for order in failed_orders:
        _deduct_stock_safely(order)
        if order.fulfillment_status == "deducted":
            count += 1
    return count


def reconcile_pending_orders(minutes=60):
    """
    Reconciles dangling unpaid orders created in the last N minutes by querying Razorpay API.
    Acts as the ultimate safety net if both frontend callback and webhook failed.
    """
    key_id = getattr(settings, 'RAZORPAY_KEY_ID', None)
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', None)
    if not key_id or not key_secret:
        logger.warning("reconcile_pending_orders: Razorpay credentials not configured, skipping reconciliation.")
        return 0

    cutoff = timezone.now() - timedelta(minutes=minutes)
    unpaid_orders = Order.objects.filter(
        payment_status="unpaid",
        created_at__gte=cutoff,
        razorpay_order_id__isnull=False
    ).exclude(razorpay_order_id__startswith="order_dev_")

    reconciled_count = 0
    try:
        client = razorpay.Client(auth=(key_id, key_secret))
    except Exception as e:
        logger.error(f"reconcile_pending_orders: Failed to initialize Razorpay client: {e}")
        return 0

    for order in unpaid_orders:
        try:
            payments = client.order.payments(order.razorpay_order_id)
            items = payments.get('items', [])
            
            successful_payment = None
            for p in items:
                if p.get('status') in ('captured', 'authorized'):
                    successful_payment = p
                    break

            if successful_payment:
                payment_id = successful_payment.get('id')
                logger.info(f"reconcile_pending_orders: Found captured payment {payment_id} for Order #{order.id} (rzp: {order.razorpay_order_id}). Finalizing...")
                success, msg, _ = finalize_paid_order(
                    razorpay_order_id=order.razorpay_order_id,
                    payment_id=payment_id,
                    source="reconciliation"
                )
                if success:
                    reconciled_count += 1
        except Exception as e:
            logger.error(f"reconcile_pending_orders: Exception while checking order #{order.id}: {e}")

    return reconciled_count
