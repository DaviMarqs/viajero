<template>
  <BaseCard>
    <h1 class="mb-4 text-2xl font-semibold">Templates</h1>
    <div class="space-y-3">
      <div v-for="template in templates" :key="template.id" class="rounded-2xl border border-slate-200 p-4">
        <p class="font-semibold">{{ template.name }}</p>
        <p class="text-sm text-slate-600">{{ template.description }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const templates = ref<any[]>([])
onMounted(async () => {
  const { data } = await api.get('/templates/')
  templates.value = data.results
})
</script>
