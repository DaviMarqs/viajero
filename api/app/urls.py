from django.contrib import admin
from django.urls import path
from travelplans.views import (
    TravelPlanCreateListView,
    TravelPlanRetrieveUpdateDestroy,
)
from favorites.views import (
    FavoriteCreateListView,
    FavoriteRetrieveUpdateDestroy,
)
from review.views import (ReviewCreateListView,
    ReviewRetrieveUpdateDestroy)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('travel-plans/', TravelPlanCreateListView.as_view(), name='travel-plan-create-list'),
    path('travel-plans/<int:pk>', TravelPlanRetrieveUpdateDestroy.as_view(), name='travel-plan-detail-view'),
    path('favorites/', FavoriteCreateListView.as_view(), name='favorite-create-list'),
    path('favorites/<int:pk>', FavoriteRetrieveUpdateDestroy.as_view(), name='favorite-detail-view'),
    path('reviews/', ReviewCreateListView.as_view(), name='review-create-list'),
    path('reviews/<int:pk>', ReviewRetrieveUpdateDestroy.as_view(), name='review-detail-view'),
]
