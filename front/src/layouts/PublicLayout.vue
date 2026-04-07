<template>
  <div class="min-h-screen">
    <header class="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
      <RouterLink to="/" class="text-2xl font-semibold text-brand-700">Viajeiro</RouterLink>
      <nav class="flex gap-4 text-sm text-slate-600">
        <RouterLink to="/login">Login</RouterLink>
        <RouterLink to="/register">Cadastro</RouterLink>
      </nav>
    </header>
    <main class="mx-auto max-w-7xl px-6 pb-12">
      <RouterView />
    </main>
  </div>
</template>
