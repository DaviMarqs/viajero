<template>
  <div class="mx-auto flex min-h-screen max-w-7xl gap-6 px-4 py-6">
    <AppSidebar :items="items" />
    <div class="flex-1">
      <header class="mb-6 rounded-3xl bg-slate-950 px-6 py-5 text-white shadow-panel">
        <p class="text-xs uppercase tracking-[0.3em] text-brand-300">Administração</p>
        <p class="mt-2 text-2xl font-semibold">Painel operacional</p>
      </header>
      <RouterView />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'

const items = [
  { label: 'Dashboard', to: '/admin-app' },
  { label: 'Usuários', to: '/admin-app/users' },
  { label: 'Logs', to: '/admin-app/logs' },
  { label: 'LGPD', to: '/admin-app/lgpd' },
  { label: 'Avaliações', to: '/admin-app/reviews' },
  { label: 'Templates', to: '/admin-app/templates' },
]
</script>
