/** 城市间飞线 OD 数据 */
export interface FlowOD {
  /** 起点城市名 */
  from: string
  /** 终点城市名 */
  to: string
  /** 运输量指标，驱动弧线宽度与统计面板 */
  volume: number
}

/** 北京 → 各城市飞线 mock 数据 */
export const MOCK_FLOWS: FlowOD[] = [
  { from: '北京', to: '上海', volume: 920 },
  { from: '北京', to: '广州', volume: 845 },
  { from: '北京', to: '深圳', volume: 812 },
  { from: '北京', to: '成都', volume: 704 },
  { from: '北京', to: '杭州', volume: 678 },
  { from: '北京', to: '西安', volume: 615 },
  { from: '北京', to: '武汉', volume: 589 },
  { from: '北京', to: '重庆', volume: 556 },
  { from: '北京', to: '哈尔滨', volume: 432 },
  { from: '北京', to: '乌鲁木齐', volume: 397 },
  { from: '北京', to: '昆明', volume: 341 },
  { from: '北京', to: '三亚', volume: 309 },
  { from: '北京', to: '拉萨', volume: 286 },
]
