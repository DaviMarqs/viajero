<template>
  <BaseCard>
    <h1 class="mb-4 text-2xl font-semibold">Usuários</h1>
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-slate-500">
          <th class="pb-3">E-mail</th>
          <th class="pb-3">Role</th>
          <th class="pb-3">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id" class="border-b border-slate-100">
          <td class="py-3">{{ user.email }}</td>
          <td class="py-3">{{ user.role }}</td>
          <td class="py-3">{{ user.status }}</td>
        </tr>
      </tbody>
    </table>
  </BaseCard>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { api } from '@/api/client'
import BaseCard from '@/components/ui/BaseCard.vue'

const users = ref<any[]>([])
onMounted(async () => {
  const { data } = await api.get('/admin/users/')
  users.value = data.results
})
</script>
