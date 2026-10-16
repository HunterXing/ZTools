/**
 * zbrowser 窗口池管理器
 *
 * 管理每个插件的 zbrowser 空闲窗口和独立 Session。
 *
 * 职责：
 * - 为每个插件创建并缓存独立的 Electron Session（分区键 `<pluginName.zbrowser>`）
 * - 维护每个插件的空闲窗口 ID 列表
 * - 提供代理设置和缓存清理接口
 */

import { BrowserWindow, session } from 'electron'
import type { ZBrowserIdleWindowInfo } from './types'

class ZBrowserManager {
  /** 每个插件变体的空闲窗口 ID 列表（runtimeNamespace → windowId[]） */
  private idleWindowIds: Map<string, number[]> = new Map()

  /** 每个插件变体的 zbrowser Session 缓存（runtimeNamespace → Session） */
  private sessionPool: Map<string, Electron.Session> = new Map()

  /**
   * 获取或创建插件的 zbrowser 专用 Session
   *
   * 使用 `<pluginName.zbrowser>` 作为分区名，
   * 与插件自身的 `persist:pluginName` 隔离。
   *
   * @param runtimeNamespace 插件运行时命名空间
   * @param pluginName 插件真实名称，仅用于日志
   * @returns Electron Session 实例
   */
  getOrCreateSession(runtimeNamespace: string, pluginName?: string): Electron.Session {
    let sess = this.sessionPool.get(runtimeNamespace)
    if (!sess) {
      const partition = `${runtimeNamespace}.zbrowser`
      sess = session.fromPartition(partition)
      this.sessionPool.set(runtimeNamespace, sess)
      console.log('[zbrowser] 为插件创建 Session:', {
        pluginName: pluginName || runtimeNamespace,
        runtimeNamespace,
        partition
      })
    }
    return sess
  }

  /**
   * 获取插件的空闲窗口 ID 列表
   *
   * 会自动清理已销毁的窗口。
   *
   * @param runtimeNamespace 插件运行时命名空间
   * @returns 空闲窗口 ID 数组
   */
  getIdleWindowIds(runtimeNamespace: string): number[] {
    const ids = this.idleWindowIds.get(runtimeNamespace)
    if (!ids) return []
    // 清理已销毁的窗口
    const validIds = ids.filter((id) => {
      const win = BrowserWindow.fromId(id)
      return win && !win.isDestroyed()
    })
    this.idleWindowIds.set(runtimeNamespace, validIds)
    return validIds
  }

  /**
   * 获取插件的空闲窗口详细信息
   *
   * 供 getIdleUBrowsers API 返回给插件使用。
   *
   * @param runtimeNamespace 插件运行时命名空间
   * @returns 空闲窗口信息数组（id、标题、URL）
   */
  getIdleWindows(runtimeNamespace: string): ZBrowserIdleWindowInfo[] {
    const ids = this.getIdleWindowIds(runtimeNamespace)
    return ids
      .map((id) => {
        const win = BrowserWindow.fromId(id)
        if (!win || win.isDestroyed()) return null
        return {
          id: win.id,
          title: win.getTitle(),
          url: win.webContents.getURL()
        }
      })
      .filter((info): info is ZBrowserIdleWindowInfo => info !== null)
  }

  /**
   * 将窗口添加到插件的空闲池
   *
   * @param runtimeNamespace 插件运行时命名空间
   * @param windowId BrowserWindow ID
   */
  addIdleWindow(runtimeNamespace: string, windowId: number): void {
    const ids = this.idleWindowIds.get(runtimeNamespace) || []
    if (!ids.includes(windowId)) {
      ids.push(windowId)
      this.idleWindowIds.set(runtimeNamespace, ids)
      console.log(
        `[zbrowser] 空闲窗口入池: runtimeNamespace="${runtimeNamespace}", windowId=${windowId}`
      )
    }
  }

  /**
   * 从插件的空闲池中移除窗口
   *
   * @param runtimeNamespace 插件运行时命名空间
   * @param windowId BrowserWindow ID
   */
  removeIdleWindow(runtimeNamespace: string, windowId: number): void {
    const ids = this.idleWindowIds.get(runtimeNamespace)
    if (!ids) return
    const filtered = ids.filter((id) => id !== windowId)
    this.idleWindowIds.set(runtimeNamespace, filtered)
    if (filtered.length < ids.length) {
      console.log(
        `[zbrowser] 空闲窗口出池: runtimeNamespace="${runtimeNamespace}", windowId=${windowId}`
      )
    }
  }

  /**
   * 清除插件的 zbrowser 缓存
   *
   * @param runtimeNamespace 插件运行时命名空间
   */
  async clearCache(runtimeNamespace: string): Promise<void> {
    const sess = this.sessionPool.get(runtimeNamespace)
    if (!sess) return
    await sess.clearCache()
    console.log(`[zbrowser] 已清除插件 "${runtimeNamespace}" 的缓存`)
  }

  /**
   * 设置插件 zbrowser Session 的代理
   *
   * @param runtimeNamespace 插件运行时命名空间
   * @param config Electron 代理配置对象
   */
  async setProxy(runtimeNamespace: string, config: Electron.ProxyConfig): Promise<void> {
    const sess = this.getOrCreateSession(runtimeNamespace)
    await sess.setProxy(config)
    console.log(`[zbrowser] 已设置插件 "${runtimeNamespace}" 的代理`)
  }
}

export default new ZBrowserManager()
