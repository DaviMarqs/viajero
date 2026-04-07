from django.db import models


class TravelPlan(models.Model):
    STATUS_DRAFT = 'draft'
    STATUS_SAVED = 'saved'
    STATUS_EDITED = 'edited'

    STATUS_CHOICES = [
        (STATUS_DRAFT, 'Rascunho'),
        (STATUS_SAVED, 'Salvo'),
        (STATUS_EDITED, 'Editado'),
    ]

    user = models.ForeignKey('auth.User', on_delete=models.CASCADE)
    titulo = models.CharField(max_length=255)
    destino_principal = models.CharField(max_length=255)
    dados = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.titulo


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
