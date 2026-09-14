/**
 * localStorage 访问统一入口。
 * 隐私模式、配额写满、被手动改坏的存档都会让原始 API 抛错，
 * 游戏必须能在任何一处读写失败后继续运行，而不是整页白屏。
 */

export const STORAGE_META = 'token-burner.meta.v1'
export const STORAGE_RUN = 'token-burner.active-run.v1'
export const STORAGE_SETTINGS = 'token-burner.settings.v1'
export const STORAGE_MODEL = 'token-burner.start-model.v1'

/** 全部由本游戏写入的键，供错误兜底时一键清理。 */
export const STORAGE_KEYS: string[] = [STORAGE_META, STORAGE_RUN, STORAGE_SETTINGS, STORAGE_MODEL]

export function readStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // 清理失败不影响内存中的状态。
  }
}

export function clearGameStorage(): void {
  for (const key of STORAGE_KEYS) removeStorage(key)
}
