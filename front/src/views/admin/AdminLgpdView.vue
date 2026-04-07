<template>
  <BaseCard>
    <h1 class="mb-4 text-2xl font-semibold">Solicitações LGPD</h1>
    <div class="space-y-3">
      <div v-for="request in requests" :key="request.id" class="rounded-2xl border border-slate-200 p-4">
        <p class="font-semibold">{{ request.status }}</p>
        <p class="text-sm text-slate-600">{{ request.reason }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const requests = ref<any[]>([])
onMounted(async () => {
  const { data } = await api.get('/deletion-requests/')
  requests.value = data.results
})
</script>
