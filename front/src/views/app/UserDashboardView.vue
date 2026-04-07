<template>
  <div class="grid gap-4 lg:grid-cols-3">
    <BaseCard>
      <p class="text-sm text-slate-500">Usuário</p>
      <h2 class="mt-2 text-xl font-semibold">{{ auth.user?.first_name }} {{ auth.user?.last_name }}</h2>
      <p class="mt-2 text-sm text-slate-600">Status: {{ auth.user?.status }}</p>
    </BaseCard>
    <BaseCard>
      <p class="text-sm text-slate-500">Onboarding</p>
      <h2 class="mt-2 text-xl font-semibold">{{ auth.user?.onboarding_completed ? 'Concluído' : 'Pendente' }}</h2>
    </BaseCard>
    <BaseCard>
      <p class="text-sm text-slate-500">Interesses</p>
      <h2 class="mt-2 text-xl font-semibold">{{ auth.currentUser?.interests.length ?? 0 }}</h2>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>
