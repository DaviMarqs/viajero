from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from favorites.models import Favorite


class FavoriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Favorite
        fields = '__all__'
        validators = [
            UniqueTogetherValidator(
                queryset=Favorite.objects.all(),
                fields=['user', 'travel_plan'],
                message='Este roteiro já está nos seus favoritos.'
            )
        ]
