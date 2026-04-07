<template>
  <div class="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6">
    <AppSidebar :items="items" />
    <div class="flex-1">
      <header class="mb-6 flex items-center justify-between rounded-3xl bg-white px-6 py-4 shadow-panel">
        <div>
          <p class="text-xs uppercase tracking-[0.3em] text-brand-500">Área do usuário</p>
          <p class="text-lg font-semibold text-slate-900">{{ auth.user?.first_name }}</p>
        </div>
        <button class="text-sm text-slate-500" @click="logout">Sair</button>
      </header>
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

import AppSidebar from '@/components/layout/AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const items = [
  { label: 'Dashboard', to: '/app' },
  { label: 'Onboarding', to: '/app/onboarding' },
  { label: 'Perfil', to: '/app/profile' },
  { label: 'Preferências', to: '/app/preferences' },
  { label: 'Roteiros', to: '/app/itineraries' },
  { label: 'Favoritos', to: '/app/favorites' },
  { label: 'Avaliações', to: '/app/reviews' },
  { label: 'Privacidade', to: '/app/privacy' },
]

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>
