<template>
  <label class="flex flex-col gap-2 text-sm font-medium text-slate-700">
    <span>{{ label }}</span>
    <input
      :type="type"
      :value="modelValue"
      class="rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-brand-500"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    />
  </label>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ label: string; modelValue: string | number; type?: string }>(), {
  type: 'text',
})
defineEmits<{ 'update:modelValue': [value: string] }>()
</script>
