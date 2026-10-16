/** 城市指标数据：经纬度 + 热度指标 */
export interface CityMetric {
  name: string
  /** 所属省级行政区全名（与省界 GeoJSON properties.name 对齐，供面板联动匹配） */
  province: string
  /** [经度, 纬度] */
  lnglat: [number, number]
  /** 热度指标（0-1000），驱动散点半径/颜色与热力权重 */
  value: number
}

/** 城市热度 mock 数据 */
export const MOCK_CITIES: CityMetric[] = [
  { name: '北京', province: '北京市', lnglat: [116.407, 39.904], value: 982 },
  { name: '上海', province: '上海市', lnglat: [121.473, 31.23], value: 913 },
  { name: '深圳', province: '广东省', lnglat: [114.057, 22.543], value: 871 },
  { name: '广州', province: '广东省', lnglat: [113.264, 23.129], value: 846 },
  { name: '杭州', province: '浙江省', lnglat: [120.153, 30.287], value: 802 },
  { name: '成都', province: '四川省', lnglat: [104.065, 30.659], value: 758 },
  { name: '重庆', province: '重庆市', lnglat: [106.551, 29.563], value: 724 },
  { name: '武汉', province: '湖北省', lnglat: [114.305, 30.592], value: 693 },
  { name: '西安', province: '陕西省', lnglat: [108.939, 34.341], value: 661 },
  { name: '哈尔滨', province: '黑龙江省', lnglat: [126.642, 45.756], value: 512 },
  { name: '昆明', province: '云南省', lnglat: [102.833, 24.881], value: 476 },
  { name: '乌鲁木齐', province: '新疆维吾尔自治区', lnglat: [87.617, 43.792], value: 448 },
  { name: '三亚', province: '海南省', lnglat: [109.508, 18.247], value: 421 },
  { name: '拉萨', province: '西藏自治区', lnglat: [91.132, 29.66], value: 385 },
]
