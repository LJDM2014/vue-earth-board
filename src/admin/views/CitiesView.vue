<script setup lang="ts">
/**
 * 城市指标管理（A5）：
 * - 列表：关键词搜索（城市名/省份）+ 省份筛选 + 查看周期切换 + 分页（每页 20，计划 §5.3）；
 * - 新增/编辑弹窗：zod 同规则前端预校验；新增带指标初始化策略（复制全部期 / 仅最新一期）；
 *   编辑带「批量填充其他期 = 当期值」快捷操作与「在地图中查看」外链；
 * - 删除：后端试探（confirm=0）返回级联航线数 → ElMessageBox 二次确认 → 真删；
 * - 保存/删除成功后 refresh(true) 重取全量，图表页随单例状态自动同步。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { z } from 'zod'
import { api } from '../api/client'
import { useAdminData } from '../composables/useAdminData'
import type { CityRecord, MetricKey } from '../types'

const { cities, periods, loading, refresh } = useAdminData()

const METRIC_LABEL: Record<MetricKey, string> = { heat: '热度', passenger: '客流', economy: '经济总量' }
const PAGE_SIZE = 20

/* ---------------- 列表筛选与分页 ---------------- */

const keyword = ref('')
const provinceFilter = ref('')
const period = ref('')
const page = ref(1)

const provinces = computed(() => [...new Set(cities.value.map((c) => c.province))].sort((a, b) => a.localeCompare(b, 'zh')))

const filtered = computed(() => {
  const kw = keyword.value.trim()
  return cities.value.filter(
    (c) =>
      (!kw || c.name.includes(kw) || c.province.includes(kw)) &&
      (!provinceFilter.value || c.province === provinceFilter.value),
  )
})
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([keyword, provinceFilter], () => {
  page.value = 1
})

/** 当期指标取值（缺该期按 0 展示） */
const val = (c: CityRecord, m: MetricKey): number => c.metrics[period.value]?.[m] ?? 0
const fmt = (v: number): string => v.toLocaleString('zh-CN')

/* ---------------- 表单（新增/编辑共用） ---------------- */

const dialogVisible = ref(false)
/** 编辑态记录被编辑城市名（name 为唯一键不可改）；null = 新增 */
const editing = ref<string | null>(null)
const saving = ref(false)
const initMode = ref<'copy' | 'last'>('copy')
const batchFill = ref(false)

const form = reactive({
  name: '',
  province: '',
  lng: 105 as number | null,
  lat: 35 as number | null,
  rank: 0 as number | null,
  heat: 0 as number | null,
  passenger: 0 as number | null,
  economy: 0 as number | null,
})

/** zod 预校验（与 server/schemas.ts 同规则） */
const formSchema = z.object({
  name: z.string().trim().min(1, '请输入城市名').max(24, '城市名过长'),
  province: z.string().trim().min(1, '请输入省份').max(24, '省份名过长'),
  lng: z.number('经度需为数字').min(-180, '经度范围 -180 ~ 180').max(180, '经度范围 -180 ~ 180'),
  lat: z.number('纬度需为数字').min(-90, '纬度范围 -90 ~ 90').max(90, '纬度范围 -90 ~ 90'),
  rank: z.number('排位需为整数').int('排位需为整数').min(0, '排位不能为负数'),
  heat: z.number('热度需为数字').min(0, '指标不能为负数'),
  passenger: z.number('客流需为数字').min(0, '指标不能为负数'),
  economy: z.number('经济总量需为数字').min(0, '指标不能为负数'),
})

