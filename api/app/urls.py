from django.contrib import admin
from django.urls import path
from viajero.views import (
    TravelPlanCreateListView,
    TravelPlanRetrieveUpdateDestroy,
    FavoriteCreateListView,
    FavoriteRetrieveUpdateDestroy,
)
from users.views import UserCreateListView, UserRetrieveUpdateDestroy
from travelers.views import TravelerCreateListView, TravelerRetrieveUpdateDestroy

urlpatterns = [
    path('admin/', admin.site.urls),
    path('travel-plans/', TravelPlanCreateListView.as_view(), name='travel-plan-create-list'),
    path('travel-plans/<int:pk>', TravelPlanRetrieveUpdateDestroy.as_view(), name='travel-plan-detail-view'),
    path('favorites/', FavoriteCreateListView.as_view(), name='favorite-create-list'),
    path('favorites/<int:pk>', FavoriteRetrieveUpdateDestroy.as_view(), name='favorite-detail-view'),
    path('users/', UserCreateListView.as_view()),
    path('users/<int:pk>/', UserRetrieveUpdateDestroy.as_view()),
    path('travelers/', TravelerCreateListView.as_view()),
    path('travelers/<int:pk>/', TravelerRetrieveUpdateDestroy.as_view()),
]
