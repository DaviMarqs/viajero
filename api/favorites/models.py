from django.db import models
from travelplans.models import TravelPlan
from django.conf import settings

class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    travel_plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'travel_plan'], name='unique_user_travel_plan_favorite'),
        ]

    def __str__(self):
        return f'{self.user_id}-{self.travel_plan_id}'
