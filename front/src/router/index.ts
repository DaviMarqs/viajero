import { createRouter, createWebHistory } from 'vue-router'

import { useAuthStore } from '@/stores/auth'
import AdminLayout from '@/layouts/AdminLayout.vue'
import AppLayout from '@/layouts/AppLayout.vue'
import PublicLayout from '@/layouts/PublicLayout.vue'
import AdminDashboardView from '@/views/admin/AdminDashboardView.vue'
import AdminLgpdView from '@/views/admin/AdminLgpdView.vue'
import AdminLogsView from '@/views/admin/AdminLogsView.vue'
import AdminReviewsView from '@/views/admin/AdminReviewsView.vue'
import AdminTemplatesView from '@/views/admin/AdminTemplatesView.vue'
import AdminUsersView from '@/views/admin/AdminUsersView.vue'
import FavoritesView from '@/views/app/FavoritesView.vue'
import ItineraryCreateView from '@/views/app/ItineraryCreateView.vue'
import ItineraryDetailView from '@/views/app/ItineraryDetailView.vue'
import ItineraryEditView from '@/views/app/ItineraryEditView.vue'
import ItineraryListView from '@/views/app/ItineraryListView.vue'
import OnboardingView from '@/views/app/OnboardingView.vue'
import PreferencesView from '@/views/app/PreferencesView.vue'
import PrivacyView from '@/views/app/PrivacyView.vue'
import ProfileView from '@/views/app/ProfileView.vue'
import ReviewsView from '@/views/app/ReviewsView.vue'
import UserDashboardView from '@/views/app/UserDashboardView.vue'
import ForgotPasswordView from '@/views/public/ForgotPasswordView.vue'
import LandingView from '@/views/public/LandingView.vue'
import LoginView from '@/views/public/LoginView.vue'
import RegisterView from '@/views/public/RegisterView.vue'
import ResetPasswordView from '@/views/public/ResetPasswordView.vue'
import SharedItineraryView from '@/views/public/SharedItineraryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: PublicLayout,
      children: [
        { path: '', name: 'landing', component: LandingView },
        { path: 'login', name: 'login', component: LoginView },
        { path: 'register', name: 'register', component: RegisterView },
        { path: 'forgot-password', name: 'forgot-password', component: ForgotPasswordView },
        { path: 'reset-password', name: 'reset-password', component: ResetPasswordView },
        { path: 'shared/:slug', name: 'shared-itinerary', component: SharedItineraryView },
      ],
    },
    {
      path: '/app',
      component: AppLayout,
      // meta: { requiresAuth: true },
      children: [
        { path: '', name: 'user-dashboard', component: UserDashboardView },
        { path: 'onboarding', name: 'onboarding', component: OnboardingView },
        { path: 'profile', name: 'profile', component: ProfileView },
        { path: 'preferences', name: 'preferences', component: PreferencesView },
        { path: 'itineraries', name: 'itineraries', component: ItineraryListView },
        { path: 'itineraries/create', name: 'itinerary-create', component: ItineraryCreateView },
        { path: 'itineraries/:id', name: 'itinerary-detail', component: ItineraryDetailView },
        { path: 'itineraries/:id/edit', name: 'itinerary-edit', component: ItineraryEditView },
        { path: 'favorites', name: 'favorites', component: FavoritesView },
        { path: 'reviews', name: 'reviews', component: ReviewsView },
        { path: 'privacy', name: 'privacy', component: PrivacyView },
      ],
    },
    {
      path: '/admin-app',
      component: AdminLayout,
      meta: { requiresAuth: true, requiresAdmin: true },
      children: [
        { path: '', name: 'admin-dashboard', component: AdminDashboardView },
        { path: 'users', name: 'admin-users', component: AdminUsersView },
        { path: 'logs', name: 'admin-logs', component: AdminLogsView },
        { path: 'lgpd', name: 'admin-lgpd', component: AdminLgpdView },
        { path: 'reviews', name: 'admin-reviews', component: AdminReviewsView },
        { path: 'templates', name: 'admin-templates', component: AdminTemplatesView },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (auth.isAuthenticated && !auth.user) {
    await auth.fetchCurrentUser()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login' }
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    return { name: 'user-dashboard' }
  }

  if (auth.isAuthenticated && auth.user && !auth.user.onboarding_completed && to.name !== 'onboarding') {
    return { name: 'onboarding' }
  }

  return true
})

export default router
