<template>
  <BaseCard>
    <form class="space-y-4" @submit.prevent="save">
      <h1 class="text-2xl font-semibold">Editar roteiro</h1>
      <BaseInput v-model="form.title" label="Título" />
      <BaseInput v-model="form.description" label="Descrição" />
      <BaseButton type="submit">Salvar</BaseButton>
    </form>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { api } from '@/api/client'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const route = useRoute()
const router = useRouter()
const form = reactive<any>({})

onMounted(async () => {
  const { data } = await api.get(`/itineraries/${route.params.id}/`)
  Object.assign(form, data)
})

async function save() {
  await api.put(`/itineraries/${route.params.id}/`, form)
  router.push(`/app/itineraries/${route.params.id}`)
}
</script>
