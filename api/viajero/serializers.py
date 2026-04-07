from rest_framework import serializers
from viajero.models import TravelPlan, Favorite


class TravelPlanSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelPlan
        fields = '__all__'


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = '__all__'
