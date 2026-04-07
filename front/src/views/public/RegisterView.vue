<template>
  <BaseCard class="mx-auto max-w-2xl">
    <form class="grid gap-4 md:grid-cols-2" @submit.prevent="submit">
      <h1 class="md:col-span-2 text-2xl font-semibold">Criar conta</h1>
      <BaseInput v-model="form.first_name" label="Nome" />
      <BaseInput v-model="form.last_name" label="Sobrenome" />
      <BaseInput v-model="form.email" label="E-mail" type="email" />
      <BaseInput v-model="form.preferred_language" label="Idioma" />
      <div class="md:col-span-2">
        <BaseInput v-model="form.password" label="Senha" type="password" />
      </div>
      <label class="md:col-span-2 flex items-center gap-2 text-sm"><input v-model="form.accepted_terms" type="checkbox" /> Aceito os termos</label>
      <label class="md:col-span-2 flex items-center gap-2 text-sm"><input v-model="form.accepted_privacy" type="checkbox" /> Aceito a política de privacidade</label>
      <label class="md:col-span-2 flex items-center gap-2 text-sm"><input v-model="form.accepted_ai_policy" type="checkbox" /> Aceito a política futura de IA</label>
      <p v-if="error" class="md:col-span-2 text-sm text-rose-600">{{ error }}</p>
      <div class="md:col-span-2">
        <BaseButton type="submit" :disabled="loading">{{ loading ? 'Criando...' : 'Criar conta' }}</BaseButton>
      </div>
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
const form = reactive({
  first_name: '',
  last_name: '',
  email: '',
  preferred_language: 'pt-BR',
  password: '',
  accepted_terms: true,
  accepted_privacy: true,
  accepted_ai_policy: true,
})

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await auth.register(form)
    router.push('/app/onboarding')
  } catch (err: any) {
    error.value = JSON.stringify(err.response?.data ?? 'Falha ao registrar.')
  } finally {
    loading.value = false
  }
}
</script>
