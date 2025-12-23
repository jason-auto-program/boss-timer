<script setup lang="ts">
import { computed, ref, nextTick } from 'vue';
import { type BossView, useBossStore } from '../stores/bossStore';
import { Star, Palette } from 'lucide-vue-next';

const props = defineProps<{
  boss: BossView;
}>();

const store = useBossStore();

// Status Logic
const statusColor = computed(() => {
  switch (props.boss.status) {
    case 'ready': return 'bg-green-500/10';
    case 'critical': return 'bg-orange-500/10 animate-breathe';
    case 'soon': return 'bg-blue-500/10';
    case 'wait': return 'bg-white/60 hover:bg-white/80';
    case 'missed': return 'bg-slate-200/50 text-slate-400';
    default: return 'bg-white/60';
  }
});

const borderClass = computed(() => {
    // If color_index is 0, use status-based borders
    if (props.boss.color_index === 0) {
        switch (props.boss.status) {
            case 'ready': return 'border-green-500/30';
            case 'critical': return 'border-orange-500/40';
            case 'soon': return 'border-blue-500/30';
            case 'wait': return 'border-slate-200';
            case 'missed': return 'border-slate-300';
            default: return 'border-slate-200';
        }
    }
    // Custom colors (Prominent)
    switch (props.boss.color_index) {
        case 1: return '!border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]';
        case 2: return '!border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
        case 3: return '!border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.2)]';
        case 4: return '!border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
        case 5: return '!border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]';
        default: return 'border-slate-200';
    }
});

// Timer Decomposition
const timeParts = computed(() => {
  const seconds = props.boss.remainingSeconds;
  return {
    h: Math.floor(seconds / 3600),
    m: Math.floor((seconds % 3600) / 60),
    s: seconds % 60
  };
});

// Granular Editing State
const editingPart = ref<'h' | 'm' | 's' | null>(null);
const editInputRef = ref<HTMLInputElement | null>(null);
const tempValue = ref('');

const startEdit = async (part: 'h' | 'm' | 's') => {
  editingPart.value = part;
  // Initialize with current value (padded? No, raw number for editing is easier)
  const val = timeParts.value[part];
  tempValue.value = val.toString();
  
  await nextTick();
  editInputRef.value?.focus();
  editInputRef.value?.select();
};

const finishEdit = () => {
  if (!editingPart.value) return;
  
  const rawIdx = parseInt(tempValue.value);
  if (isNaN(rawIdx) || rawIdx < 0) {
    editingPart.value = null; // Cancel if invalid
    return;
  }

  const current = timeParts.value;
  let newH = current.h;
  let newM = current.m;
  let newS = current.s;

  // Update specific part
  // For M and S, clamp to 0-59? Or allow overflow? 
  // User says "click MM only modify MM". 
  // If I type 90 in MM, it should probably be 59? Or 30 (and +1h)?
  // Standard digital clock behavior: usually 0-59.
  const val = rawIdx;

  if (editingPart.value === 'h') {
    newH = val;
  } else if (editingPart.value === 'm') {
    newM = Math.min(59, val); // Rigid clamp for simplicity
  } else if (editingPart.value === 's') {
    newS = Math.min(59, val);
  }

  // Calculate new remaining duration
  // Calculate new remaining duration
  const newRemainingMs = (newH * 3600 + newM * 60 + newS) * 1000;
  
  // Update DB
  // Use the pre-calculated effective interval from store (includes Event Mode multiplier)
  const effectiveIntervalMs = props.boss.effectiveInterval * 1000;
  const now = Date.now();
  const newKillTime = now + newRemainingMs - effectiveIntervalMs;
  
  store.updateKillTime(props.boss.id, newKillTime);
  
  editingPart.value = null;
};

const handleDoubleClick = () => {
    if (editingPart.value) return; 
    store.updateKillTime(props.boss.id, Date.now());
};

const handlePin = () => {
    store.togglePin(props.boss.id);
};

// Helper for padding
const pad = (n: number) => n.toString().padStart(2, '0');

</script>

