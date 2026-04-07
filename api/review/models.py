from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from travelplans.models import TravelPlan

class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    travel_plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE)
    
    rating = models.IntegerField(
        validators=[
            MinValueValidator(0, message="A nota mínima é 0."),
            MaxValueValidator(10, message="A nota máxima é 10.")
        ]
    )
    comentario = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'travel_plan'], name='unique_user_travel_plan_review'),
        ]

    def __str__(self):
        return f'Review {self.rating} - {self.user_id}-{self.travel_plan_id}'