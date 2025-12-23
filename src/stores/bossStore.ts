
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { type BossConfig } from '../config/bossConfig'
export type { BossConfig }
import { playSound, playWarningSequence } from '../utils/audio'; // Added import

export interface BossState {
    boss_id: string
    last_killed_at: string | null // ISO string from DB
    is_pinned: boolean
    color_index: number
}


export interface BossView extends BossConfig {
    last_killed_at: string | null
    is_pinned: boolean
    color_index: number
    nextRefreshTime: number | null // timestamp
    remainingSeconds: number
    status: 'ready' | 'critical' | 'soon' | 'wait' | 'missed'
    effectiveInterval: number
}

export const useBossStore = defineStore('boss', {
    state: () => ({
        bossConfigs: [] as BossConfig[],
        dbStates: {} as Record<string, BossState>,
        now: Date.now(),
        loading: false,
        error: null as string | null,
        timerInterval: null as number | null, // Changed type to number | null
        // Sound Settings
        mapSounds: {} as Record<string, string>,
        isEventMode: false,
        warnedBosses: new Set<string>(),
        // Card Order Persistence
        cardOrder: JSON.parse(localStorage.getItem('boss-card-order') || '[]') as string[],
    }),

    getters: {
        bossListView(state): BossView[] {
            // Use dynamic config instead of static
            const configs = state.bossConfigs.length > 0 ? state.bossConfigs : []

            const orderMap = new Map(state.cardOrder.map((id, index) => [id, index]));

            return configs.map(config => {
                const dbState = state.dbStates[config.id]
                const last_killed_at = dbState?.last_killed_at || null
                const is_pinned = dbState?.is_pinned || false

                // Calculate refresh time
                const multiplier = state.isEventMode ? (2 / 3) : 1.0;
                const effectiveInterval = (config.interval * multiplier) - 20;

                let nextRefreshTime: number | null = null
                let remainingSeconds = 0
                let status: 'ready' | 'critical' | 'soon' | 'wait' | 'missed' = 'ready'

                if (last_killed_at) {
                    const killedAtMs = new Date(last_killed_at).getTime()
                    nextRefreshTime = killedAtMs + (effectiveInterval * 1000)
                    const remainingMs = nextRefreshTime - state.now
                    remainingSeconds = Math.ceil(remainingMs / 1000)

                    if (remainingSeconds <= -600) {
                        status = 'missed'
                        remainingSeconds = 0
                    } else if (remainingSeconds <= 0) {
                        status = 'ready'
                        remainingSeconds = 0 // Clamp to 0
                    } else if (remainingSeconds <= 60) {
                        status = 'critical'
                    } else if (remainingSeconds <= 1800) { // 30 mins
                        status = 'soon'
                    } else {
                        status = 'wait'
                    }
                } else {
                    status = 'ready'
                    remainingSeconds = 0
                }

                return {
                    ...config,
                    last_killed_at,
                    is_pinned,
                    color_index: dbState?.color_index || 0,
                    nextRefreshTime,
                    remainingSeconds,
                    effectiveInterval,
                    status
                }
            }).filter(b => b.is_visible !== false).sort((a, b) => {
                const indexA = orderMap.has(a.id) ? orderMap.get(a.id)! : 99999;
                const indexB = orderMap.has(b.id) ? orderMap.get(b.id)! : 99999;
                return indexA - indexB;
            });
        }
    },

    actions: {
        async init() {
            if (this.timerInterval) return;

            if (this.timerInterval) clearInterval(this.timerInterval)
            // Timer Loop
            this.timerInterval = window.setInterval(() => {
                this.now = Date.now()
                this.checkWarnings();
            }, 1000)

            await this.fetchConfigs()
            await this.fetchStates()
            await this.fetchMapSounds()

            // Realtime Subscription for States
            supabase
                .channel('boss_states_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'boss_states' },
                    (payload) => {
                        const newRow = payload.new as BossState
                        if (newRow && newRow.boss_id) {
                            this.dbStates[newRow.boss_id] = {
                                ...this.dbStates[newRow.boss_id],
                                ...newRow
                            }
                        }
                    }
                )
                .subscribe()

            // Realtime Subscription for Configs
            supabase
                .channel('boss_configs_changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'boss_configs' },
                    () => {
                        this.fetchConfigs() // Refresh full list on any change
                    }
                )
                .subscribe()
        },

        setCardOrder(newOrder: string[]) {
            this.cardOrder = newOrder;
            localStorage.setItem('boss-card-order', JSON.stringify(newOrder));
        },

        // Helper to update order from a partial list (e.g. reordered usage in a single category)
        updatePartialOrder(reorderedSubset: string[]) {
            // We want to keep the positions of reorderedSubset items relative to the whole list,
            // or just ensure their relative order is updated in the master list.
            // Simple approach: Filter out the subset IDs from current master, then insert them?
            // But where?
            // If the user is reordering a specific map's bosses, they are visually contiguous in that view.
            // But in global list they might be interleaved if other maps exist (but wait, UI filters by map).

            // It's easier if we treat `cardOrder` as the master sequence.
            // If we have existing `cardOrder` = [A, B, C, D, E]
            // And user reorders [B, D] to [D, B] (imagine we only show B and D).
            // New order should be [A, D, C, B, E].

            const subsetSet = new Set(reorderedSubset);
            const others = this.cardOrder.filter(id => !subsetSet.has(id));

            // This is naive. It puts all "others" first or mixes them?
            // Actually, we usually want to persist the NEW order.
            // If `cardOrder` is missing some IDs, we append them.

            // Better Logic:
            // 1. Get current Full List IDs.
            // 2. We only know the new order of `reorderedSubset`.
            // 3. We simply append `reorderedSubset` to `others`?
            //    This moves the moved items to the END of the list (or specific grouping).
            //    If I move Item A inside Map 1, does it matter if it's before or after Map 2's items in global list?
            //    Probably not, as long as Map 1 items sort correctly relative to each other.
            //    So: `this.setCardOrder([...others, ...reorderedSubset])` works fine for relative sorting!

            // Wait, what if I drag Item A (Map 1) to be first?
            // It puts it at end of global list.
            // But `sort` function separates them by Map? 
            // NO, `bossListView` sorts purely by `cardOrder`.
            // The VIEW groups by map: `v -for= "map in MAPS" ...filter(b.map_id === map.id)`.
            // So global order doesn't affect grouping, only order WITHIN group.
            // So `[...others, ...reorderedSubset]` method is perfectly fine.
            // It effectively moves any touched items to the "end" of the sort keys, but in their correct relative order.

            this.setCardOrder([...others, ...reorderedSubset]);
        },

        checkWarnings() {
            // ... (keep existing)
            const bosses = this.bossListView;
            bosses.forEach(boss => {
                if (boss.status === 'critical') {
                    if (!this.warnedBosses.has(boss.id)) {
                        this.warnedBosses.add(boss.id);
                        const sound = this.mapSounds[boss.map_id] || 'none';
                        if (sound !== 'none') {
                            playWarningSequence(sound);
                        }
                    }
                } else {
                    this.warnedBosses.delete(boss.id);
                }
            });
        },

        async setMapSound(mapId: string, soundId: string) {
            this.mapSounds[mapId] = soundId;
            // Preview
            playSound(soundId);

            try {
                const { error } = await supabase.from('map_settings').upsert({
                    map_id: mapId,
                    sound_id: soundId
                })
                if (error) throw error
            } catch (err: any) {
                console.error('Save sound error:', err)
                if (err.message && !err.message.includes('relation "map_settings" does not exist')) {
                    this.error = `保存声音配置失败: ${err.message}`
                }
            }
        },

        async setEventMode(val: boolean) {
            this.isEventMode = val;
            try {
                const { error } = await supabase.from('map_settings').upsert({
                    map_id: 'EVENT_MODE',
                    sound_id: val ? 'true' : 'false'
                })
                if (error) throw error
            } catch (err: any) {
                console.error('Save event mode error:', err)
                this.error = `保存活动模式失败: ${err.message}`
            }
        },

        async cycleBossColor(bossId: string) {
            if (!this.dbStates[bossId]) {
                this.dbStates[bossId] = { boss_id: bossId, last_killed_at: null, is_pinned: false, color_index: 0 }
            }
            const current = this.dbStates[bossId].color_index || 0;
            const next = (current + 1) % 6;
            this.dbStates[bossId].color_index = next;

            try {
                const { error } = await supabase.from('boss_states').upsert({
                    boss_id: bossId,
                    color_index: next,
                    last_killed_at: this.dbStates[bossId].last_killed_at,
                    is_pinned: this.dbStates[bossId].is_pinned
                })
                if (error) throw error
            } catch (err: any) {
                console.error('Cycle color error:', err)
                this.dbStates[bossId].color_index = current;
            }
        },

        async fetchMapSounds() {
            try {
                const { data, error } = await supabase.from('map_settings').select('*')
                if (error) throw error
                if (data) {
                    const soundMap: Record<string, string> = {}
                    data.forEach((row: any) => {
                        if (row.map_id === 'EVENT_MODE') {
                            this.isEventMode = row.sound_id === 'true';
                        } else if (row.map_id === 'GLOBAL_MULTIPLIER') {
                            // Backward compatibility
                        } else {
                            soundMap[row.map_id] = row.sound_id
                        }
                    })
                    this.mapSounds = soundMap
                }
            } catch (err: any) {
                if (err.message && !err.message.includes('relation "map_settings" does not exist')) {
                    console.error('Error fetching map sounds:', err)
                }
            }
        },

        async fetchConfigs() {
            try {
                const { data, error } = await supabase
                    .from('boss_configs')
                    .select('*')
                    .order('name')

                if (error) throw error
                if (data) {
                    this.bossConfigs = data as BossConfig[]
                }
            } catch (err: any) {
                console.error('Error fetching boss configs:', err)
            }
        },

        async fetchStates() {
            this.loading = true
            this.error = null
            try {
                const { data, error } = await supabase
                    .from('boss_states')
                    .select('boss_id, last_killed_at, is_pinned, color_index')

                if (error) throw error

                if (data) {
                    const stateMap: Record<string, BossState> = {}
                    data.forEach((row: any) => {
                        stateMap[row.boss_id] = row as BossState
                    })
                    this.dbStates = stateMap
                }
            } catch (err: any) {
                console.error('Error fetching boss states:', err)
                this.error = err.message
            } finally {
                this.loading = false
            }
        },

        async addBoss(boss: Omit<BossConfig, 'id'>) {
            try {
                this.error = null
                const { error } = await supabase.from('boss_configs').insert(boss)
                if (error) throw error
                await this.fetchConfigs()
            } catch (err: any) {
                console.error('Error adding boss:', err)
                this.error = `添加失败: ${err.message}`
            }
        },

        async updateBoss(id: string, updates: Partial<BossConfig>) {
            try {
                const { error } = await supabase.from('boss_configs').update(updates).eq('id', id)
                if (error) throw error
                await this.fetchConfigs()
            } catch (err: any) {
                console.error('Error updating boss:', err)
            }
        },

        async deleteBoss(id: string) {
            try {
                const { error } = await supabase.from('boss_configs').delete().eq('id', id)
                if (error) throw error
                await this.fetchConfigs()
            } catch (err: any) {
                console.error('Error deleting boss:', err)
            }
        },

        async updateKillTime(bossId: string, timestamp: number) {
            const isoTime = new Date(timestamp).toISOString()

            // Optimistic update
            if (!this.dbStates[bossId]) {
                this.dbStates[bossId] = { boss_id: bossId, last_killed_at: null, is_pinned: false, color_index: 0 }
            }
            const oldTime = this.dbStates[bossId].last_killed_at
            this.dbStates[bossId].last_killed_at = isoTime

            try {
                const { error } = await supabase
                    .from('boss_states')
                    .upsert({
                        boss_id: bossId,
                        last_killed_at: isoTime
                    })

                if (error) throw error
            } catch (err: any) {
                console.error('Error updating kill time:', err)
                this.error = err.message
                this.dbStates[bossId].last_killed_at = oldTime
            }
        },

        async togglePin(bossId: string) {
            if (!this.dbStates[bossId]) {
                this.dbStates[bossId] = { boss_id: bossId, last_killed_at: null, is_pinned: false, color_index: 0 }
            }
            const oldPin = this.dbStates[bossId].is_pinned
            const newPin = !oldPin
            this.dbStates[bossId].is_pinned = newPin

            try {
                const currentState = this.dbStates[bossId]
                const { error } = await supabase
                    .from('boss_states')
                    .upsert({
                        boss_id: bossId,
                        is_pinned: newPin,
                        last_killed_at: currentState?.last_killed_at || null,
                        color_index: currentState?.color_index || 0
                    })

                if (error) throw error
            } catch (err: any) {
                console.error('Error toggling pin:', err)
                this.error = err.message
                this.dbStates[bossId].is_pinned = oldPin
            }
        },

        async setRemainingSeconds(bossId: string, seconds: number) {
            const config = this.bossConfigs.find(c => c.id === bossId);
            if (!config) return;

            // Recalculate effective interval with the same logic as the getter
            const multiplier = this.isEventMode ? (2 / 3) : 1.0;
            const effectiveInterval = (config.interval * multiplier) - 20;

            const now = Date.now();
            const newKillTime = now + (seconds * 1000) - (effectiveInterval * 1000);

            await this.updateKillTime(bossId, newKillTime);
        }
    }
})
