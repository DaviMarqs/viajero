<template>
  <div class="grid gap-4 lg:grid-cols-3">
    <BaseCard v-for="card in cards" :key="card.label">
      <p class="text-sm text-slate-500">{{ card.label }}</p>
      <h2 class="mt-2 text-3xl font-semibold">{{ card.value }}</h2>
    </BaseCard>
    <BaseCard class="lg:col-span-3">
      <h2 class="text-lg font-semibold">Módulo futuro de IA</h2>
      <p class="mt-2 text-sm text-slate-600">{{ llm.message }}</p>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const dashboard = reactive<any>({})
const llm = reactive<any>({})
const cards = computed(() => [
  { label: 'Usuários', value: dashboard.users_total ?? 0 },
  { label: 'Logs', value: dashboard.audit_logs_total ?? 0 },
  { label: 'Solicitações LGPD', value: dashboard.pending_deletion_requests ?? 0 },
  { label: 'Avaliações', value: dashboard.reviews_total ?? 0 },
  { label: 'Templates', value: dashboard.templates_total ?? 0 },
  { label: 'Jobs IA', value: llm.jobs ?? 0 },
])

onMounted(async () => {
  Object.assign(dashboard, (await api.get('/admin/dashboard/')).data)
  Object.assign(llm, (await api.get('/admin/llm-status/')).data)
})
</script>
