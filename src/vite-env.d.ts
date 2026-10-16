/// <reference types="vite/client" />

/** 数据源模式：mock（默认，本地时序生成）/ http（真实 REST 后端） */
interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: 'mock' | 'http'
  /** http 模式后端地址，如 https://board.example.com */
  readonly VITE_API_BASE_URL?: string
  /** 监控上报后端地址（M9.2）：缺省时不注册上报器，仅 console.warn 留痕 */
  readonly VITE_MONITOR_URL?: string
  /** 大屏运行配置（M9.4）：内联 JSON 字符串；缺省时运行时尝试 fetch /board.config.json */
  readonly VITE_BOARD_CONFIG?: string
}

declare module '*.geojson?raw' {
  const content: string
  export default content
}
