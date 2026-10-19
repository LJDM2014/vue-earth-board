<script setup lang="ts">
/**
 * 导入导出（A7，docs/admin-module-plan.md §6）：
 * - 下载区：scope × format 选择，<a> 触发浏览器下载（服务端 Content-Disposition）；模板下载为 CSV 表头 + 2 行示例；
 * - 上传区：el-upload 读文件为文本 → POST /api/import?mode=merge|replace（replace 红色警示二次确认），
 *   结果回显 total/accepted/skipped + 级联提示 + 错误明细表格（行 + 原因）；
 * - 周期管理：追加（初始值复制最后一期）/删除（最后一期禁删），操作后 refresh 同步管理端单例状态；
 * - 危险操作：重置种子数据（error 级警示 + ElMessageBox 二次确认）。
 */
import { computed, onMounted, ref } from 'vue'
import type { UploadFile } from 'element-plus'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Download, Upload } from '@element-plus/icons-vue'
import { api, downloadExport } from '../api/client'
import type { ExportScope, ImportMode, ImportResult } from '../api/client'
import { useAdminData } from '../composables/useAdminData'

const { periods, refresh } = useAdminData()

onMounted(() => {
  refresh().catch(() => {
    /* 顶栏已有网络错误提示，此处静默（周期区展示为空） */
  })
})

/* ---------------- 下载 ---------------- */

const dlScope = ref<ExportScope>('all')
const dlFormat = ref<'json' | 'csv'>('json')
const SCOPE_LABEL: Record<ExportScope, string> = { all: '全量快照', cities: '仅城市', flows: '仅航线' }
const downloading = ref(false)

/** fetch + blob 下载（服务端启用 ADMIN_TOKEN 门禁时导出也需携带 x-admin-token，<a href> 无法带自定义头） */
async function download(template: boolean): Promise<void> {
  try {
    downloading.value = true
    await downloadExport(dlScope.value, dlFormat.value, template)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导出失败')
  } finally {
    downloading.value = false
  }
}

/* ---------------- 上传与导入 ---------------- */

const upMode = ref<ImportMode>('merge')
const pendingFile = ref<{ name: string; text: string } | null>(null)
const importing = ref(false)
const importResult = ref<ImportResult | null>(null)

async function onFileChange(file: UploadFile): Promise<void> {
  const raw = file.raw
  if (!raw) return
  if (raw.size > 8 * 1024 * 1024) {
    ElMessage.warning('文件过大（上限 8MB）')
    return
  }
  try {
    pendingFile.value = { name: raw.name, text: await raw.text() }
  } catch {
    ElMessage.error('文件读取失败，请重新选择')
    return
  }
  importResult.value = null
}

function clearFile(): void {
  pendingFile.value = null
  importResult.value = null
}

async function doImport(): Promise<void> {
  if (!pendingFile.value) {
    ElMessage.warning('请先选择要导入的文件（.json / .csv）')
    return
  }
  if (upMode.value === 'replace') {
    try {
      await ElMessageBox.confirm(
        `replace 模式将先清空所选文件范围内的现有数据再导入，多余数据会被删除且不可恢复。确定继续？`,
        '危险操作 · replace 导入',
        { type: 'warning', confirmButtonText: '清空并导入', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
      )
    } catch {
      return
    }
  }
  try {
    importing.value = true
    const r = await api.importData(upMode.value, pendingFile.value.text)
    importResult.value = r
    if (r.skipped === 0) ElMessage.success(`导入成功：${r.accepted}/${r.total} 条全部接受`)
    else ElMessage.warning(`导入完成：接受 ${r.accepted} / 跳过 ${r.skipped}（共 ${r.total} 条）`)
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '导入失败')
  } finally {
    importing.value = false
  }
}

/* ---------------- 周期管理 ---------------- */

const newPeriod = ref('')
const periodBusy = ref(false)
const lastPeriod = computed(() => periods.value[periods.value.length - 1] ?? '')

async function addPeriod(): Promise<void> {
  const p = newPeriod.value.trim()
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(p)) {
    ElMessage.warning('周期格式需为 YYYY-MM（月份 01-12）')
    return
  }
  try {
    periodBusy.value = true
    await api.addPeriod(p)
    ElMessage.success(`已追加周期 ${p}（初始值复制自最后一期）`)
    newPeriod.value = ''
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '追加周期失败')
  } finally {
    periodBusy.value = false
  }
}

