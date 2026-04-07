from django.db import models
from travelplans.models import TravelPlan


class Favorite(models.Model):
    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    travel_plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['user', 'travel_plan'], name='unique_user_travel_plan_favorite'),
        ]

    def __str__(self):
        return f'{self.user_id}-{self.travel_plan_id}'
