from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("profiles", "0002_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="usertrippreference",
            name="companionship",
            field=models.CharField(blank=True, max_length=40),
        ),
    ]
