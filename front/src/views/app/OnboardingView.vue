<template>
  <BaseCard>
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submit">
      <h1 class="md:col-span-2 text-2xl font-semibold">Onboarding</h1>
      <BaseInput v-model="profile.location" label="Localização" />
      <BaseInput v-model="profile.bio" label="Bio" />
      <BaseInput v-model="dna.traveler_type" label="Tipo de viajante" />
      <BaseInput v-model="dna.comfort_level" label="Nível de conforto" />
      <BaseInput v-model="dna.preferred_company" label="Companhia preferida" />
      <BaseInput v-model="dna.travel_pace" label="Ritmo de viagem" />
      <BaseInput v-model="preferences.preferred_duration_days" label="Duração preferida" />
      <BaseInput v-model="preferences.budget_level" label="Orçamento" />
      <BaseInput v-model="preferences.desired_climate" label="Clima desejado" />
      <BaseInput v-model="preferences.destination_type" label="Tipo de destino" />
      <label class="md:col-span-2 text-sm font-medium">Interesses</label>
      <div class="md:col-span-2 grid gap-2 md:grid-cols-3">
        <label v-for="item in interests" :key="item.id" class="flex items-center gap-2 rounded-2xl border border-slate-200 p-3 text-sm">
          <input v-model="selectedInterests" :value="item.id" type="checkbox" />
          {{ item.name }}
        </label>
      </div>
      <div class="md:col-span-2 flex gap-4">
        <BaseButton type="submit">Concluir onboarding</BaseButton>
        <p v-if="message" class="text-sm text-slate-600">{{ message }}</p>
      </div>
    </form>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { api } from '@/api/client'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const message = ref('')
const interests = ref<Array<{ id: number; name: string }>>([])
const selectedInterests = ref<number[]>([])
const profile = reactive({ location: '', bio: '' })
const dna = reactive({ traveler_type: '', comfort_level: '', preferred_company: '', travel_pace: '' })
const preferences = reactive({ preferred_duration_days: '4', budget_level: 'moderado', desired_climate: 'quente', destination_type: 'praia' })

onMounted(async () => {
  const { data } = await api.get('/onboarding/meta/')
  interests.value = data.interests
  selectedInterests.value = auth.currentUser?.interests.map((item) => item.id) ?? []
})

async function submit() {
  await api.post('/onboarding/complete/', {
    profile,
    dna,
    preferences: { ...preferences, preferred_duration_days: Number(preferences.preferred_duration_days), interest_ids: selectedInterests.value },
    consents: [
      { consent_type: 'terms', accepted: true, version: 'v1' },
      { consent_type: 'privacy', accepted: true, version: 'v1' },
      { consent_type: 'ai_usage', accepted: true, version: 'v1' },
    ],
  })
  await auth.fetchCurrentUser()
  message.value = 'Onboarding concluído.'
  router.push('/app')
}
</script>
