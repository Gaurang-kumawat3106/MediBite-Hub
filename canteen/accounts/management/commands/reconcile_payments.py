from django.core.management.base import BaseCommand
from accounts.services.payment_service import reconcile_pending_orders, retry_failed_stock_deductions

class Command(BaseCommand):
    help = "Reconciles dangling unpaid Razorpay orders and retries failed stock deductions."

    def add_arguments(self, parser):
        parser.add_argument(
            '--minutes',
            type=int,
            default=60,
            help='Look back duration in minutes for unpaid orders (default: 60).'
        )

    def handle(self, *args, **options):
        minutes = options['minutes']
        self.stdout.write(self.style.NOTICE(f"Starting payment reconciliation for orders in past {minutes} minutes..."))
        
        reconciled_count = reconcile_pending_orders(minutes=minutes)
        self.stdout.write(self.style.SUCCESS(f"Reconciliation completed: {reconciled_count} order(s) auto-healed to PAID."))

        self.stdout.write(self.style.NOTICE("Retrying failed stock deductions..."))
        deducted_count = retry_failed_stock_deductions()
        self.stdout.write(self.style.SUCCESS(f"Stock retry completed: {deducted_count} order(s) fulfilled."))
