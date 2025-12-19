export interface BossConfig {
    id: string; // 唯一标识，如 'xiuzhen_1_b1'
    name: string;
    interval: number; // 刷新间隔（秒）
    map_id: string; // 所属地图 ID
    level_name: string; // 关卡名称，如 "第一关"
    is_visible?: boolean; // New field for toggle
}

export const MAPS = [
    { id: 'xiuzhen', name: '修真' },
    { id: 'wusheng', name: '武圣' },
    { id: 'jindi', name: '禁地' },
    { id: 'other', name: '其他' },
];

// 数据示例
// Data is now loaded from DB
export const BOSSES: BossConfig[] = [];
