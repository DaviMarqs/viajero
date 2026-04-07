<template>
  <BaseCard>
    <div class="mb-4 flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Meus roteiros</h1>
      <RouterLink to="/app/itineraries/create" class="rounded-2xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white">Novo roteiro</RouterLink>
    </div>
    <div class="grid gap-4 md:grid-cols-2">
      <div v-for="item in itineraries" :key="item.id" class="rounded-2xl border border-slate-200 p-4">
        <h2 class="font-semibold">{{ item.title }}</h2>
        <p class="mt-2 text-sm text-slate-600">{{ item.description }}</p>
        <div class="mt-4 flex gap-3 text-sm">
          <RouterLink :to="`/app/itineraries/${item.id}`">Detalhes</RouterLink>
          <RouterLink :to="`/app/itineraries/${item.id}/edit`">Editar</RouterLink>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'
import type { ApiListResponse, Itinerary } from '@/types'

const itineraries = ref<Itinerary[]>([])

onMounted(async () => {
  const { data } = await api.get<ApiListResponse<Itinerary>>('/itineraries/')
  itineraries.value = data.results
})
</script>
