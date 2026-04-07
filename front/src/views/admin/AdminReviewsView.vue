<template>
  <BaseCard>
    <h1 class="mb-4 text-2xl font-semibold">Avaliações</h1>
    <div class="space-y-3">
      <div v-for="review in reviews" :key="review.id" class="rounded-2xl border border-slate-200 p-4">
        <p class="font-semibold">{{ review.title }} • {{ review.rating }}</p>
        <p class="text-sm text-slate-600">{{ review.comment }}</p>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const reviews = ref<any[]>([])
onMounted(async () => {
  const { data } = await api.get('/reviews/?scope=admin')
  reviews.value = data.results
})
</script>
