/** 指标键（M5.2）：热度 / 客流 / 经济，驱动散点、热力、榜单、tooltip 全局联动 */
export type MetricKey = 'heat' | 'passenger' | 'economy'

/** 三指标集合 */
export type CityIndicators = Record<MetricKey, number>

/** 指标元信息：面板标题 / 切换器短标签 / 数值单位 */
export const METRIC_DEFS: Record<MetricKey, { label: string; short: string; unit: string }> = {
  heat: { label: '城市热度', short: '热度', unit: '' },
  passenger: { label: '客流规模', short: '客流', unit: '万人次' },
  economy: { label: '经济总量', short: '经济', unit: '亿元' },
}

/** 城市静态档案：坐标 + 所属省级行政区 + GDP 排位（时序生成基数的 Zipf 输入） */
export interface CityBase {
  name: string
  /** 所属省级行政区全名（与省界 GeoJSON properties.name 对齐，供面板联动匹配） */
  province: string
  /** [经度, 纬度] */
  lnglat: [number, number]
  /** 全国 GDP 排位（1 起），决定指标基数衰减权重 */
  rank: number
}

/** 城市指标数据：静态档案 + 当期三指标 */
export interface CityMetric {
  name: string
  province: string
  lnglat: [number, number]
  /** 当前激活指标的快照（App.vue 按 activeMetric 映射，图层/面板直接消费） */
  value: number
  /** 三指标全集（M5.2），指标切换的数据来源 */
  indicators: CityIndicators
}

/**
 * 城市档案 mock（M5.1 扩容）：75 座城市覆盖全部 31 个省级行政区，
 * 含省会/首府/直辖市 + 计划单列市 + GDP 头部地级市 + 特色节点（旅游/能源）。
 * rank 按 2024 年 GDP 排位近似。
 */