const mapHref = computed(() => {
  const lng = form.lng ?? 105
  const lat = form.lat ?? 35
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=8/${lat}/${lng}`
})

function openCreate(): void {
  editing.value = null
  initMode.value = 'copy'
  Object.assign(form, { name: '', province: '', lng: 105, lat: 35, rank: 0, heat: 0, passenger: 0, economy: 0 })
  dialogVisible.value = true
}

function openEdit(row: CityRecord): void {
  editing.value = row.name
  batchFill.value = false
  const cur = row.metrics[period.value]
  Object.assign(form, {
    name: row.name,
    province: row.province,
    lng: row.lnglat[0],
    lat: row.lnglat[1],
    rank: row.rank,
    heat: cur?.heat ?? 0,
    passenger: cur?.passenger ?? 0,
    economy: cur?.economy ?? 0,
  })
  dialogVisible.value = true
}

async function handleSave(): Promise<void> {
  const parsed = formSchema.safeParse({ ...form })
  if (!parsed.success) {
    ElMessage.warning(parsed.error.issues[0]?.message ?? '表单校验未通过')
    return
  }
  const d = parsed.data
  const metrics = { heat: d.heat, passenger: d.passenger, economy: d.economy }
  try {
    saving.value = true
    if (editing.value) {
      if (!period.value) {
        ElMessage.warning('数据尚未加载完成，请稍后重试')
        return
      }
      // 批量填充：当期值写入全部期；否则仅当前查看期
      const targetPeriods = batchFill.value ? periods.value : [period.value]
      await api.updateCity(editing.value, {
        province: d.province,
        lnglat: [d.lng, d.lat],
        rank: d.rank,
        metrics: targetPeriods.map((p) => ({ period: p, ...metrics })),
      })
      ElMessage.success(
        `已保存「${editing.value}」（${METRIC_LABEL.heat}/${METRIC_LABEL.passenger}/${METRIC_LABEL.economy} · ${targetPeriods.length} 期）`,
      )
    } else {
      await api.createCity({
        name: d.name,
        province: d.province,
        lnglat: [d.lng, d.lat],
        rank: d.rank,
        metrics,
        onlyLastPeriod: initMode.value === 'last',
      })
      ElMessage.success(`已新增城市「${d.name}」`)
    }
    dialogVisible.value = false
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

/* ---------------- 删除（试探级联数 → 二次确认） ---------------- */

async function handleDelete(row: CityRecord): Promise<void> {
  try {
    const probe = await api.deleteCity(row.name, false)
    const msg =
      probe.cascadeFlows > 0
        ? `删除「${row.name}」将级联删除 ${probe.cascadeFlows} 条关联航线，且不可恢复。确认删除？`
        : `确认删除城市「${row.name}」？该操作不可恢复。`
    await ElMessageBox.confirm(msg, '危险操作', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消试探或确认弹窗
  }
  try {
    const r = await api.deleteCity(row.name, true)
    ElMessage.success(`已删除「${r.city}」，级联航线 ${r.cascadeFlows} 条`)
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除失败')
  }
}

onMounted(async () => {
  try {
    await refresh()
    period.value = periods.value[periods.value.length - 1] ?? ''
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '城市数据加载失败')
  }
})
</script>

<template>
  <section v-loading="loading" class="page cities">
    <div class="card toolbar">
      <el-input v-model="keyword" class="search" placeholder="搜索城市名 / 省份" clearable :prefix-icon="Search" />
      <el-select v-model="provinceFilter" class="province" placeholder="全部省份" clearable filterable>
        <el-option v-for="p in provinces" :key="p" :label="p" :value="p" />
      </el-select>
      <span class="filter-label">查看周期</span>
      <el-select v-model="period" class="period">
        <el-option v-for="p in periods" :key="p" :label="p" :value="p" />
      </el-select>
      <span class="count-note">共 {{ filtered.length }} 城</span>
      <div class="actions">
        <el-button :icon="Refresh" @click="refresh(true)">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增城市</el-button>
      </div>
    </div>

    <div class="card">
      <el-table :data="paged" size="default" :row-key="(r: CityRecord) => r.name">
        <el-table-column prop="rank" label="排位" width="72" />
        <el-table-column prop="name" label="城市" min-width="110" />
        <el-table-column prop="province" label="省份" min-width="100" />
        <el-table-column label="经纬度" width="140">
          <template #default="{ row }">
            <span class="lnglat">{{ (row as CityRecord).lnglat[0].toFixed(2) }}, {{ (row as CityRecord).lnglat[1].toFixed(2) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="热度" width="120" align="right">
          <template #default="{ row }">{{ fmt(val(row as CityRecord, 'heat')) }}</template>
        </el-table-column>
        <el-table-column label="客流（万人次）" width="150" align="right">
          <template #default="{ row }">{{ fmt(val(row as CityRecord, 'passenger')) }}</template>
        </el-table-column>
        <el-table-column label="经济总量（亿元）" width="160" align="right">
          <template #default="{ row }">{{ fmt(val(row as CityRecord, 'economy')) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row as CityRecord)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row as CityRecord)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager">
        <el-pagination
          v-model:current-page="page"
          :page-size="PAGE_SIZE"
          :total="filtered.length"
          layout="total, prev, pager, next"
          background
        />
      </div>
    </div>

    <el-dialog
      v-model="dialogVisible"
      :title="editing ? `编辑城市 · ${editing}` : '新增城市'"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="92px">
        <el-form-item label="城市名">
          <el-input v-model="form.name" :disabled="!!editing" placeholder="如：苏州" />
        </el-form-item>
        <el-form-item label="省份">
          <el-input v-model="form.province" placeholder="如：江苏" />
        </el-form-item>
        <el-form-item label="经纬度">
          <div class="geo-row">
            <el-input-number v-model="form.lng" :min="-180" :max="180" :step="0.5" :precision="4" controls-position="right" placeholder="经度" />
            <el-input-number v-model="form.lat" :min="-90" :max="90" :step="0.5" :precision="4" controls-position="right" placeholder="纬度" />
            <a class="map-link" :href="mapHref" target="_blank" rel="noopener">在地图中查看</a>
          </div>
        </el-form-item>
        <el-form-item label="全国排位">
          <el-input-number v-model="form.rank" :min="0" :max="9999" :step="1" controls-position="right" />
        </el-form-item>

        <el-divider>{{ editing ? `当期指标（${period}）` : '初始指标' }}</el-divider>
        <el-form-item :label="METRIC_LABEL.heat">
          <el-input-number v-model="form.heat" :min="0" :step="10" controls-position="right" />
        </el-form-item>
        <el-form-item :label="`${METRIC_LABEL.passenger}（万）`">
          <el-input-number v-model="form.passenger" :min="0" :step="10" controls-position="right" />
        </el-form-item>
        <el-form-item :label="`${METRIC_LABEL.economy}（亿）`">
          <el-input-number v-model="form.economy" :min="0" :step="10" controls-position="right" />
        </el-form-item>

        <el-form-item v-if="editing" label="批量填充">
          <el-checkbox v-model="batchFill">将当期指标批量填充到其他全部周期</el-checkbox>
        </el-form-item>
        <el-form-item v-else label="初始化策略">
          <el-radio-group v-model="initMode">
            <el-radio value="copy">该组数值复制到全部周期</el-radio>
            <el-radio value="last">仅写入最新一期，其余期置 0</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.cities {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search {
  width: 240px;
}

.province {
  width: 150px;
}

.filter-label {
  font-size: 13px;
  color: var(--xb-text-dim);
}

.period {
  width: 130px;
}

.count-note {
  font-size: 12px;
  color: var(--xb-text-dim);
}

.actions {
  margin-left: auto;
}

.lnglat {
  font-variant-numeric: tabular-nums;
  color: var(--xb-text-dim);
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.geo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.geo-row .el-input-number {
  width: 150px;
}

.map-link {
  font-size: 12px;
  color: var(--xb-cyan);
  text-decoration: none;
}

.map-link:hover {
  text-decoration: underline;
}
</style>
