import { ArrowLeft, ArrowUpRight, Database, FunctionSquare, Menu, X } from 'lucide-react'
import { useState } from 'react'
import type { CaseConfig } from '../types'
import { LogoMark } from './Icons'

interface TopBarProps {
  config: CaseConfig | null
  onHome: () => void
  onOpenMethod: () => void
  onOpenData: () => void
}

function scrollTo(id: string): boolean {
  const element = document.getElementById(id)
  if (!element) return false
  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  return true
}

export function TopBar({ config, onHome, onOpenMethod, onOpenData }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  function navigate(id: string) {
    setMenuOpen(false)
    if (config) {
      onHome()
      window.setTimeout(() => scrollTo(id), 140)
    } else {
      scrollTo(id)
    }
  }

  return (
    <header className={`topbar ${config ? 'is-case' : 'is-landing'}`}>
      <div className="topbar-inner">
        <button className="brand" type="button" onClick={onHome} aria-label="Open Case: Earth home">
          <LogoMark size={27} />
          <span className="brand-type">
            <span className="brand-name">Open Case</span>
            <span className="brand-sub mono">Earth</span>
          </span>
        </button>

        {config && (
          <div className="topbar-case">
            <span className="topbar-divider" aria-hidden="true" />
            <button className="topbar-back" type="button" onClick={onHome}>
              <ArrowLeft size={14} />
              <span>All cases</span>
            </button>
            <span className="topbar-place">{config.place.name}</span>
          </div>
        )}

        <nav className={`topbar-nav ${menuOpen ? 'is-open' : ''}`} aria-label="Primary">
          <button type="button" onClick={() => navigate('how')}>
            How it works
          </button>
          <button type="button" onClick={() => navigate('archive')}>
            Case archive
          </button>
          <button type="button" onClick={onOpenMethod}>
            Method
          </button>
          <button type="button" onClick={onOpenData}>
            Data
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm nav-start"
            onClick={() => {
              setMenuOpen(false)
              if (config) {
                onHome()
                window.setTimeout(() => scrollTo('open-case'), 140)
              } else {
                scrollTo('open-case')
              }
            }}
          >
            New case
            <ArrowUpRight size={14} />
          </button>
        </nav>

        <div className="topbar-live mono" title="Live public data services">
          <span className="live-dot" />
          POWER · GIBS
        </div>

        <button
          type="button"
          className="topbar-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>
    </header>
  )
}

export function Footer({
  onOpenMethod,
  onOpenData,
}: {
  onOpenMethod: () => void
  onOpenData: () => void
}) {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <div className="footer-mark">
            <LogoMark size={34} />
            <span className="serif">Open Case: Earth</span>
          </div>
          <p>
            Four decades of open Earth records, read as a case file. Pick a place, test a trend,
            and see the evidence that decides the verdict.
          </p>
          <span className="footer-note mono">
            Independent open-data project · NASA data, not affiliated with NASA
          </span>
        </div>

        <div className="footer-col">
          <span className="footer-heading mono">Product</span>
          <button type="button" onClick={() => scrollTo('how')}>
            How it works
          </button>
          <button type="button" onClick={() => scrollTo('archive')}>
            Case archive
          </button>
          <button type="button" onClick={() => scrollTo('open-case')}>
            Start a case
          </button>
        </div>

        <div className="footer-col">
          <span className="footer-heading mono">Records</span>
          <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">
            NASA POWER
            <ArrowUpRight size={12} />
          </a>
          <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">
            NASA GIBS
            <ArrowUpRight size={12} />
          </a>
          <a href="https://photon.komoot.io/" target="_blank" rel="noreferrer">
            Photon geocoder
            <ArrowUpRight size={12} />
          </a>
          <a href="https://www.openstreetmap.org/" target="_blank" rel="noreferrer">
            OpenStreetMap
            <ArrowUpRight size={12} />
          </a>
        </div>

        <div className="footer-col footer-method">
          <span className="footer-heading mono">Open method</span>
          <button type="button" onClick={onOpenMethod}>
            <FunctionSquare size={13} />
            Every formula is visible
          </button>
          <button type="button" onClick={onOpenData}>
            <Database size={13} />
            Every record is cited
          </button>
          <span className="footer-fine mono">No account · no key · no tracking</span>
        </div>
      </div>
      <div className="container footer-bottom mono">
        <span>1991–2025 · 35 annual records · 8 Earth signals</span>
        <span>Runs in your browser</span>
      </div>
    </footer>
  )
}
