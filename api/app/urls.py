from django.contrib import admin
from django.urls import path
from viajero.views import (
    TravelPlanCreateListView,
    TravelPlanRetrieveUpdateDestroy,
    FavoriteCreateListView,
    FavoriteRetrieveUpdateDestroy,
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('travel-plans/', TravelPlanCreateListView.as_view(), name='travel-plan-create-list'),
    path('travel-plans/<int:pk>', TravelPlanRetrieveUpdateDestroy.as_view(), name='travel-plan-detail-view'),
    path('favorites/', FavoriteCreateListView.as_view(), name='favorite-create-list'),
    path('favorites/<int:pk>', FavoriteRetrieveUpdateDestroy.as_view(), name='favorite-detail-view'),
]
