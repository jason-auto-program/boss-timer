<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useBossStore, type BossConfig } from '../stores/bossStore';
import { MAPS } from '../config/bossConfig';
import { Trash2, Edit2, Plus, X, Info } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const store = useBossStore();

// Form State
const isEditing = ref(false);
const editId = ref<string | null>(null);
const form = ref({
    name: '',
    map_id: MAPS[0].id,
    level_name: '',
    interval: 10800, // default 180 mins
    is_visible: true // default visible
});

const resetForm = () => {
    isEditing.value = false;
    editId.value = null;
    form.value = {
        name: '',
        map_id: MAPS[0].id,
        level_name: '',
        interval: 10800,
        is_visible: true
    };
};

const handleEdit = (boss: BossConfig) => {
    isEditing.value = true;
    editId.value = boss.id;
    form.value = {
        name: boss.name,
        map_id: boss.map_id,
        level_name: boss.level_name,
        interval: boss.interval,
        is_visible: boss.is_visible !== false
    };
};

const handleDelete = async (boss: BossConfig) => {
    if (confirm(`确定要删除 ${boss.name} 吗？`)) {
        await store.deleteBoss(boss.id);
    }
};

const handleSubmit = async () => {
    if (!form.value.name || !form.value.level_name) return;

    if (isEditing.value && editId.value) {
        await store.updateBoss(editId.value, { ...form.value });
    } else {
        await store.addBoss({ ...form.value });
    }
    resetForm();
};

const intervalMinutes = computed({
    get: () => Math.floor(form.value.interval / 60),
    set: (val) => {
        form.value.interval = val * 60;
    }
});
</script>

<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }">
    <div class="modal-box w-11/12 max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
      <!-- Header -->
      <div class="p-4 border-b flex justify-between items-center bg-base-100 z-10">
         <h3 class="font-bold text-lg">⚙️ Boss 列表管理</h3>
         <button class="btn btn-sm btn-circle btn-ghost" @click="$emit('close')">
            <X class="w-5 h-5" />
         </button>
      </div>

      <!-- Global Settings Bar -->
      <div class="px-4 py-3 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-2">
              <span class="font-bold text-sm text-slate-700">🌍 全局倍率 (活动)</span>
              <div class="tooltip tooltip-right font-normal" data-tip="输入 0.5 表示时间减半 (180m -> 90m)">
                  <Info class="w-4 h-4 text-slate-400 cursor-help" />
              </div>
          </div>
          <div class="flex items-center gap-2">
              <input 
                  type="number" 
                  step="0.1" 
                  min="0.1"
                  class="input input-sm input-bordered w-24 text-center font-bold" 
                  :value="store.globalMultiplier"
                  @input="e => store.setGlobalMultiplier(parseFloat((e.target as HTMLInputElement).value) || 1)"
              />
              <span class="text-xs text-slate-500 w-24">
                 {{ store.globalMultiplier < 1 ? '🔥 加速模式' : (store.globalMultiplier > 1 ? '🐢 减速模式' : '正常模式') }}
              </span>
          </div>
      </div>

      <div class="flex-1 flex overflow-hidden">
         
         <!-- List (Left Side) -->
         <div class="flex-1 overflow-y-auto p-4 bg-base-100">
             <table class="table table-sm table-pin-rows">
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>显示</th>
                        <th>地图</th>
                        <th>位置</th>
                        <th>间隔(分)</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="boss in store.bossConfigs" :key="boss.id" class="hover">
                        <td class="font-bold">{{ boss.name }}</td>
                        <td>
                            <input type="checkbox" class="checkbox checkbox-xs" :checked="boss.is_visible !== false" disabled />
                        </td>
                        <td>{{ MAPS.find(m => m.id === boss.map_id)?.name || boss.map_id }}</td>
                        <td>{{ boss.level_name }}</td>
                        <td>{{ Math.floor(boss.interval / 60) }}</td>
                        <td class="flex gap-2">
                            <button class="btn btn-xs btn-square btn-ghost" @click="handleEdit(boss)">
                                <Edit2 class="w-3 h-3" />
                            </button>
                            <button class="btn btn-xs btn-square btn-ghost text-error" @click="handleDelete(boss)">
                                <Trash2 class="w-3 h-3" />
                            </button>
                        </td>
                    </tr>
                </tbody>
             </table>
             <div v-if="store.bossConfigs.length === 0" class="text-center py-10 opacity-50">
                暂无数据，请添加 Boss
             </div>
         </div>

         <!-- Editor (Right Side) -->
         <div class="w-80 border-l bg-base-50 p-4 overflow-y-auto shrink-0 transition-all">
             <h4 class="font-bold mb-4">{{ isEditing ? '编辑 Boss' : '添加新 Boss' }}</h4>
             
             <div class="form-control w-full max-w-xs space-y-4">
                <div>
                    <label class="label"><span class="label-text">Boss 名称</span></label>
                    <input v-model="form.name" type="text" placeholder="例如: 吞天魔罐" class="input input-bordered w-full" />
                </div>

                <div>
                    <label class="label"><span class="label-text">所属地图</span></label>
                    <select v-model="form.map_id" class="select select-bordered w-full">
                        <option v-for="map in MAPS" :key="map.id" :value="map.id">{{ map.name }}</option>
                    </select>
                </div>

                <div>
                    <label class="label"><span class="label-text">位置/关卡</span></label>
                    <input v-model="form.level_name" type="text" placeholder="例如: 第三层" class="input input-bordered w-full" />
                </div>

                <div>
                    <label class="label"><span class="label-text">刷新间隔 (分钟)</span></label>
                    <input v-model.number="intervalMinutes" type="number" class="input input-bordered w-full" />
                </div>

                <div class="form-control">
                  <label class="label cursor-pointer justify-start gap-4">
                    <span class="label-text">首页显示</span> 
                    <input type="checkbox" v-model="form.is_visible" class="checkbox" />
                  </label>
                </div>

                <div class="pt-4 flex gap-2">
                    <button class="btn btn-primary flex-1" @click="handleSubmit" :disabled="!form.name">
                        <span v-if="!isEditing"><Plus class="w-4 h-4" /> 添加</span>
                        <span v-else>保存修改</span>
                    </button>
                    <button v-if="isEditing" class="btn btn-ghost" @click="resetForm">取消</button>
                </div>
             </div>
         </div>

      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
        <button @click="$emit('close')">close</button>
    </form>
  </dialog>
</template>
