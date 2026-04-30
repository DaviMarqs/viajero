from django.contrib import admin
from .models import Traveler


class TravelerAdmin(admin.ModelAdmin):
	list_display = ('user', 'first_name', 'last_name', 'phone_number', 'date_of_birth')
	search_fields = ('first_name', 'last_name', 'user__email')
	list_filter = ('date_of_birth',)


admin.site.register(Traveler, TravelerAdmin)
