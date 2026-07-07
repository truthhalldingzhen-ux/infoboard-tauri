import { register } from './registry'
import { manifest as opencodeManifest } from './opencode/manifest'
import OpenCodeCard from './opencode/index'
import { manifest as weatherManifest } from './weather/manifest'
import WeatherCard from './weather/index'
import { manifest as todoManifest } from './todo/manifest'
import TodoCard from './todo/index'
import { manifest as settingsManifest } from './settings/manifest'
import SettingsPanel from './settings/index'

register({ ...opencodeManifest, component: OpenCodeCard })
register({ ...weatherManifest, component: WeatherCard })
register({ ...todoManifest, component: TodoCard })
register({ ...settingsManifest, component: SettingsPanel })
