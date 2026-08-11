from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Add price snapshot fields to OrderItem.

    These fields capture the exact unit_price and platform_fee at the moment
    the order is created in create_razorpay_order(). This makes each OrderItem
    self-contained and historically accurate, independent of future product
    price changes.

    Existing OrderItem rows default to 0.00 — this is safe because all
    pre-existing orders were already paid and these fields are informational
    only for historical records.
    """

    dependencies = [
        ('accounts', '0020_platformfeeslab'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='unit_price',
            field=models.DecimalField(
                max_digits=8,
                decimal_places=2,
                default=0,
                help_text='Product base price at the time of order',
            ),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='platform_fee',
            field=models.DecimalField(
                max_digits=8,
                decimal_places=2,
                default=0,
                help_text='Platform fee per unit at the time of order',
            ),
        ),
    ]
