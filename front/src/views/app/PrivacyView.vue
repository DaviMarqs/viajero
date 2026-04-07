<template>
  <BaseCard>
    <h1 class="text-2xl font-semibold">Privacidade e LGPD</h1>
    <div class="mt-6 grid gap-4 lg:grid-cols-2">
      <div>
        <h2 class="text-lg font-semibold">Consentimentos</h2>
        <ul class="mt-3 space-y-2 text-sm text-slate-600">
          <li v-for="consent in consents" :key="consent.id">{{ consent.consent_type }} • {{ consent.accepted ? 'aceito' : 'recusado' }}</li>
        </ul>
      </div>
      <form class="space-y-4" @submit.prevent="requestDeletion">
        <BaseInput v-model="reason" label="Motivo da solicitação de exclusão" />
        <BaseButton type="submit">Solicitar exclusão</BaseButton>
      </form>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const consents = ref<any[]>([])
const reason = ref('')

onMounted(async () => {
  const { data } = await api.get('/consents/')
  consents.value = data.results
})

async function requestDeletion() {
  await api.post('/deletion-requests/', { reason: reason.value })
  reason.value = ''
}
</script>