export const MOCK_CITIES: CityBase[] = [
  { name: '上海', province: '上海市', lnglat: [121.473, 31.23], rank: 1 },
  { name: '北京', province: '北京市', lnglat: [116.407, 39.904], rank: 2 },
  { name: '深圳', province: '广东省', lnglat: [114.057, 22.543], rank: 3 },
  { name: '广州', province: '广东省', lnglat: [113.264, 23.129], rank: 4 },
  { name: '重庆', province: '重庆市', lnglat: [106.551, 29.563], rank: 5 },
  { name: '苏州', province: '江苏省', lnglat: [120.585, 31.299], rank: 6 },
  { name: '成都', province: '四川省', lnglat: [104.065, 30.659], rank: 7 },
  { name: '杭州', province: '浙江省', lnglat: [120.153, 30.287], rank: 8 },
  { name: '武汉', province: '湖北省', lnglat: [114.305, 30.592], rank: 9 },
  { name: '南京', province: '江苏省', lnglat: [118.796, 32.06], rank: 10 },
  { name: '天津', province: '天津市', lnglat: [117.2, 39.084], rank: 11 },
  { name: '宁波', province: '浙江省', lnglat: [121.55, 29.875], rank: 12 },
  { name: '青岛', province: '山东省', lnglat: [120.382, 36.067], rank: 13 },
  { name: '无锡', province: '江苏省', lnglat: [120.312, 31.491], rank: 14 },
  { name: '长沙', province: '湖南省', lnglat: [112.982, 28.194], rank: 15 },
  { name: '郑州', province: '河南省', lnglat: [113.625, 34.747], rank: 16 },
  { name: '福州', province: '福建省', lnglat: [119.296, 26.074], rank: 17 },
  { name: '泉州', province: '福建省', lnglat: [118.589, 24.913], rank: 18 },
  { name: '西安', province: '陕西省', lnglat: [108.939, 34.341], rank: 19 },
  { name: '济南', province: '山东省', lnglat: [117.12, 36.651], rank: 20 },
  { name: '合肥', province: '安徽省', lnglat: [117.227, 31.82], rank: 21 },
  { name: '佛山', province: '广东省', lnglat: [113.122, 23.029], rank: 22 },
  { name: '南通', province: '江苏省', lnglat: [120.864, 32.016], rank: 23 },
  { name: '东莞', province: '广东省', lnglat: [113.746, 23.046], rank: 24 },
  { name: '常州', province: '江苏省', lnglat: [119.455, 31.773], rank: 25 },
  { name: '温州', province: '浙江省', lnglat: [120.699, 28.0], rank: 26 },
  { name: '唐山', province: '河北省', lnglat: [118.18, 39.631], rank: 27 },
  { name: '徐州', province: '江苏省', lnglat: [117.184, 34.262], rank: 28 },
  { name: '大连', province: '辽宁省', lnglat: [121.618, 38.914], rank: 29 },
  { name: '烟台', province: '山东省', lnglat: [119.587, 37.464], rank: 30 },
  { name: '沈阳', province: '辽宁省', lnglat: [123.431, 41.805], rank: 31 },
  { name: '厦门', province: '福建省', lnglat: [118.089, 24.479], rank: 32 },
  { name: '昆明', province: '云南省', lnglat: [102.833, 24.881], rank: 33 },
  { name: '绍兴', province: '浙江省', lnglat: [120.582, 30.003], rank: 34 },
  { name: '长春', province: '吉林省', lnglat: [125.325, 43.897], rank: 35 },
  { name: '潍坊', province: '山东省', lnglat: [119.162, 36.707], rank: 36 },
  { name: '哈尔滨', province: '黑龙江省', lnglat: [126.642, 45.756], rank: 37 },
  { name: '临沂', province: '山东省', lnglat: [118.356, 35.105], rank: 38 },
  { name: '石家庄', province: '河北省', lnglat: [114.515, 38.042], rank: 39 },
  { name: '台州', province: '浙江省', lnglat: [121.421, 28.656], rank: 40 },
  { name: '嘉兴', province: '浙江省', lnglat: [120.751, 30.765], rank: 41 },
  { name: '榆林', province: '陕西省', lnglat: [109.734, 38.285], rank: 42 },
  { name: '金华', province: '浙江省', lnglat: [119.649, 29.089], rank: 43 },
  { name: '贵阳', province: '贵州省', lnglat: [106.63, 26.647], rank: 44 },
  { name: '南昌', province: '江西省', lnglat: [115.858, 28.683], rank: 45 },
  { name: '南宁', province: '广西壮族自治区', lnglat: [108.366, 22.817], rank: 46 },
  { name: '洛阳', province: '河南省', lnglat: [112.454, 34.62], rank: 47 },
  { name: '珠海', province: '广东省', lnglat: [113.576, 22.271], rank: 48 },
  { name: '太原', province: '山西省', lnglat: [112.549, 37.857], rank: 49 },
  { name: '宜宾', province: '四川省', lnglat: [104.642, 28.752], rank: 50 },
  { name: '惠州', province: '广东省', lnglat: [114.412, 23.079], rank: 51 },
  { name: '绵阳', province: '四川省', lnglat: [104.679, 31.468], rank: 52 },
  { name: '柳州', province: '广西壮族自治区', lnglat: [109.415, 24.329], rank: 53 },
  { name: '呼和浩特', province: '内蒙古自治区', lnglat: [111.751, 40.842], rank: 54 },
  { name: '鄂尔多斯', province: '内蒙古自治区', lnglat: [109.99, 39.817], rank: 55 },
  { name: '包头', province: '内蒙古自治区', lnglat: [109.84, 40.658], rank: 56 },
  { name: '兰州', province: '甘肃省', lnglat: [103.834, 36.061], rank: 57 },
  { name: '中山', province: '广东省', lnglat: [113.392, 22.517], rank: 58 },
  { name: '威海', province: '山东省', lnglat: [122.12, 37.509], rank: 59 },
  { name: '芜湖', province: '安徽省', lnglat: [118.376, 31.326], rank: 60 },
  { name: '岳阳', province: '湖南省', lnglat: [113.129, 29.357], rank: 61 },
  { name: '株洲', province: '湖南省', lnglat: [113.134, 27.827], rank: 62 },
  { name: '遵义', province: '贵州省', lnglat: [106.927, 27.726], rank: 63 },
  { name: '曲靖', province: '云南省', lnglat: [103.796, 25.49], rank: 64 },
  { name: '赣州', province: '江西省', lnglat: [114.935, 25.831], rank: 65 },
  { name: '连云港', province: '江苏省', lnglat: [119.222, 34.596], rank: 66 },
  { name: '保定', province: '河北省', lnglat: [115.464, 38.874], rank: 67 },
  { name: '桂林', province: '广西壮族自治区', lnglat: [110.29, 25.274], rank: 68 },
  { name: '大理', province: '云南省', lnglat: [100.225, 25.598], rank: 69 },
  { name: '三亚', province: '海南省', lnglat: [109.508, 18.247], rank: 70 },
  { name: '海口', province: '海南省', lnglat: [110.199, 20.044], rank: 71 },
  { name: '银川', province: '宁夏回族自治区', lnglat: [106.23, 38.487], rank: 72 },
  { name: '西宁', province: '青海省', lnglat: [101.778, 36.623], rank: 73 },
  { name: '乌鲁木齐', province: '新疆维吾尔自治区', lnglat: [87.617, 43.792], rank: 74 },
  { name: '拉萨', province: '西藏自治区', lnglat: [91.132, 29.66], rank: 75 },
]

/** 省份简称：去「省/市/自治区」等后缀，供面板次要信息展示 */
export function provinceShort(province: string): string {
  return province
    .replace(/维吾尔|壮族|回族/g, '')
    .replace(/自治区|特别行政区$/, '')
    .replace(/[省市]$/, '')
}
