import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, KeyboardEvent } from 'react'
import { ArrowUpRight, Search, X } from 'lucide-react'
import { SCOPES, VARIABLES, isScopeId, isVariableId } from '../data/variables'
import { searchPlaces } from '../lib/geocode'
import { formatCoords } from '../lib/format'
import type { CaseConfig, Place, ScopeId, VariableId } from '../types'
import { VariableGlyph } from './Icons'

const FALLBACK_PLACE: Place = {
  name: 'Johor Bahru',
  detail: 'Johor, Malaysia',
  lat: 1.4582,
  lon: 103.7649,
  country: 'Malaysia',
}

interface IntakeProps {
  pickedPlace: Place | null
  onPlacePick: (place: Place) => void
  onStart: (config: CaseConfig) => void
  compact?: boolean
}

export function Intake({ pickedPlace, onPlacePick, onStart, compact = false }: IntakeProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Place | null>(null)
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [variable, setVariable] = useState<VariableId>('T2M')
  const [scope, setScope] = useState<ScopeId>('local')
  const inputRef = useRef<HTMLInputElement>(null)
  const skipSearch = useRef(false)
  const suggestRef = useRef<HTMLDivElement>(null)
  const [dropUp, setDropUp] = useState(false)

  useEffect(() => {
    if (!pickedPlace) return
    skipSearch.current = true
    setSelected(pickedPlace)
    setQuery(pickedPlace.name)
    setSuggestions([])
    setOpen(false)
    setSubmitError(null)
  }, [pickedPlace])

  useEffect(() => {
    const trimmed = query.trim()
    if (skipSearch.current) {
      skipSearch.current = false
      return
    }
    if (trimmed.length < 2 || (selected && trimmed === selected.name)) {
      setSuggestions([])
      setOpen(false)
      setSearching(false)
      return
    }
    const controller = new AbortController()
    setSearching(true)
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchPlaces(trimmed, controller.signal)
        setSuggestions(results)
        setOpen(results.length > 0)
        setActive(-1)
        setSearchError(null)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setSearchError('Place lookup is unavailable. You can still enter coordinates.')
      } finally {
        setSearching(false)
      }
    }, 280)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [query, selected])

  // The hero sits low in the first screen, so a downward list would open past the
  // fold. Flip it above the bar whenever there is no room below.
  useLayoutEffect(() => {
    const el = suggestRef.current
    const bar = inputRef.current?.parentElement
    if (!open || suggestions.length === 0 || !el || !bar) return
    const update = () => {
      const b = bar.getBoundingClientRect()
      const h = el.offsetHeight
      setDropUp(b.bottom + 8 + h > window.innerHeight - 8 && b.top - 8 - h > 8)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open, suggestions])

  const scopeInfo = useMemo(() => SCOPES[scope], [scope])

  function choose(place: Place) {
    setSelected(place)
    setQuery(place.name)
    setSuggestions([])
    setOpen(false)
    setActive(-1)
    setSubmitError(null)
    onPlacePick(place)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting) return
    setSubmitError(null)
    let place = selected
    const trimmed = query.trim()

    if (!place) {
      if (trimmed.length === 0) {
        place = FALLBACK_PLACE
      } else {
        setSubmitting(true)
        try {
          const results = await searchPlaces(trimmed)
          if (results.length === 0) {
            setSubmitError('No place matched that search. Try a city name or “1.46, 103.76”.')
            return
          }
          place = results[0]
          choose(results[0])
        } catch {
          setSubmitError('That search did not return a place. Try coordinates instead.')
          return
        } finally {
          setSubmitting(false)
        }
      }
    }

    onStart({ place, variable, scope })
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || suggestions.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current <= 0 ? suggestions.length - 1 : current - 1))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      choose(suggestions[active])
    }
  }

  return (
    <form className={`intake ${compact ? 'is-compact' : ''}`} onSubmit={handleSubmit} role="search">
      <div className="intake-bar">
        <span className="intake-icon" aria-hidden="true">
          <Search size={18} strokeWidth={1.6} />
        </span>
        <label htmlFor="place-search" className="sr-only">
          Search for a place or enter coordinates
        </label>
        <input
          id="place-search"
          ref={inputRef}
          className="intake-input"
          type="text"
          value={query}
          placeholder="Search a city, region, or 1.46, 103.76"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls="place-suggestions"
          aria-autocomplete="list"
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(null)
            setSubmitError(null)
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true)
          }}
        />
        {searching && <span className="intake-spinner" aria-label="Searching" />}
        {query && !searching && (
          <button
            type="button"
            className="intake-clear"
            aria-label="Clear search"
            onClick={() => {
              setQuery('')
              setSelected(null)
              setSuggestions([])
              setOpen(false)
              inputRef.current?.focus()
            }}
          >
            <X size={15} />
          </button>
        )}
        <button type="submit" className="btn btn-primary intake-go" disabled={submitting}>
          {submitting ? 'Locating' : 'Open case'}
          <ArrowUpRight size={16} strokeWidth={1.8} />
        </button>
      </div>

      {open && suggestions.length > 0 && (
        <div
          className={`intake-suggest ${dropUp ? 'is-up' : ''}`}
          id="place-suggestions"
          role="listbox"
          aria-label="Place matches"
          ref={suggestRef}
        >
          {suggestions.map((place, index) => (
            <button
              key={`${place.name}-${place.lat}-${place.lon}`}
              type="button"
              role="option"
              aria-selected={index === active}
              className={`suggest-row ${index === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(place)}
            >
              <span className="suggest-dot" />
              <span className="suggest-main">
                <strong>{place.name}</strong>
                <span>{place.detail || 'Open record'}</span>
              </span>
              <span className="suggest-coords mono">{formatCoords(place.lat, place.lon)}</span>
            </button>
          ))}
          <div className="suggest-foot mono">
            Place lookup by Photon / OpenStreetMap · click the globe to pin a point
          </div>
        </div>
      )}

      {(searchError || submitError) && (
        <p className="intake-error" role="alert">
          {submitError || searchError}
        </p>
      )}

      {selected && (
        <div className="intake-selected">
          <span className="selected-pulse" />
          <span>
            <strong>{selected.name}</strong>
            <span className="mono">{formatCoords(selected.lat, selected.lon)}</span>
          </span>
          <button
            type="button"
            aria-label="Forget selected place"
            onClick={() => {
              setSelected(null)
              setQuery('')
              inputRef.current?.focus()
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="intake-options">
        <div className="option-block">
          <span className="option-label mono">Earth signal</span>
          <div className="variable-rail" role="group" aria-label="Choose an Earth signal">
            {VARIABLES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`variable-chip ${variable === item.id ? 'is-active' : ''}`}
                style={{ '--chip-color': item.color } as CSSProperties}
                aria-pressed={variable === item.id}
                title={item.blurb}
                onClick={() => setVariable(isVariableId(item.id) ? item.id : 'T2M')}
              >
                <VariableGlyph variable={item} size={13} />
                {item.short}
              </button>
            ))}
          </div>
        </div>

        <div className="option-block option-scope">
          <span className="option-label mono">Area sampled</span>
          <div className="scope-toggle" role="group" aria-label="Choose the area sampled">
            {(Object.keys(SCOPES) as ScopeId[]).map((id) => (
              <button
                key={id}
                type="button"
                className={scope === id ? 'is-active' : ''}
                aria-pressed={scope === id}
                onClick={() => setScope(isScopeId(id) ? id : 'local')}
              >
                {SCOPES[id].label}
              </button>
            ))}
          </div>
          <span className="scope-note mono">{scopeInfo.description}</span>
        </div>
      </div>

      <p className="intake-note mono">
        Monthly NASA record · 1991–2025 · 25-point spatial check · no account, no key
      </p>
    </form>
  )
}
