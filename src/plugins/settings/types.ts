export interface SettingsState {
  theme: 'light' | 'dark' | 'pink-purple'
  pluginVisibility: Record<string, boolean>
}

export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'light',
  pluginVisibility: {},
}