<template>
  <div 
    class="relative overflow-hidden transition-all duration-300 rounded-xl p-2 select-none group border shadow-sm backdrop-blur-xl"
    :class="[statusColor, borderClass, props.boss.color_index > 0 ? 'border-2' : 'border']"
    @dblclick="handleDoubleClick"
  >
    <!-- Header: Apple Style (Clean, One Line, Compact) -->
    <div class="flex justify-between items-center mb-1 h-5">
      <div class="flex items-baseline overflow-hidden gap-1.5">
           <!-- Location (Gray, Smaller) -->
           <span v-if="boss.level_name" class="text-xs font-medium text-slate-400 truncate shrink-0">
             {{ boss.level_name }}
           </span>
           <!-- Name (Dark, Bolder) -->
           <span class="font-semibold text-sm text-slate-700 truncate tracking-tight">
             {{ boss.name }}
           </span>
      </div>
      
      <!-- Actions (Modern, Subtle) -->
      <div class="flex items-center gap-0.5 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
          <!-- Color Cycle -->
          <button 
            @click.stop="store.cycleBossColor(boss.id)" 
            class="btn btn-ghost btn-xs btn-circle h-5 w-5 min-h-0"
            title="切换边框颜色"
          >
              <Palette class="w-3.5 h-3.5" :class="boss.color_index > 0 ? 'text-slate-600' : 'text-slate-300'" />
          </button>
          
          <!-- Star Icon -->
          <button 
            @click.stop="handlePin" 
            class="btn btn-ghost btn-xs btn-circle h-5 w-5 min-h-0"
            :class="boss.is_pinned ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'"
          >
              <Star class="w-3.5 h-3.5 transition-transform active:scale-90" :class="{ 'fill-current': boss.is_pinned }" />
          </button>
      </div>
    </div>

    <!-- Timer Area (Compact) -->
    <div class="flex justify-center items-center py-0.5 h-9">
        
        <!-- Case 1: Ready to Kill -->
        <div v-if="boss.status === 'ready'" class="animate-in fade-in zoom-in duration-300">
            <span class="text-xl font-bold text-emerald-600/90 tracking-widest drop-shadow-sm font-sans">
                待击杀
            </span>
        </div>

        <div v-else-if="boss.status === 'missed'" class="animate-in fade-in zoom-in duration-300">
             <span class="text-xl font-bold text-slate-400 tracking-widest drop-shadow-sm font-sans">
                可能错过
            </span>
        </div>

        <!-- Case 2: Countdown (Granular Edit) -->
        <div v-else class="flex items-center text-2xl font-mono font-bold tracking-tight text-slate-700/90 font-numeric tabular-nums select-none">
            
            <!-- Hours -->
            <div class="relative cursor-pointer hover:bg-slate-100/50 rounded px-0.5 transition-colors" @click.stop="startEdit('h')">
                <span :class="{ 'opacity-0': editingPart === 'h' }">{{ pad(timeParts.h) }}</span>
                <input 
                    v-if="editingPart === 'h'"
                    ref="editInputRef"
                    v-model="tempValue"
                    @blur="finishEdit"
                    @keydown.enter="finishEdit"
                    type="number"
                    class="absolute inset-0 w-full h-full text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500/20 rounded p-0 m-0 no-spin appearance-none"
                />
            </div>

            <span class="mx-0.5 text-slate-400/50 text-lg">:</span>

            <!-- Minutes -->
            <div class="relative cursor-pointer hover:bg-slate-100/50 rounded px-0.5 transition-colors" @click.stop="startEdit('m')">
                <span :class="{ 'opacity-0': editingPart === 'm' }">{{ pad(timeParts.m) }}</span>
                 <input 
                    v-if="editingPart === 'm'"
                    ref="editInputRef"
                    v-model="tempValue"
                    @blur="finishEdit"
                    @keydown.enter="finishEdit"
                    type="number"
                    class="absolute inset-0 w-full h-full text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500/20 rounded p-0 m-0 no-spin appearance-none"
                />
            </div>

            <span class="mx-0.5 text-slate-400/50 text-lg">:</span>

            <!-- Seconds -->
            <div class="relative cursor-pointer hover:bg-slate-100/50 rounded px-0.5 transition-colors" @click.stop="startEdit('s')">
                <span :class="{ 'opacity-0': editingPart === 's' }">{{ pad(timeParts.s) }}</span>
                 <input 
                    v-if="editingPart === 's'"
                    ref="editInputRef"
                    v-model="tempValue"
                    @blur="finishEdit"
                    @keydown.enter="finishEdit"
                    type="number"
                    class="absolute inset-0 w-full h-full text-center bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500/20 rounded p-0 m-0 no-spin appearance-none"
                />
            </div>

        </div>
    </div>
    


  </div>
</template>

<style scoped>
/* Chrome/Safari/Edge/Opera */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type=number] {
  -moz-appearance: textfield;
}

@keyframes breathe {
  0% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0.1); transform: scale(1); }
  50% { box-shadow: 0 0 15px 4px rgba(249, 115, 22, 0.15); transform: scale(1.05); }
  100% { box-shadow: 0 0 0 0 rgba(249, 115, 22, 0); transform: scale(1); }
}

.animate-breathe {
  animation: breathe 1.5s infinite ease-in-out;
}

/* SF Mono or equivalent for nice numbers */
.font-numeric {
    font-variant-numeric: tabular-nums;
    font-feature-settings: "tnum";
}
</style>
