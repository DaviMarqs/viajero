<template>
  <aside class="hidden w-72 shrink-0 flex-col rounded-3xl bg-slate-950 p-6 text-slate-100 lg:flex">
    <div class="mb-8">
      <p class="text-xs uppercase tracking-[0.3em] text-brand-300">Viajeiro</p>
      <h1 class="mt-2 text-2xl font-semibold">Planeje sem atrito</h1>
    </div>
    <nav class="space-y-2">
      <RouterLink v-for="item in items" :key="item.to" :to="item.to" class="block rounded-2xl px-4 py-3 text-sm hover:bg-slate-800">
        {{ item.label }}
      </RouterLink>
    </nav>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ items: Array<{ label: string; to: string }> }>()
</script>
