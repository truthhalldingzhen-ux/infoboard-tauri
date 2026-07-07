import { pluginRegistry } from './registry'
import type { InfoBoardPlugin } from './types'
import OpenCodeCard from './opencode/index'
import { manifest as opencodeManifest } from './opencode/manifest'
import WeatherCard from './weather/index'
import { manifest as weatherManifest } from './weather/manifest'
import TodoCard from './todo/index'
import { manifest as todoManifest } from './todo/manifest'
import SettingsPanel from './settings/index'
import { manifest as settingsManifest } from './settings/manifest'

const plugins: InfoBoardPlugin[] = [
  { manifest: opencodeManifest, Component: OpenCodeCard },
  { manifest: weatherManifest, Component: WeatherCard },
  { manifest: todoManifest, Component: TodoCard },
  { manifest: settingsManifest, Component: SettingsPanel },
]

pluginRegistry.registerAll(plugins)
