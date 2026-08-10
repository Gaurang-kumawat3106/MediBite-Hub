# Generated manually for platform fee slabs

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0019_platformfeeconfig_order_actual_amount_and_more'),
    ]

    operations = [
        migrations.AlterModelOptions(
            name='platformfeeconfig',
            options={
                'verbose_name': 'Platform Fee Configuration (Fallback)',
                'verbose_name_plural': 'Platform Fee Configuration (Fallback)',
            },
        ),
        migrations.CreateModel(
            name='PlatformFeeSlab',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('min_price', models.DecimalField(decimal_places=2, max_digits=10)),
                ('max_price', models.DecimalField(blank=True, decimal_places=2, help_text='Leave blank for no upper limit', max_digits=10, null=True)),
                ('fee_amount', models.DecimalField(decimal_places=2, max_digits=10)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Platform Fee Slab',
                'verbose_name_plural': 'Platform Fee Slabs',
                'ordering': ['min_price'],
            },
        ),
    ]
