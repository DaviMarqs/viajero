from django.db import models
from django.contrib.auth.models import User

class PreferenciaUsuario(models.Model):
    usuario = models.OneToOneField(User, on_delete=models.CASCADE)

    tipo_viajante = models.CharField(max_length=20)
    nivel_conforto = models.CharField(max_length=20)
    companhia = models.CharField(max_length=20)
    ritmo_viagem = models.CharField(max_length=20)
    experiencia_viagem = models.CharField(max_length=20)


class PreferenciaViagem(models.Model):
    usuario = models.ForeignKey(User, on_delete=models.CASCADE)

    duracao_dias = models.IntegerField()
    orcamento = models.CharField(max_length=20)
    clima = models.CharField(max_length=20)
    interesses = models.JSONField()
    restricoes = models.JSONField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)