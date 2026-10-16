import { registerPluginApiServices } from './pluginApiDispatcher'
import ffmpegManager from '../../core/ffmpeg'

class PluginFFmpegAPI {
  public init(): void {
    registerPluginApiServices({
      getFFmpegPath: async () => {
        return await ffmpegManager.ensureFFmpeg()
      }
    })
  }
}

export default new PluginFFmpegAPI()
