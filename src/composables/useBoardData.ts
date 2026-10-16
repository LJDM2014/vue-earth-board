import { computed, onUnmounted, ref, watch, type Ref, type ShallowRef } from 'vue'
import type { CityMetric, MetricKey } from '../mock/cities'
import type { FlowOD } from '../mock/flows'
import { HISTORY_COUNT } from '../map/layers/boardLayers'
import { isRealtimeCapable, type BoardDataSource, type Period } from '../services/dataSource'
import { reportMonitorEvent } from '../services/monitor'

/** 快照缓存容量（期）：与时间轴切片数一致，来回切换零请求 */
const CACHE_CAPACITY = 12

/** 某周期的完整快照（prevFlows 供航线面板环比） */
interface PeriodSnapshot {
  cities: CityMetric[]
  flows: FlowOD[]
  prevFlows: FlowOD[] | null
}

/** LRU 写入：命中重插到最新位，超容淘汰最旧 */
function lruPut<V>(cache: Map<string, V>, key: string, value: V): void {
  cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_CAPACITY) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

/**
 * 大屏数据域（M7.5/7.6）：period→(cities/flows/history/prevFlows) 统一加载，
 * LRU 内存缓存（12 期）+ 可选轮询刷新（默认关闭）+ 实时推送订阅（数据源具备
 * RealtimeCapable 时自动启用）。App.vue 只消费返回的 refs。
 *
 * sourceRef 允许为 null（createDataSource 异步装配期间），就绪后自动初始化；
 * 拉取全程容错：失败上报监控且不清空既有画面。
 */
export function useBoardData(
  sourceRef: Ref<BoardDataSource | null> | ShallowRef<BoardDataSource | null>,
  options: { refreshIntervalMs?: number | Ref<number | undefined> } = {},
) {
  const periods = ref<Period[]>([])
  const period = ref<Period>('')
  const cities = ref<CityMetric[]>([])
  const flows = ref<FlowOD[]>([])
  const prevFlows = ref<FlowOD[] | null>(null)
  /** 城市近 N 期历史：tooltip sparkline，口径随激活指标 */
  const cityHistory = ref<Map<string, number[]>>(new Map())
  const activeMetric = ref<MetricKey>('heat')
  const loading = ref(false)

  const snapshotCache = new Map<string, PeriodSnapshot>()
  const historyCache = new Map<string, Map<string, number[]>>()

  /** 应用快照到 refs 并写入缓存 */
  function applySnapshot(p: Period, snap: PeriodSnapshot) {
    cities.value = snap.cities
    flows.value = snap.flows
    prevFlows.value = snap.prevFlows
    lruPut(snapshotCache, p, snap)
  }

  /** 拉取周期快照（缓存命中零请求；失败上报监控且不清空既有画面） */
  async function loadSnapshot(p: Period, force = false) {
    const ds = sourceRef.value
    if (!ds) return
    const cached = !force && snapshotCache.get(p)
    if (cached) {
      applySnapshot(p, cached)
      return
    }
    loading.value = true
    try {
      const idx = periods.value.indexOf(p)
      const prevPeriod = idx > 0 ? periods.value[idx - 1] : null
      const [nextCities, nextFlows, nextPrevFlows] = await Promise.all([
        ds.getCities(p),
        ds.getFlows(p),
        prevPeriod ? ds.getFlows(prevPeriod) : Promise.resolve(null),
      ])
      applySnapshot(p, { cities: nextCities, flows: nextFlows, prevFlows: nextPrevFlows })
    } catch (err) {
      reportMonitorEvent({ type: 'data-source-error', source: 'period-fetch', detail: String(err) })
    } finally {
      loading.value = false
    }
  }

  /** 拉取当前期全城市历史（缓存命中零请求；口径 = period + 指标） */
  async function loadHistory(p: Period, metric: MetricKey, force = false) {
    const ds = sourceRef.value
    if (!ds || cities.value.length === 0) return
    const key = `${p}|${metric}`
    const cached = !force && historyCache.get(key)
    if (cached) {
      cityHistory.value = cached
      return
    }
    try {
      const entries = await Promise.all(
        cities.value.map(
          async (c) =>
            [c.name, await ds.getCityHistory(p, c.name, HISTORY_COUNT, metric)] as const,
        ),
      )
      const map = new Map(entries)
      cityHistory.value = map
      lruPut(historyCache, key, map)
    } catch (err) {
      reportMonitorEvent({ type: 'data-source-error', source: 'history-fetch', detail: String(err) })
    }
  }

  /** 初始化周期列表并默认定位到中期（数据源就绪后触发） */
  async function init() {
    const ds = sourceRef.value
    if (!ds) return
    try {
      periods.value = await ds.listPeriods()
    } catch (err) {
      reportMonitorEvent({ type: 'data-source-error', source: 'periods-fetch', detail: String(err) })
      return
    }
    period.value = periods.value[Math.floor(periods.value.length / 2)] ?? ''
  }
  watch(sourceRef, () => void init(), { immediate: true })

  watch(period, (p) => {
    if (!p) return
    void loadSnapshot(p).then(() => loadHistory(p, activeMetric.value))
  })

  /** 指标切换：历史序列按新口径取（当期值由视图层 computed 即时映射） */
  watch(activeMetric, () => {
    if (period.value) void loadHistory(period.value, activeMetric.value)
  })

  // ── 实时推送（可选能力）：订阅当前期，推送快照直写 refs 与缓存；
  // 周期切换先退订旧期再订新期，全部退订由 onUnmounted 收口 ──
  let unsubscribe: (() => void) | null = null
  watch(period, (p, old) => {
    if (old && unsubscribe) unsubscribe()
    unsubscribe = null
    if (!p) return
    const ds = sourceRef.value
    if (!ds || !isRealtimeCapable(ds)) return
    unsubscribe = ds.subscribeCities(p, (next) => {
      applySnapshot(p, { cities: next, flows: flows.value, prevFlows: prevFlows.value })
    })
  })

  // ── 轮询刷新（可选）：展厅模式开启，绕缓存强拉当前期；
  // 间隔支持响应式（M9.4 运行配置加载后动态启停）──
  let pollTimer: number | undefined
  const pollInterval = computed(() =>
    typeof options.refreshIntervalMs === 'object' ? options.refreshIntervalMs.value : options.refreshIntervalMs,
  )
  watch(
    pollInterval,
    (ms) => {
      if (pollTimer !== undefined) {
        window.clearInterval(pollTimer)
        pollTimer = undefined
      }
      if (ms && ms > 0) {
        pollTimer = window.setInterval(() => {
          const p = period.value
          if (!p || loading.value || !sourceRef.value) return
          void loadSnapshot(p, true).then(() => loadHistory(p, activeMetric.value, true))
        }, ms)
      }
    },
    { immediate: true },
  )

  /** 手动刷新当前期（供后续运维看门狗等场景复用） */
  function refreshCurrent() {
    const p = period.value
    if (p) void loadSnapshot(p, true).then(() => loadHistory(p, activeMetric.value, true))
  }

  onUnmounted(() => {
    unsubscribe?.()
    if (pollTimer !== undefined) window.clearInterval(pollTimer)
  })

  return {
    periods,
    period,
    cities,
    flows,
    prevFlows,
    cityHistory,
    activeMetric,
    loading,
    refreshCurrent,
  }
}

export type BoardData = ReturnType<typeof useBoardData>
