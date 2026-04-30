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
from users.views import UserCreateListView, UserRetrieveUpdateDestroy
from travelers.views import TravelerCreateListView, TravelerRetrieveUpdateDestroy
from review.views import (ReviewCreateListView,ReviewRetrieveUpdateDestroy)
from user_preferences.views import (UserPreferenceViewSet,)
from travel_preferences.views import (TravelPreferenceViewSet)
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView, TokenVerifyView

urlpatterns = [
    path('admin/', admin.site.urls),
    #Travel Plan Routes
    path('travel-plans/', TravelPlanCreateListView.as_view(), name='travel-plan-create-list'),
    path('travel-plans/<int:pk>', TravelPlanRetrieveUpdateDestroy.as_view(), name='travel-plan-detail-view'),


    #Favorites Routes
    path('favorites/', FavoriteCreateListView.as_view(), name='favorite-create-list'),
    path('favorites/<int:pk>', FavoriteRetrieveUpdateDestroy.as_view(), name='favorite-detail-view'),


    #Users Routes
    path('users/', UserCreateListView.as_view(), name='user-create-list'),
    path('users/<int:pk>/', UserRetrieveUpdateDestroy.as_view(), name='user-detail-view'),
    
    
    #Travelers Routes
    path('travelers/', TravelerCreateListView.as_view(), name='traveler-create-list'),
    path('travelers/<int:pk>/', TravelerRetrieveUpdateDestroy.as_view(), name='traveler-detail-view'),


    #Reviews Routes
    path('reviews/', ReviewCreateListView.as_view(), name='review-create-list'),
    path('reviews/<int:pk>', ReviewRetrieveUpdateDestroy.as_view(), 
    name='review-detail-view'),
    
    
    #User Preferences Routes
    path('user-preferences/', UserPreferenceViewSet.as_view({'get': 'list', 'post': 'create'}), name='user-preferences-list'),
    path('user-preferences/<int:pk>/', UserPreferenceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='user-preferences-detail'),

    #Travel Preferences Routes
    path('travel-preferences/', TravelPreferenceViewSet.as_view({'get': 'list', 'post': 'create'}), name='travel-preferences-list'),
    path('travel-preferences/<int:pk>/', TravelPreferenceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'delete': 'destroy'}), name='travel-preferences-detail'),


    #Authentication Routes
    path('authentication/token/', TokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('authentication/token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('authentication/token/verify/', TokenVerifyView.as_view(), name='token-verify'),
]
