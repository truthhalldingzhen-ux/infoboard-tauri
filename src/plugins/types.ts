import type { ComponentType } from 'react'

export interface PluginManifest {
  id: string
  name: string
  description: string
  icon: string
  category: 'info' | 'tool' | 'settings'
  component: ComponentType
}
