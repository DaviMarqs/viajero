<template>
  <BaseCard class="mx-auto max-w-xl">
    <form class="space-y-4" @submit.prevent="submit">
      <h1 class="text-2xl font-semibold">Resetar senha</h1>
      <BaseInput v-model="token" label="Token" />
      <BaseInput v-model="password" label="Nova senha" type="password" />
      <BaseButton type="submit">Atualizar senha</BaseButton>
      <p v-if="message" class="text-sm text-slate-600">{{ message }}</p>
    </form>
  </BaseCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'

import { api } from '@/api/client'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'

const token = ref('')
const password = ref('')
const message = ref('')

async function submit() {
  const { data } = await api.post('/auth/reset_password/', { token: token.value, password: password.value })
  message.value = data.detail
}
</script>
