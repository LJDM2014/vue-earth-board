<script setup lang="ts">
/**
 * 航线 OD 管理（A6）：
 * - 列表：起讫关键词搜索 + 类别筛选 + 查看周期切换 + 分页（每页 20，计划 §5.3）；
 * - 新增/编辑弹窗：from/to 城市下拉（el-select filterable，选项来自城市表）+ 类别 + 当期运量；
 *   新增带运量初始化策略（复制全部期 / 仅最新一期），编辑带「批量填充其他期」快捷操作；
 *   zod 同规则前端预校验；
 * - 删除：ElMessageBox 确认（无级联）；保存/删除成功后 refresh(true) 同步全站单例状态。
 */
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { z } from 'zod'
import { api } from '../api/client'
import type { FlowCategory, FlowRecord } from '../types'
import { useAdminData } from '../composables/useAdminData'

const { cities, flows, periods, loading, refresh } = useAdminData()

const PAGE_SIZE = 20
const CATEGORY_LABEL: Record<FlowCategory, string> = { passenger: '客运', cargo: '货运' }

/* ---------------- 列表筛选与分页 ---------------- */

const keyword = ref('')
const categoryFilter = ref<'' | FlowCategory>('')
const period = ref('')
const page = ref(1)

const filtered = computed(() => {
  const kw = keyword.value.trim()
  return flows.value.filter(
    (f) =>
      (!kw || f.from.includes(kw) || f.to.includes(kw)) &&
      (!categoryFilter.value || f.category === categoryFilter.value),
  )
})
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
watch([keyword, categoryFilter], () => {
  page.value = 1
})

const volumeOf = (f: FlowRecord): number => f.volumes[period.value] ?? 0
const fmt = (v: number): string => v.toLocaleString('zh-CN')

/* ---------------- 表单（新增/编辑共用） ---------------- */

const dialogVisible = ref(false)
/** 编辑态记录航线 id；null = 新增 */
const editing = ref<number | null>(null)
const saving = ref(false)
const initMode = ref<'copy' | 'last'>('copy')
const batchFill = ref(false)

const form = reactive({
  from: '',
  to: '',
  category: 'passenger' as FlowCategory,
  volume: 0 as number | null,
})

/** zod 预校验（与 server/schemas.ts flowCreate/UpdateSchema 同规则） */
const formSchema = z
  .object({
    from: z.string().trim().min(1, '请选择起点城市'),
    to: z.string().trim().min(1, '请选择终点城市'),
    category: z.enum(['passenger', 'cargo'], '请选择类别'),
    volume: z.number('运量需为数字').min(0, '运量不能为负数'),
  })
  .refine((d) => d.from !== d.to, { message: '起点与终点不能为同一城市', path: ['to'] })

function openCreate(): void {
  editing.value = null
  initMode.value = 'copy'
  Object.assign(form, { from: '', to: '', category: 'passenger', volume: 0 })
  dialogVisible.value = true
}

function openEdit(row: FlowRecord): void {
  editing.value = row.id
  batchFill.value = false
  Object.assign(form, { from: row.from, to: row.to, category: row.category, volume: volumeOf(row) })
  dialogVisible.value = true
}

/** 按初始化/批量填充策略生成 volumes 载荷（key = 周期） */
function buildVolumes(): Record<string, number> {
  const v = form.volume ?? 0
  if (editing.value) {
    const target = batchFill.value ? periods.value : [period.value]
    return Object.fromEntries(target.map((p) => [p, v]))
  }
  if (initMode.value === 'copy') return Object.fromEntries(periods.value.map((p) => [p, v]))
  const last = periods.value[periods.value.length - 1]
  return last ? { [last]: v } : {}
}

