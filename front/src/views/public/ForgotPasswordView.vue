<template>
  <BaseCard class="mx-auto max-w-xl">
    <form class="space-y-4" @submit.prevent="submit">
      <h1 class="text-2xl font-semibold">Esqueci minha senha</h1>
      <BaseInput v-model="email" label="E-mail" type="email" />
      <BaseButton type="submit">Gerar token</BaseButton>
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

const email = ref('')
const message = ref('')

async function submit() {
  const { data } = await api.post('/auth/forgot_password/', { email: email.value })
  message.value = data.dev_token ? `Token de desenvolvimento: ${data.dev_token}` : data.detail
}
</script>
