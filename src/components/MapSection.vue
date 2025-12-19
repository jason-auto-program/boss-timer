<script setup lang="ts">
import { computed } from 'vue';
import { useBossStore, type BossView } from '../stores/bossStore';
import BossCard from './BossCard.vue';
import { Volume2 } from 'lucide-vue-next';
import draggable from 'vuedraggable';
import { SOUND_OPTIONS } from '../utils/audio';

// ...

const props = defineProps<{
    map: { id: string; name: string };
}>();

const store = useBossStore();

const bosses = computed({
    get: () => store.bossListView.filter(b => b.map_id === props.map.id && !b.is_pinned),
    set: (val: BossView[]) => {
        // Extract IDs in new order and update store
        const newOrder = val.map(b => b.id);
        store.updatePartialOrder(newOrder);
    }
});

const selectSound = (mapId: string, soundId: string, event: Event) => {
    store.setMapSound(mapId, soundId);
    const details = (event.target as HTMLElement).closest('details');
    if (details) details.removeAttribute('open');
};
</script>

<template>
    <div v-if="bosses.length > 0">
        <div class="flex items-center gap-2 mb-2 px-1 mt-4">
            <h2 class="text-sm font-bold text-slate-500">
                {{ map.name }}
            </h2>
            
            <!-- Sound Config Dropdown (Using Details for Click Behavior) -->
            <details class="dropdown dropdown-right">
                <summary tabindex="0" role="button" class="btn btn-ghost btn-xs btn-circle text-slate-300 hover:text-blue-500 min-h-0 w-6 h-6">
                    <Volume2 class="w-3.5 h-3.5" :class="{ 'text-blue-400': currentSound !== 'none' }" />
                </summary>
                <ul tabindex="0" class="dropdown-content z-[20] menu p-1 shadow-lg bg-white/95 backdrop-blur rounded-lg w-28 border border-slate-100 text-slate-600">
                    <li v-for="sound in SOUND_OPTIONS" :key="sound.id">
                        <a @click="selectSound(map.id, sound.id, $event)" 
                           :class="{ 'font-bold text-blue-600 bg-blue-50': currentSound === sound.id }"
                           class="text-xs py-1.5 rounded-md"
                        >
                            {{ sound.name }}
                        </a>
                    </li>
                </ul>
            </details>

            <div class="h-[1px] bg-slate-200 flex-1"></div>
        </div>
        
        <!-- Draggable Grid -->
        <draggable 
            v-model="bosses" 
            item-key="id"
            class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2"
            ghost-class="opacity-50"
            :animation="200"
        >
            <template #item="{ element }">
                <BossCard :boss="element" />
            </template>
        </draggable>
    </div>
</template>