async function handleSave(): Promise<void> {
  const parsed = formSchema.safeParse({ ...form })
  if (!parsed.success) {
    ElMessage.warning(parsed.error.issues[0]?.message ?? '表单校验未通过')
    return
  }
  const d = parsed.data
  if (!period.value) {
    ElMessage.warning('数据尚未加载完成，请稍后重试')
    return
  }
  const volumes = buildVolumes()
  try {
    saving.value = true
    if (editing.value !== null) {
      await api.updateFlow(editing.value, { from: d.from, to: d.to, category: d.category, volumes })
      ElMessage.success(`已保存航线「${d.from} → ${d.to}」（${Object.keys(volumes).length} 期）`)
    } else {
      await api.createFlow({ from: d.from, to: d.to, category: d.category, volumes })
      ElMessage.success(`已新增航线「${d.from} → ${d.to}」`)
    }
    dialogVisible.value = false
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: FlowRecord): Promise<void> {
  try {
    await ElMessageBox.confirm(`确认删除航线「${row.from} → ${row.to}」（${CATEGORY_LABEL[row.category]}）？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
    })
  } catch {
    return // 用户取消
  }
  try {
    await api.deleteFlow(row.id)
    ElMessage.success(`已删除航线「${row.from} → ${row.to}」`)
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
    ElMessage.error(err instanceof Error ? err.message : '航线数据加载失败')
  }
})
</script>

<template>
  <section v-loading="loading" class="page flows">
    <div class="card toolbar">
      <el-input v-model="keyword" class="search" placeholder="搜索起 / 讫城市名" clearable :prefix-icon="Search" />
      <el-select v-model="categoryFilter" class="category" placeholder="全部类别" clearable>
        <el-option label="客运" value="passenger" />
        <el-option label="货运" value="cargo" />
      </el-select>
      <span class="filter-label">查看周期</span>
      <el-select v-model="period" class="period">
        <el-option v-for="p in periods" :key="p" :label="p" :value="p" />
      </el-select>
      <span class="count-note">共 {{ filtered.length }} 条</span>
      <div class="actions">
        <el-button :icon="Refresh" @click="refresh(true)">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增航线</el-button>
      </div>
    </div>

    <div class="card">
      <el-table :data="paged" :row-key="(r: FlowRecord) => r.id">
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column label="航线" min-width="180">
          <template #default="{ row }">
            <span class="od">{{ (row as FlowRecord).from }} → {{ (row as FlowRecord).to }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类别" width="100">
          <template #default="{ row }">
            <el-tag :type="(row as FlowRecord).category === 'passenger' ? 'primary' : 'warning'" effect="dark" size="small">
              {{ CATEGORY_LABEL[(row as FlowRecord).category] }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当期运量（万人次）" width="180" align="right">
          <template #default="{ row }">{{ fmt(volumeOf(row as FlowRecord)) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row as FlowRecord)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row as FlowRecord)">删除</el-button>
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
      :title="editing !== null ? `编辑航线 · ${form.from} → ${form.to}` : '新增航线'"
      width="520px"
      destroy-on-close
    >
      <el-form label-width="92px">
        <el-form-item label="起点城市">
          <el-select v-model="form.from" filterable placeholder="选择或搜索城市" class="city-select">
            <el-option v-for="c in cities" :key="c.name" :label="`${c.name}（${c.province}）`" :value="c.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="终点城市">
          <el-select v-model="form.to" filterable placeholder="选择或搜索城市" class="city-select">
            <el-option v-for="c in cities" :key="c.name" :label="`${c.name}（${c.province}）`" :value="c.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="类别">
          <el-radio-group v-model="form.category">
            <el-radio value="passenger">客运</el-radio>
            <el-radio value="cargo">货运</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-divider>{{ editing !== null ? `当期运量（${period}）` : '初始运量' }}</el-divider>
        <el-form-item label="运量（万）">
          <el-input-number v-model="form.volume" :min="0" :step="10" controls-position="right" />
        </el-form-item>

        <el-form-item v-if="editing !== null" label="批量填充">
          <el-checkbox v-model="batchFill">将当期运量批量填充到其他全部周期</el-checkbox>
        </el-form-item>
        <el-form-item v-else label="初始化策略">
          <el-radio-group v-model="initMode">
            <el-radio value="copy">该运量复制到全部周期</el-radio>
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
.flows {
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
  width: 220px;
}

.category {
  width: 120px;
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

.od {
  font-variant-numeric: tabular-nums;
}

.pager {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}

.city-select {
  width: 100%;
}
</style>
