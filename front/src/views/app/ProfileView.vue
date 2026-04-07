<template>
  <BaseCard>
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="save">
      <h1 class="md:col-span-2 text-2xl font-semibold">Meu perfil</h1>
      <BaseInput v-model="form.location" label="Localização" />
      <BaseInput v-model="form.avatar_url" label="Avatar URL" />
      <div class="md:col-span-2">
        <BaseInput v-model="form.bio" label="Bio" />
      </div>
      <div class="md:col-span-2">
        <BaseButton type="submit">Salvar perfil</BaseButton>
      </div>
    </form>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, reactive } from 'vue'

import { api } from '@/api/client'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const form = reactive({ location: '', avatar_url: '', bio: '' })

onMounted(async () => {
  const { data } = await api.get('/profile/me/')
  Object.assign(form, data)
})

async function save() {
  await api.patch('/profile/me/', form)
}
</script>
