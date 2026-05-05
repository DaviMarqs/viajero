from django.shortcuts import render
from rest_framework import generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from review.models import Review
from review.serializers import ReviewSerializer
from helpers.responses import api_response

class ReviewCreateListView(generics.ListCreateAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user)

    def list(self, request, *args, **kwargs):
        reviews = self.get_queryset()
        serializer = self.get_serializer(reviews, many=True)

        return api_response(
            status_bool=True,
            message="Lista de reviews realizadas recuperada com sucesso.",
            data=serializer.data,
            http_status=200
        )
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)

        if serializer.is_valid():
            serializer.save(user=request.user)

            return api_response(
                status_bool=True,
                message="Review realizada com sucesso.",
                data=serializer.data,
                http_status=201
            )

        return api_response(
            status_bool=False,
            message="Erro ao salvar review.",
            errors=serializer.errors,
            http_status=400
        )

class ReviewRetrieveUpdateDestroy(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ReviewSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Review.objects.filter(user=self.request.user)

    def retrieve(self, request, *args, **kwargs):
        review = self.get_object()
        serializer = self.get_serializer(review)

        return api_response(
            status_bool=True,
            message="Avaliação recuperada com sucesso.",
            data=serializer.data
        )

    def update(self, request, *args, **kwargs):
        review = self.get_object()
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(review, data=request.data, partial=partial)

        if serializer.is_valid():
            serializer.save()

            return api_response(
                status_bool=True,
                message="Avalição atualizada com sucesso.",
                data=serializer.data
            )

        return api_response(
            status_bool=False,
            message="Erro ao atualizar avaliação.",
            errors=serializer.errors,
            http_status=400
        )

    def destroy(self, request, *args, **kwargs):
        review = self.get_object()
        review.delete()

        return api_response(
            status_bool=True,
            message="Avaliação excluída com sucesso.",
            http_status=200  
        )