<template>
  <BaseCard class="mx-auto max-w-xl">
    <form class="space-y-4" @submit.prevent="submit">
      <h1 class="text-2xl font-semibold">Entrar</h1>
      <BaseInput v-model="form.email" label="E-mail" type="email" />
      <BaseInput v-model="form.password" label="Senha" type="password" />
      <p v-if="error" class="text-sm text-rose-600">{{ error }}</p>
      <BaseButton type="submit" :disabled="loading">{{ loading ? 'Entrando...' : 'Entrar' }}</BaseButton>
    </form>
  </BaseCard>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import BaseButton from '@/components/ui/BaseButton.vue'
import BaseCard from '@/components/ui/BaseCard.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const loading = ref(false)
const error = ref('')
const form = reactive({ email: 'admin@viajeiro.local', password: 'Viajeiro123!' })

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.login(form)
    router.push(auth.isAdmin ? '/admin-app' : '/app')
  } catch (err: any) {
    error.value = err.response?.data?.detail ?? 'Falha ao autenticar.'
  } finally {
    loading.value = false
  }
}
</script>
