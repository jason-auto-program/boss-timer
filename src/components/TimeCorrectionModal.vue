<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { format, subMinutes, setHours, setMinutes, setSeconds } from 'date-fns';

const props = defineProps<{
  isOpen: boolean;
  bossName: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submit', timestamp: number): void;
}>();

const mode = ref<'relative' | 'absolute'>('relative');
const minutesAgo = ref<number | ''>('');
const absoluteTime = ref(format(new Date(), 'HH:mm'));

// Reset inputs when modal opens
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        mode.value = 'relative';
        minutesAgo.value = '';
        absoluteTime.value = format(new Date(), 'HH:mm');
    }
});

const calculatedTime = computed(() => {
    const now = new Date();
    if (mode.value === 'relative') {
        if (!minutesAgo.value) return now;
        return subMinutes(now, Number(minutesAgo.value));
    } else {
        const [hours, minutes] = absoluteTime.value.split(':').map(Number);
        return setSeconds(setMinutes(setHours(now, hours), minutes), 0);
    }
});

const handleSubmit = () => {
    emit('submit', calculatedTime.value.getTime());
    emit('close');
};

</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">修正时间 - {{ bossName }}</h3>
      
      <div role="tablist" class="tabs tabs-boxed mb-4">
        <a role="tab" class="tab" :class="{ 'tab-active': mode === 'relative' }" @click="mode = 'relative'">几分钟前</a>
        <a role="tab" class="tab" :class="{ 'tab-active': mode === 'absolute' }" @click="mode = 'absolute'">具体时间</a>
      </div>

      <div class="py-4">
        <div v-if="mode === 'relative'" class="form-control">
            <label class="label">
                <span class="label-text">多少分钟前击杀的？</span>
            </label>
            <div class="join">
                <input v-model="minutesAgo" type="number" placeholder="例如: 10" class="input input-bordered join-item w-full" autofocus />
                <button class="btn join-item">分钟前</button>
            </div>
        </div>

        <div v-else class="form-control">
            <label class="label">
                <span class="label-text">具体击杀时间 (今天)</span>
            </label>
            <input v-model="absoluteTime" type="time" class="input input-bordered w-full" />
        </div>

        <div class="mt-4 text-sm text-center opacity-70">
            修正为: {{ format(calculatedTime, 'yyyy-MM-dd HH:mm:ss') }}
        </div>
      </div>

      <div class="modal-action">
        <button class="btn" @click="$emit('close')">取消</button>
        <button class="btn btn-primary" @click="handleSubmit">确认修正</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button @click="$emit('close')">close</button>
    </form>
  </dialog>
</template>
