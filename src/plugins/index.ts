import type { InfoBoardPlugin } from '../core/types'
import { weatherPlugin } from './weather'
import { todoPlugin } from './todo'
import { openCodeGoPlugin } from './opencode-go'
import { dynamicIslandPlugin } from './dynamic-island'
import { settingsPlugin } from './settings'

export const plugins: InfoBoardPlugin[] = [
  dynamicIslandPlugin,
  weatherPlugin,
  todoPlugin,
  openCodeGoPlugin,
  settingsPlugin,
]
