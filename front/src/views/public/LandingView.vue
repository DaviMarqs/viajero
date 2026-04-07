<template>
  <section class="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
    <div class="rounded-[2rem] bg-slate-950 p-10 text-white shadow-panel">
      <p class="text-xs uppercase tracking-[0.3em] text-brand-300">Viajeiro</p>
      <h1 class="mt-4 max-w-2xl text-5xl font-semibold leading-tight">Roteiros personalizados, onboarding guiado e operação pronta para crescer.</h1>
      <p class="mt-6 max-w-xl text-slate-300">
        Cadastre preferências, monte roteiros manualmente, use templates ou gere sugestões automáticas por regras.
      </p>
      <div class="mt-8 flex gap-4">
        <RouterLink to="/register" class="rounded-2xl bg-brand-500 px-5 py-3 font-semibold text-white">Começar</RouterLink>
        <RouterLink to="/login" class="rounded-2xl border border-white/20 px-5 py-3 font-semibold text-white">Entrar</RouterLink>
      </div>
    </div>
    <div class="grid gap-4">
      <BaseCard>
        <h2 class="text-lg font-semibold">Fluxos prontos</h2>
        <p class="mt-2 text-sm text-slate-600">Autenticação JWT, onboarding, CRUD de roteiros, favoritos, reviews, LGPD e área administrativa.</p>
      </BaseCard>
      <BaseCard>
        <h2 class="text-lg font-semibold">Escalável</h2>
        <p class="mt-2 text-sm text-slate-600">Camada de geração automática isolada para futura troca por IA sem reescrever o domínio.</p>
      </BaseCard>
    </div>
  </section>
</template>

<script setup lang="ts">
import BaseCard from '@/components/ui/BaseCard.vue'
</script>
