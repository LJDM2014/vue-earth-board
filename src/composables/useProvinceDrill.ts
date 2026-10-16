import { ref, type Ref } from 'vue'
import type { Map as MapLibreMap } from 'maplibre-gl'
import type { ProvinceFeature } from '../map/layers/regionGeoJson'
import { reportMonitorEvent } from '../services/monitor'
import { geoBBox, loadCityBoundaries, type CityBoundaryFeature } from '../services/boundaryService'

/**
 * 省份下钻域（M7.6 自 App.vue 抽离）：面包屑状态 + 市界要素 + 下钻/返回飞行。
 * 下钻前记忆自转开关并停转，返回全国时恢复自转并复位视角。
 */
export function useProvinceDrill(deps: {
  mapInstance: Ref<MapLibreMap | null>
  autoRotate: Ref<boolean>
  setAutoRotate: (on: boolean) => void
  resetView: () => void
  /** 进入下钻时回调（供 App 清除城市面板高亮等跨域联动） */
  onEnter?: () => void
}) {
  const drillProvince = ref<{ name: string; adcode: number } | null>(null)
  const drillFeatures = ref<CityBoundaryFeature[]>([])
  /** 下钻省份高亮（面板与地图联动），返回全国时清除 */
  const highlightProvince = ref<string | null>(null)
  /** 下钻前的自转开关，返回全国时恢复 */
  let rotateBeforeDrill: boolean | null = null

  /** 点击省份：拉取市界 GeoJSON（内存缓存）→ 面包屑 + 市界描边 + 平滑飞行 */
  async function handleProvinceClick(feature: ProvinceFeature) {
    const { name, adcode } = feature.properties
    if (drillProvince.value?.adcode === adcode) return
    try {
      const collection = await loadCityBoundaries(adcode)
      if (rotateBeforeDrill === null) rotateBeforeDrill = deps.autoRotate.value
      deps.setAutoRotate(false)
      drillProvince.value = { name, adcode }
      drillFeatures.value = collection.features
      highlightProvince.value = name
      deps.onEnter?.()
      deps.mapInstance.value?.fitBounds(geoBBox(collection.features), {
        padding: { top: 120, bottom: 150, left: 360, right: 360 },
        maxZoom: 6.5,
        duration: 1200,
        essential: true,
      })
    } catch (err) {
      reportMonitorEvent({ type: 'data-source-error', source: 'boundary', detail: String(err) })
      console.warn(`[下钻] ${name} 市界数据加载失败（内网/离线时降级为全国视角）`, err)
    }
  }

  /** 面包屑返回全国：清除市界层、恢复自转并复位视角 */
  function exitDrill() {
    drillProvince.value = null
    drillFeatures.value = []
    highlightProvince.value = null
    if (rotateBeforeDrill !== null) {
      deps.setAutoRotate(rotateBeforeDrill)
      rotateBeforeDrill = null
    }
    deps.resetView()
  }

  return { drillProvince, drillFeatures, highlightProvince, handleProvinceClick, exitDrill }
}
