```vue
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useBossStore } from './stores/bossStore';
import { MAPS } from './config/bossConfig';
import BossCard from './components/BossCard.vue';
import MapSection from './components/MapSection.vue';
import ConfigModal from './components/ConfigModal.vue';
import { format } from 'date-fns';
import { LayoutList, Grip, Settings } from 'lucide-vue-next';
import draggable from 'vuedraggable';

const store = useBossStore();

// Init store
onMounted(() => {
    store.init();
});

// State
// const activeMapId = ref(MAPS[0].id); // Removed in favor of flattened view
const viewMode = ref<'category' | 'soon'>('category');

const isConfigOpen = ref(false);

// Computed
const currentTime = computed(() => {
    return format(store.now, 'HH:mm:ss');
});

const pinnedBosses = computed(() => {
    return store.bossListView.filter(b => b.is_pinned);
});

// Removed currentMapBosses computed property

const sortedSoonBosses = computed(() => {
    // Filter out pinned bosses (shown in top section) and sort by time
    return store.bossListView
        .filter(b => !b.is_pinned)
        .sort((a, b) => a.remainingSeconds - b.remainingSeconds);
});

const pinnedList = computed({
    get: () => pinnedBosses.value,
    set: (val) => {
        store.updatePartialOrder(val.map(b => b.id));
    }
});

// Actions

</script>

<template>
  <div class="min-h-screen bg-slate-50 pb-20">
    <!-- Navbar -->
    <div class="navbar bg-white shadow-sm sticky top-0 z-50 px-4 h-16">
        <div class="navbar-start">
            <div class="join">
                <button 
                    class="btn join-item btn-sm font-normal" 
                    :class="{ 'btn-active btn-neutral': viewMode === 'category' }"
                    @click="viewMode = 'category'"
                >
                    <Grip class="w-4 h-4" /> 分类
                </button>
                <button 
                    class="btn join-item btn-sm font-normal" 
                    :class="{ 'btn-active btn-neutral': viewMode === 'soon' }"
                    @click="viewMode = 'soon'"
                >
                    <LayoutList class="w-4 h-4" /> 刷新顺序
                </button>
            </div>
        </div>
        
        <div class="navbar-center">
            <div class="text-xl font-mono font-bold text-slate-400">
                {{ currentTime }}
            </div>
        </div>
        
        <div class="navbar-end gap-2">
            <div class="flex items-center gap-2 bg-slate-100/50 px-2 py-1 rounded-lg border border-slate-200/50">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">真实时间</span>
                <input 
                    type="checkbox" 
                    class="toggle toggle-xs toggle-primary" 
                    :checked="store.showAbsoluteTime"
                    @change="store.toggleTimeDisplay()"
                />
            </div>
            <button class="btn btn-ghost btn-circle btn-sm" @click="isConfigOpen = true">
                <Settings class="w-5 h-5 text-slate-400" />
            </button>
        </div>
    </div>

    <div class="container mx-auto p-2 space-y-4 max-w-[1920px]">
        
        <!-- Pinned Section -->
        <div v-if="pinnedBosses.length > 0">
            <h2 class="text-xs font-bold text-amber-500 mb-2 flex items-center gap-2 px-1">
                 ★ 特别关注
            </h2>
            <draggable 
                v-model="pinnedList" 
                item-key="id"
                class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2"
                :animation="200"
                ghost-class="opacity-50"
            >
                <template #item="{ element: boss }">
                    <BossCard 
                        :boss="boss"
                    />
                </template>
            </draggable>
        </div>

        <!-- Category View: Flattened Maps -->
        <template v-if="viewMode === 'category'">
            <div v-for="map in MAPS" :key="map.id">
                 <MapSection :map="map" />
            </div>
        </template>

        <!-- Soon View -->
        <template v-else>
             <div>
                <h2 class="text-sm font-bold text-slate-600 mb-2 px-1">🚀 即将刷新 (全部)</h2>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-2">
                     <BossCard 
                        v-for="boss in sortedSoonBosses" 
                        :key="boss.id" 
                        :boss="boss"
                    />
                </div>
             </div>
        </template>

    </div>

    <!-- Modals -->
<!-- Removed TimeCorrectionModal -->
    
    <!-- Error Toast -->
    <div v-if="store.error" class="toast toast-end z-50">
        <div class="alert alert-error text-white text-sm">
            <span>{{ store.error }}</span>
            <button class="btn btn-xs btn-ghost" @click="store.error = null">✕</button>
        </div>
    </div>
    
    <ConfigModal 
        :is-open="isConfigOpen"
        @close="isConfigOpen = false"
    />
  </div>
</template>
