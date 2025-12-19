<script setup lang="ts">
defineProps<{
  maps: { id: string; name: string }[];
  activeId: string;
}>();

defineEmits<{
  (e: 'update:activeId', id: string): void;
}>();
</script>

<template>
  <div role="tablist" class="tabs tabs-boxed">
    <a 
        v-for="map in maps" 
        :key="map.id"
        role="tab" 
        class="tab"
        :class="{ 'tab-active': activeId === map.id }"
        @click="$emit('update:activeId', map.id)"
    >
        {{ map.name }}
    </a>
  </div>
</template>
