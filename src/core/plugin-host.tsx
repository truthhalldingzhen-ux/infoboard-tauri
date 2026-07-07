import { useState, useMemo, createElement } from 'react'
import { getAll, getById } from '../plugins/registry'
import type { PluginManifest } from '../plugins/types'

export default function PluginHost() {
  const [activeId] = useState<string>(() => {
    const plugins = getAll()
    return plugins.length > 0 ? plugins[0].id : ''
  })

  const activePlugin = useMemo(() => getById(activeId), [activeId])

  return <>{activePlugin && createElement(activePlugin.component)}</>
}

export type { PluginManifest }
