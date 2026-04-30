from rest_framework import serializers
from review.models import Review
from rest_framework.validators import UniqueTogetherValidator


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = '__all__'
        validators = [
            UniqueTogetherValidator(
                queryset=Review.objects.all(),
                fields=['user', 'review'],
                message='Este roteiro já foi avaliado.'
            )
        ]