from rest_framework import serializers
from review.models import Review
from rest_framework.validators import UniqueTogetherValidator


class ReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Review
        fields = [
            'id',
            'user',
            'travel_plan',
            'rating',
            'comentario',
            'created_at',
        ]

    def validate_comentario(self, value):
        if value == "":
            raise serializers.ValidationError("O comentário da avaliação é um campo obrigatório.")
        return value
    
    def validate_rating(self, value):
        if value < 0 or value > 10:
            raise serializers.ValidationError("Nota inválida. Avalie o roteiro com uma nota de 0 a 10.")
        return value