async function removePeriod(p: string): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除周期「${p}」将同时清除该期的全部城市指标与航线运量，确定删除？`,
      '删除周期',
      { type: 'warning', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  try {
    periodBusy.value = true
    await api.deletePeriod(p)
    ElMessage.success(`已删除周期 ${p}`)
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '删除周期失败')
  } finally {
    periodBusy.value = false
  }
}

/* ---------------- 危险操作：重置 ---------------- */

const resetting = ref(false)

async function doReset(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '将丢弃全部当前数据并回到种子状态（75 城 / 45 航线 / 12 期），此操作不可恢复！',
      '危险操作 · 重置数据',
      { type: 'error', confirmButtonText: '确认重置', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' },
    )
  } catch {
    return
  }
  try {
    resetting.value = true
    const r = await api.resetDb()
    ElMessage.success(`已重置：${r.cities} 城 / ${r.flows} 航线 / ${r.periods} 期`)
    await refresh(true)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '重置失败')
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <section class="page transfer">
    <div class="card">
      <h3>数据下载</h3>
      <div class="dl-row">
        <el-radio-group v-model="dlScope">
          <el-radio-button value="all">全量快照</el-radio-button>
          <el-radio-button value="cities">仅城市</el-radio-button>
          <el-radio-button value="flows">仅航线</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="dlFormat">
          <el-radio-button value="json">JSON</el-radio-button>
          <el-radio-button value="csv">CSV（Excel）</el-radio-button>
        </el-radio-group>
        <el-button type="primary" :icon="Download" :loading="downloading" @click="download(false)">
          下载 {{ SCOPE_LABEL[dlScope] }}
        </el-button>
        <el-button :icon="Download" :loading="downloading" @click="download(true)">
          CSV 模板（表头 + 示例）
        </el-button>
      </div>
      <p class="hint">
        JSON 为可回导的快照结构（全量含周期与元数据）；CSV 长表为 UTF-8 with BOM（Excel 中文兼容），
        城市块 name,province,lng,lat,period,heat,passenger,economy / 航线块 from,to,category,period,volume。
      </p>
    </div>

    <div class="card">
      <h3>数据上传</h3>
      <div class="up-row">
        <el-radio-group v-model="upMode">
          <el-radio-button value="merge">merge · 按唯一键合并</el-radio-button>
          <el-radio-button value="replace">replace · 先清空再导入</el-radio-button>
        </el-radio-group>
        <el-upload
          :auto-upload="false"
          :show-file-list="false"
          accept=".json,.csv,.txt"
          :on-change="onFileChange"
        >
          <el-button :icon="Upload">选择文件</el-button>
        </el-upload>
        <template v-if="pendingFile">
          <el-tag closable @close="clearFile">{{ pendingFile.name }}</el-tag>
        </template>
        <el-button
          type="primary"
          :loading="importing"
          :disabled="!pendingFile"
          :class="{ 'danger-btn': upMode === 'replace' }"
          @click="doImport"
        >
          {{ upMode === 'replace' ? 'replace 导入' : '开始导入' }}
        </el-button>
      </div>
      <el-alert
        v-if="upMode === 'replace'"
        type="warning"
        :closable="false"
        show-icon
        title="replace 模式会先清空文件对应范围（快照=全量 / 仅城市 / 仅航线）内的现有数据，引用已消失城市的航线将被级联删除"
      />
      <p class="hint">
        支持导出的 JSON 快照（{cities,flows} / {cities} / {flows}）或 CSV 长表（可同时含城市与航线两块）；
        逐行校验，脏行自动跳过并回显原因，不影响其余数据。
      </p>

      <template v-if="importResult">
        <el-divider />
        <div class="result-stats">
          <el-tag type="success" effect="plain">接受 {{ importResult.accepted }}</el-tag>
          <el-tag :type="importResult.skipped > 0 ? 'danger' : 'info'" effect="plain">
            跳过 {{ importResult.skipped }}
          </el-tag>
          <el-tag type="info" effect="plain">总计 {{ importResult.total }}</el-tag>
          <el-tag v-if="importResult.cascadeFlows" type="warning" effect="plain">
            级联清除航线 {{ importResult.cascadeFlows }} 条
          </el-tag>
          <el-tag v-if="importResult.errorsTruncated" type="danger" effect="plain">
            脏行较多，错误明细仅显示前 100 条
          </el-tag>
        </div>
        <el-table v-if="importResult.errors.length > 0" :data="importResult.errors" size="small" class="err-table">
          <el-table-column prop="row" label="行" width="240" />
          <el-table-column prop="detail" label="跳过原因" />
        </el-table>
      </template>
    </div>

    <div class="card">
      <h3>周期管理</h3>
      <div class="period-row">
        <el-tag
          v-for="p in periods"
          :key="p"
          :closable="p !== lastPeriod"
          :effect="p === lastPeriod ? 'dark' : 'plain'"
          @close="removePeriod(p)"
        >
          {{ p }}
        </el-tag>
      </div>
      <p class="hint">高亮为最新一期（不可删除）；删除周期会级联清除该期全部指标与运量；追加周期初始值复制自最后一期。</p>
      <div class="period-add">
        <el-input
          v-model="newPeriod"
          placeholder="YYYY-MM，如 2026-01"
          class="period-input"
          maxlength="7"
          @keyup.enter="addPeriod"
        />
        <el-button type="primary" :loading="periodBusy" @click="addPeriod">追加周期</el-button>
      </div>
    </div>

    <div class="card danger-zone">
      <h3>危险操作</h3>
      <div class="up-row">
        <el-button type="danger" plain :icon="Delete" :loading="resetting" @click="doReset">
          重置为种子数据
        </el-button>
        <span class="hint inline">丢弃全部当前数据，恢复到 75 城 / 45 航线 / 12 期的初始种子状态</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.transfer {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.dl-row,
.up-row,
.period-add {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--xb-text-dim, #8ba3b5);
  line-height: 1.7;
}

.hint.inline {
  margin: 0;
}

.danger-btn {
  --el-button-bg-color: var(--el-color-danger);
  --el-button-border-color: var(--el-color-danger);
}

.result-stats {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
}

.err-table {
  max-width: 760px;
}

.period-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.period-add {
  margin-top: 4px;
}

.period-input {
  width: 180px;
}

.danger-zone :deep(h3) {
  color: var(--el-color-danger);
}
</style>
