from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django import forms

from .models import User


class UserCreationForm(forms.ModelForm):
	password1 = forms.CharField(label='Password', widget=forms.PasswordInput)
	password2 = forms.CharField(label='Password confirmation', widget=forms.PasswordInput)

	class Meta:
		model = User
		fields = ('email',)

	def clean_password2(self):
		p1 = self.cleaned_data.get('password1')
		p2 = self.cleaned_data.get('password2')
		if p1 and p2 and p1 != p2:
			raise forms.ValidationError("Passwords don't match")
		return p2

	def save(self, commit=True):
		user = super().save(commit=False)
		user.set_password(self.cleaned_data['password1'])
		if commit:
			user.save()
		return user


class UserChangeForm(forms.ModelForm):
	password = ReadOnlyPasswordHashField()

	class Meta:
		model = User
		fields = ('email', 'password', 'is_active', 'is_staff', 'is_superuser', 'is_verified')

	def clean_password(self):
		return self.initial.get('password')


class UserAdmin(BaseUserAdmin):
	form = UserChangeForm
	add_form = UserCreationForm

	list_display = ('email', 'is_staff', 'is_superuser', 'is_verified', 'date_joined')
	list_filter = ('is_staff', 'is_superuser', 'is_verified')

	fieldsets = (
		(None, {'fields': ('email', 'password')}),
		('Permissions', {'fields': ('is_staff', 'is_superuser', 'is_verified', 'groups', 'user_permissions')}),
		('Dates', {'fields': ('date_joined',)}),
	)

	add_fieldsets = (
		(None, {
			'classes': ('wide',),
			'fields': ('email', 'password1', 'password2'),
		}),
	)

	search_fields = ('email',)
	ordering = ('email',)
	filter_horizontal = ('groups', 'user_permissions')


admin.site.register(User, UserAdmin)
