from django.db import models
from users.models import User

class Traveler(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='traveler')

    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)

    phone_number = models.CharField(max_length=20, blank=True)

    date_of_birth = models.DateField(null=True, blank=True)
    document_id = models.CharField(max_length=30, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
