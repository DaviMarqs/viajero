from rest_framework import serializers
from .models import PreferenciaUsuario, PreferenciaViagem


class PreferenciaUsuarioSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenciaUsuario
        fields = '__all__'


class PreferenciaViagemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreferenciaViagem
        fields = '__all__'