export interface SettingsState {
  theme: 'light' | 'dark' | 'pink-purple'
  disabledPlugins: string[]
}

export const DEFAULT_SETTINGS: SettingsState = {
  theme: 'light',
  disabledPlugins: [],
}
