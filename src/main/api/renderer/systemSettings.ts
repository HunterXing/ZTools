import { WINDOWS_SETTINGS } from '../../core/systemSettings/windowsSettings.js'

export class SystemSettingsAPI {
  public init(): void {
    // 暂时不需要初始化逻辑
  }

  public async getSystemSettings(): Promise<any[]> {
    if (process.platform === 'win32') {
      return WINDOWS_SETTINGS
    }
    return []
  }

  public isWindows(): boolean {
    return process.platform === 'win32'
  }
}

export const systemSettingsAPI = new SystemSettingsAPI()
