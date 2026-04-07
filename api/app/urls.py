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

from user_preferences.views import (
    UserPreferenceViewSet,
)

from travel_preferences.views import (
    TravelPreferenceViewSet
)

urlpatterns = [
    path('admin/', admin.site.urls),
    path('travel-plans/', TravelPlanCreateListView.as_view(), name='travel-plan-create-list'),
    path('travel-plans/<int:pk>', TravelPlanRetrieveUpdateDestroy.as_view(), name='travel-plan-detail-view'),
    path('favorites/', FavoriteCreateListView.as_view(), name='favorite-create-list'),
    path('favorites/<int:pk>', FavoriteRetrieveUpdateDestroy.as_view(), name='favorite-detail-view'),
    path('user-preferences/', UserPreferenceViewSet.as_view({'get': 'list', 'post': 'create'}), name='user-preferences-list'),
    path('user-preferences/<int:pk>/', UserPreferenceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='user-preferences-detail'),
    path('travel-preferences/', TravelPreferenceViewSet.as_view({'get': 'list', 'post': 'create'}), name='travel-preferences-list'),
    path('travel-preferences/<int:pk>/', TravelPreferenceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='travel-preferences-detail'),
]
