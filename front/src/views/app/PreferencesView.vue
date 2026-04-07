<template>
  <div class="grid gap-4 lg:grid-cols-2">
    <BaseCard>
      <form class="space-y-4" @submit.prevent="saveDna">
        <h1 class="text-xl font-semibold">Traveler DNA</h1>
        <BaseInput v-model="dna.traveler_type" label="Tipo" />
        <BaseInput v-model="dna.comfort_level" label="Conforto" />
        <BaseInput v-model="dna.preferred_company" label="Companhia" />
        <BaseInput v-model="dna.travel_pace" label="Ritmo" />
        <BaseButton type="submit">Salvar DNA</BaseButton>
      </form>
    </BaseCard>
    <BaseCard>
      <form class="space-y-4" @submit.prevent="saveTrip">
        <h1 class="text-xl font-semibold">Preferências de viagem</h1>
        <BaseInput v-model="trip.preferred_duration_days" label="Duração" />
        <BaseInput v-model="trip.budget_level" label="Orçamento" />
        <BaseInput v-model="trip.desired_climate" label="Clima" />
        <BaseInput v-model="trip.destination_type" label="Destino" />
        <BaseButton type="submit">Salvar preferências</BaseButton>
      </form>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'

import { api } from '@/api/client'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const dna = reactive({ traveler_type: '', comfort_level: '', preferred_company: '', travel_pace: '' })
const trip = reactive({ preferred_duration_days: '4', budget_level: '', desired_climate: '', destination_type: '' })

onMounted(async () => {
  const dnaResponse = await api.get('/preferences/dna/')
  const tripResponse = await api.get('/preferences/trip/')
  Object.assign(dna, dnaResponse.data)
  Object.assign(trip, { ...tripResponse.data, preferred_duration_days: String(tripResponse.data.preferred_duration_days ?? 4) })
})

async function saveDna() {
  await api.patch('/preferences/dna/', dna)
}

async function saveTrip() {
  await api.patch('/preferences/trip/', { ...trip, preferred_duration_days: Number(trip.preferred_duration_days) })
}
</script>
