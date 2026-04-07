<template>
  <BaseCard>
    <form class="space-y-4" @submit.prevent="createManual">
      <h1 class="text-2xl font-semibold">Criar roteiro</h1>
      <div class="grid gap-4 md:grid-cols-2">
        <BaseInput v-model="manual.title" label="Título" />
        <BaseInput v-model="manual.description" label="Descrição" />
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        <label class="text-sm font-medium">Destino
          <select v-model="manual.destination" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option v-for="destination in destinations" :key="destination.id" :value="destination.id">{{ destination.city }}</option>
          </select>
        </label>
        <label class="text-sm font-medium">Template
          <select v-model="templateId" class="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3">
            <option :value="0">Nenhum</option>
            <option v-for="template in templates" :key="template.id" :value="template.id">{{ template.name }}</option>
          </select>
        </label>
      </div>
      <div class="flex flex-wrap gap-3">
        <BaseButton type="submit">Criar manual</BaseButton>
        <BaseButton type="button" @click="createFromTemplate">Criar do template</BaseButton>
        <BaseButton type="button" @click="createAutomatic">Criar automático</BaseButton>
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
import type { ApiListResponse, Destination } from '@/types'

const router = useRouter()
const destinations = ref<Destination[]>([])
const templates = ref<any[]>([])
const templateId = ref(0)
const manual = reactive({
  destination: 0,
  title: 'Meu novo roteiro',
  description: 'Planejamento inicial.',
  origin: 'manual',
  budget_estimate: 0,
  is_public: false,
  days: [
    {
      day_number: 1,
      title: 'Dia 1',
      summary: 'Chegada e ambientação',
      items: [{ category: 'tour', title: 'Atividade inicial', description: 'Explorar a região.', sort_order: 1 }],
    },
  ],
})

onMounted(async () => {
  const destinationsResponse = await api.get<ApiListResponse<Destination>>('/destinations/')
  const templatesResponse = await api.get<ApiListResponse<any>>('/templates/')
  destinations.value = destinationsResponse.data.results
  templates.value = templatesResponse.data.results
  manual.destination = destinations.value[0]?.id ?? 0
})

async function createManual() {
  const { data } = await api.post('/itineraries/', manual)
  router.push(`/app/itineraries/${data.id}`)
}

async function createFromTemplate() {
  const { data } = await api.post('/itineraries/from_template/', { template_id: templateId.value, title: manual.title })
  router.push(`/app/itineraries/${data.id}`)
}

async function createAutomatic() {
  const { data } = await api.post('/itineraries/automatic/', { destination_id: manual.destination, title: manual.title })
  router.push(`/app/itineraries/${data.id}`)
}
</script>
