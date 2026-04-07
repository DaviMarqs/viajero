<template>
  <BaseCard>
    <h1 class="mb-4 text-2xl font-semibold">Logs de auditoria</h1>
    <div class="space-y-3">
      <div v-for="log in logs" :key="log.id" class="rounded-2xl border border-slate-200 p-4 text-sm">
        <p class="font-semibold">{{ log.action }}</p>
        <p class="text-slate-600">{{ log.actor_email }} • {{ log.entity_type }} #{{ log.entity_id }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const logs = ref<any[]>([])
onMounted(async () => {
  const { data } = await api.get('/audit-logs/')
  logs.value = data.results
})
</script>
