/** OD 类别（M5.3）：客运 / 货运，驱动弧线与彗星着色 */
export type FlowCategory = 'passenger' | 'cargo'

/** 城市间飞线 OD 数据 */
export interface FlowOD {
  /** 起点城市名 */
  from: string
  /** 终点城市名 */
  to: string
  /** 运输量基数，驱动弧线宽度与统计面板（当期值由时序生成器波动） */
  volume: number
  /** 类别：客运（青）/ 货运（金） */
  category: FlowCategory
}

/**
 * OD 网络 mock（M5.3 多枢纽真实化）：五大枢纽（北京/上海/广州/成都/西安）
 * 各自辐射圈 + 全国性干线 + 双向对（起讫互换运量不同）+ 客货混编，共 45 条。
 */
export const MOCK_FLOWS: FlowOD[] = [
  // ── 北京枢纽：京津冀 + 全国干线 ──
  { from: '北京', to: '上海', volume: 920, category: 'passenger' },
  { from: '北京', to: '深圳', volume: 812, category: 'passenger' },
  { from: '北京', to: '广州', volume: 845, category: 'passenger' },
  { from: '北京', to: '成都', volume: 704, category: 'passenger' },
  { from: '北京', to: '西安', volume: 615, category: 'passenger' },
  { from: '北京', to: '哈尔滨', volume: 432, category: 'passenger' },
  { from: '北京', to: '乌鲁木齐', volume: 397, category: 'passenger' },
  { from: '北京', to: '三亚', volume: 335, category: 'passenger' },
  { from: '北京', to: '桂林', volume: 295, category: 'passenger' },
  // ── 上海枢纽：长三角 + 沿海走廊 ──
  { from: '上海', to: '北京', volume: 878, category: 'passenger' },
  { from: '上海', to: '深圳', volume: 766, category: 'passenger' },
  { from: '上海', to: '成都', volume: 688, category: 'passenger' },
  { from: '上海', to: '青岛', volume: 585, category: 'passenger' },
  { from: '上海', to: '武汉', volume: 572, category: 'passenger' },
  { from: '上海', to: '厦门', volume: 549, category: 'passenger' },
  { from: '上海', to: '大连', volume: 468, category: 'passenger' },
  { from: '上海', to: '昆明', volume: 402, category: 'passenger' },
  // ── 广州枢纽：华南辐射圈 ──
  { from: '广州', to: '成都', volume: 634, category: 'passenger' },
  { from: '广州', to: '长沙', volume: 601, category: 'passenger' },
  { from: '广州', to: '武汉', volume: 566, category: 'passenger' },
  { from: '广州', to: '西安', volume: 523, category: 'passenger' },
  { from: '广州', to: '海口', volume: 441, category: 'passenger' },
  { from: '广州', to: '桂林', volume: 302, category: 'passenger' },
  // ── 深圳节点 ──
  { from: '深圳', to: '上海', volume: 741, category: 'passenger' },
  { from: '深圳', to: '成都', volume: 602, category: 'passenger' },
  { from: '深圳', to: '西安', volume: 488, category: 'passenger' },
  { from: '深圳', to: '昆明', volume: 455, category: 'passenger' },
  // ── 成都枢纽：西南辐射圈 ──
  { from: '成都', to: '上海', volume: 651, category: 'passenger' },
  { from: '成都', to: '拉萨', volume: 392, category: 'passenger' },
  { from: '成都', to: '乌鲁木齐', volume: 356, category: 'passenger' },
  { from: '成都', to: '昆明', volume: 418, category: 'passenger' },
  { from: '成都', to: '大理', volume: 268, category: 'passenger' },
  // ── 西安枢纽：西北辐射圈 ──
  { from: '西安', to: '兰州', volume: 388, category: 'passenger' },
  { from: '西安', to: '乌鲁木齐', volume: 342, category: 'passenger' },
  { from: '西安', to: '银川', volume: 316, category: 'passenger' },
  { from: '西安', to: '西宁', volume: 298, category: 'passenger' },
  { from: '西安', to: '拉萨', volume: 312, category: 'passenger' },
  // ── 货运干线（金）──
  { from: '上海', to: '北京', volume: 780, category: 'cargo' },
  { from: '北京', to: '广州', volume: 720, category: 'cargo' },
  { from: '深圳', to: '上海', volume: 690, category: 'cargo' },
  { from: '广州', to: '成都', volume: 610, category: 'cargo' },
  { from: '成都', to: '西安', volume: 540, category: 'cargo' },
  { from: '上海', to: '青岛', volume: 520, category: 'cargo' },
  { from: '北京', to: '乌鲁木齐', volume: 460, category: 'cargo' },
  { from: '北京', to: '哈尔滨', volume: 430, category: 'cargo' },
]
