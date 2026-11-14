import { useCallback, useEffect, useState } from 'react'
import { Footer, TopBar } from './components/Chrome'
import { Landing } from './components/Landing'
import { CaseView } from './components/CaseView'
import { MethodDrawer, type DrawerMode } from './components/MethodDrawer'
import { encodeCase, readCaseFromLocation } from './lib/urlState'
import type { CaseConfig, VariableId } from './types'

const DEFAULT_TITLE = 'Open Case: Earth — Every place leaves a record'

function caseKey(config: CaseConfig): string {
  return `${config.place.lat.toFixed(4)}:${config.place.lon.toFixed(4)}:${config.variable}:${config.scope}`
}

export default function App() {
  const [config, setConfig] = useState<CaseConfig | null>(() => readCaseFromLocation())
  const [drawer, setDrawer] = useState<DrawerMode | null>(null)

  useEffect(() => {
    const sync = () => setConfig(readCaseFromLocation())
    window.addEventListener('popstate', sync)
    window.addEventListener('hashchange', sync)
    return () => {
      window.removeEventListener('popstate', sync)
      window.removeEventListener('hashchange', sync)
    }
  }, [])

  useEffect(() => {
    if (!config) document.title = DEFAULT_TITLE
  }, [config])

  const openCase = useCallback((next: CaseConfig) => {
    window.history.pushState(null, '', encodeCase(next))
    setConfig(next)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const goHome = useCallback(() => {
    window.history.pushState(null, '', window.location.pathname)
    setConfig(null)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [])

  const switchVariable = useCallback(
    (variable: VariableId) => {
      setConfig((current) => {
        if (!current || current.variable === variable) return current
        const next: CaseConfig = { ...current, variable }
        window.history.replaceState(null, '', encodeCase(next))
        window.scrollTo({ top: 0, behavior: 'auto' })
        return next
      })
    },
    [],
  )

  const openMethod = useCallback(() => setDrawer('method'), [])
  const openData = useCallback(() => setDrawer('data'), [])
  const closeDrawer = useCallback(() => setDrawer(null), [])

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopBar config={config} onHome={goHome} onOpenMethod={openMethod} onOpenData={openData} />
      <main id="main">
        {config ? (
          <CaseView
            key={caseKey(config)}
            config={config}
            onBack={goHome}
            onOpenMethod={openMethod}
            onOpenData={openData}
            onVariable={switchVariable}
          />
        ) : (
          <Landing onStart={openCase} onOpenMethod={openMethod} onOpenData={openData} />
        )}
      </main>
      <Footer onOpenMethod={openMethod} onOpenData={openData} />
      <MethodDrawer mode={drawer} onClose={closeDrawer} onModeChange={setDrawer} />
    </>
  )
}