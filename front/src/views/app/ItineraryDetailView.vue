<template>
  <BaseCard v-if="itinerary">
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-2xl font-semibold">{{ itinerary.title }}</h1>
        <p class="mt-2 text-sm text-slate-600">{{ itinerary.description }}</p>
      </div>
      <button class="text-sm text-slate-500" @click="favorite">Favoritar</button>
    </div>
    <div class="mt-6 space-y-4">
      <div v-for="day in itinerary.days" :key="day.day_number" class="rounded-2xl border border-slate-200 p-4">
        <h2 class="font-semibold">{{ day.title }}</h2>
        <p class="mb-3 text-sm text-slate-600">{{ day.summary }}</p>
        <ul class="space-y-2 text-sm">
          <li v-for="item in day.items" :key="item.sort_order">{{ item.title }} • {{ item.category }}</li>
        </ul>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { Itinerary } from '@/types'

const route = useRoute()
const itinerary = ref<Itinerary | null>(null)

onMounted(async () => {
  const { data } = await api.get(`/itineraries/${route.params.id}/`)
  itinerary.value = data
})

async function favorite() {
  await api.post('/favorites/', { itinerary: itinerary.value?.id })
}
</script>
