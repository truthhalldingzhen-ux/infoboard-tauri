import type { InfoBoardPlugin } from '../core/types'
import { weatherPlugin } from './weather'
import { todoPlugin } from './todo'
import { openCodeGoPlugin } from './opencode-go'
import { settingsPlugin } from './settings'

export const plugins: InfoBoardPlugin[] = [
  weatherPlugin,
  todoPlugin,
  openCodeGoPlugin,
  settingsPlugin,
]
