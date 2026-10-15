/** 城市指标数据：经纬度 + 热度指标 */
export interface CityMetric {
  name: string
  /** [经度, 纬度] */
  lnglat: [number, number]
  /** 热度指标（0-1000），驱动散点半径/颜色与热力权重 */
  value: number
}

/** 城市热度 mock 数据 */
export const MOCK_CITIES: CityMetric[] = [
  { name: '北京', lnglat: [116.407, 39.904], value: 982 },
  { name: '上海', lnglat: [121.473, 31.23], value: 913 },
  { name: '深圳', lnglat: [114.057, 22.543], value: 871 },
  { name: '广州', lnglat: [113.264, 23.129], value: 846 },
  { name: '杭州', lnglat: [120.153, 30.287], value: 802 },
  { name: '成都', lnglat: [104.065, 30.659], value: 758 },
  { name: '重庆', lnglat: [106.551, 29.563], value: 724 },
  { name: '武汉', lnglat: [114.305, 30.592], value: 693 },
  { name: '西安', lnglat: [108.939, 34.341], value: 661 },
  { name: '哈尔滨', lnglat: [126.642, 45.756], value: 512 },
  { name: '昆明', lnglat: [102.833, 24.881], value: 476 },
  { name: '乌鲁木齐', lnglat: [87.617, 43.792], value: 448 },
  { name: '三亚', lnglat: [109.508, 18.247], value: 421 },
  { name: '拉萨', lnglat: [91.132, 29.66], value: 385 },
]
