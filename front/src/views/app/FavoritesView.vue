<template>
  <BaseCard>
    <h1 class="mb-4 text-2xl font-semibold">Favoritos</h1>
    <div class="space-y-3">
      <div v-for="favorite in favorites" :key="favorite.id" class="rounded-2xl border border-slate-200 p-4">
        {{ favorite.itinerary_title }}
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const favorites = ref<any[]>([])

onMounted(async () => {
  const { data } = await api.get('/favorites/')
  favorites.value = data.results
})
</script>
