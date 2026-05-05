from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from favorites.models import Favorite


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = [
            'id',
            'user',
            'travel_plan',
            'created_at'
        ]
        read_only_fields = ['user']
