<template>
  <section class="panel">
    <h2 class="panel-title">图层管理</h2>
    <div class="layer-rows">
      <div class="layer-row">
        <span class="layer-label">城市图层</span>
        <div class="seg" role="group" aria-label="散点呈现方式切换">
          <button
            v-for="opt in POINT_STYLES"
            :key="opt.value"
            type="button"
            class="seg-btn"
            :class="{ active: pointStyle === opt.value }"
            :disabled="!showPoints"
            @click="emit('change-point-style', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <ToggleSwitch label="切换城市图层" :on="showPoints" @change="emit('toggle-points', $event)" />
        <OpacitySlider :value="opacity.city" @change="emit('change-opacity', 'city', $event)" />
      </div>
      <div class="layer-row">
        <span class="layer-label" :title="heatmapLocked ? '热力图仅 2D 平面模式生效' : undefined">
          {{ heatmapLocked ? '热力图 · 仅2D' : '城市热力图' }}
        </span>
        <ToggleSwitch
          label="切换城市热力图"
          :on="showHeatmap"
          :disabled="heatmapLocked"
          @change="emit('toggle-heatmap', $event)"
        />
        <OpacitySlider :value="opacity.heatmap" @change="emit('change-opacity', 'heatmap', $event)" />
      </div>
      <div class="layer-row">
        <span class="layer-label">飞线弧线</span>
        <ToggleSwitch label="切换飞线弧线" :on="showArcs" @change="emit('toggle-arcs', $event)" />
        <OpacitySlider :value="opacity.arcs" @change="emit('change-opacity', 'arcs', $event)" />
      </div>
      <div class="layer-row">
        <span class="layer-label">轨迹回放</span>
        <ToggleSwitch label="切换轨迹回放" :on="showTrips" @change="emit('toggle-trips', $event)" />
        <OpacitySlider :value="opacity.trips" @change="emit('change-opacity', 'trips', $event)" />
      </div>
      <div class="layer-row">
        <span class="layer-label">省界描边</span>
        <ToggleSwitch label="切换省界描边" :on="showRegion" @change="emit('toggle-region', $event)" />
        <OpacitySlider :value="opacity.region" @change="emit('change-opacity', 'region', $event)" />
      </div>
      <div class="layer-row">
        <span
          class="layer-label"
          title="在卫星/地形等无注记瓦片上叠加中文地名（行政区划/水系）；街景自带注记可关闭避免重复"
        >
          地图注记
        </span>
        <ToggleSwitch
          label="切换地图注记"
          :on="showAnnotations"
          @change="emit('toggle-annotations', $event)"
        />
        <OpacitySlider
          :value="opacity.annotations"
          @change="emit('change-opacity', 'annotations', $event)"
        />
      </div>
      <div class="layer-row">
        <span class="layer-label">城市标注</span>
        <ToggleSwitch label="切换城市标注" :on="showLabels" @change="emit('toggle-labels', $event)" />
        <OpacitySlider :value="opacity.labels" @change="emit('change-opacity', 'labels', $event)" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { THEME } from '../config/theme'
import type { ScreenMode } from '../composables/useMapLibre'
import type { LayerOpacityKey, PointStyle } from '../map/layers/boardLayers'
import OpacitySlider from './OpacitySlider.vue'
import ToggleSwitch from './ToggleSwitch.vue'

const props = defineProps<{
  /** 当前展示模式：HeatmapLayer 不支持 globe，热力图开关在 3D 下锁定 */
  mode: ScreenMode
  pointStyle: PointStyle
  showPoints: boolean
  showHeatmap: boolean
  showArcs: boolean
  showTrips: boolean
  showRegion: boolean
  showLabels: boolean
  showAnnotations: boolean
  opacity: Record<LayerOpacityKey, number>
}>()

const emit = defineEmits<{
  'change-point-style': [style: PointStyle]
  'toggle-points': [enabled: boolean]
  'toggle-heatmap': [enabled: boolean]
  'toggle-arcs': [enabled: boolean]
  'toggle-trips': [enabled: boolean]
  'toggle-region': [enabled: boolean]
  'toggle-labels': [enabled: boolean]
  'toggle-annotations': [enabled: boolean]
  'change-opacity': [key: LayerOpacityKey, value: number]
}>()

/** 3D（globe 投影）下 HeatmapLayer 官方不支持，锁定热力图开关 */
const heatmapLocked = computed(() => props.mode === '3d')

const POINT_STYLES: { value: PointStyle; label: string }[] = [
  { value: 'scatter', label: '散点' },
  { value: 'column', label: '3D 柱' },
]
</script>

<style scoped>
.layer-rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layer-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.layer-label {
  flex: none;
  width: 100px;
  font-size: 13px;
  letter-spacing: 1px;
  color: v-bind('THEME.text');
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-row > :nth-last-child(2) {
  margin-left: auto;
}

.seg {
  display: flex;
  padding: 2px;
  border-radius: 6px;
  border: 1px solid v-bind('THEME.borderGlow');
  background: rgba(0, 229, 255, 0.06);
}

.seg-btn {
  padding: 3px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  font-size: 12px;
  letter-spacing: 1px;
  color: v-bind('THEME.textDim');
  cursor: pointer;
  transition: all 0.2s ease;
}

.seg-btn.active {
  background: rgba(0, 229, 255, 0.24);
  color: v-bind('THEME.text');
  box-shadow: inset 0 0 8px rgba(0, 229, 255, 0.2);
}

.seg-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
