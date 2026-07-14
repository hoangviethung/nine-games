import { useEffect, useMemo, useState } from 'react'
import { useKeywords } from './useKeywords'
import { translations, LOCALES, LANGS, PRIMARY, tr } from './i18n'

const PAGE_SIZE = 100
const PLAYED_KEY = 'playedKeywordIds' // ids, not names — names are translatable

export default function App() {
  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('lang')
    return LANGS.includes(saved) ? saved : PRIMARY
  })
  const t = translations[lang] || translations[PRIMARY]

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const { rows, loading, error } = useKeywords()

  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState(null) // category id
  const [activeLvl, setActiveLvl] = useState(null) // level id
  const [sortKey, setSortKey] = useState('index')
  const [sortDir, setSortDir] = useState(1)
  const [page, setPage] = useState(0)
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)

  // Random keyword picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerItems, setPickerItems] = useState([])
  const [pickerSel, setPickerSel] = useState(null)
  const [pickerPool, setPickerPool] = useState('all')
  // Played keywords accumulate (by id) and persist across reloads
  const [playedIds, setPlayedIds] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem(PLAYED_KEY) || '[]')
      return Array.isArray(a) ? a : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(playedIds))
  }, [playedIds])

  const categories = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => {
      if (!seen.has(r.categoryId))
        seen.set(r.categoryId, { id: r.categoryId, name: r.category, order: r.categoryOrder })
    })
    return [...seen.values()].sort((a, b) => a.order - b.order)
  }, [rows])

  const levels = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => {
      if (!seen.has(r.levelId))
        seen.set(r.levelId, { id: r.levelId, name: r.level, order: r.levelOrder })
    })
    return [...seen.values()].sort((a, b) => a.order - b.order)
  }, [rows])

  const levelCounts = useMemo(() => {
    const c = {}
    rows.forEach((r) => {
      c[r.levelId] = (c[r.levelId] || 0) + 1
    })
    return c
  }, [rows])

  // Data-quality scan. Duplicates are now blocked by unique indexes in the
  // database, so this is a safety net rather than the primary defence: it flags
  // any name duplicated within a language, and any row missing English.
  const issues = useMemo(() => {
    const counts = new Map() // `${locale}:${lowercased name}` -> count
    for (const r of rows) {
      for (const l of LANGS) {
        const v = (r.name?.[l] || '').trim().toLowerCase()
        if (v) counts.set(l + ':' + v, (counts.get(l + ':' + v) || 0) + 1)
      }
    }
    const byIndex = new Map()
    for (const r of rows) {
      const reasons = []
      if (!(r.name?.[PRIMARY] || '').trim()) reasons.push('missing')
      for (const l of LANGS) {
        const v = (r.name?.[l] || '').trim().toLowerCase()
        if (v && counts.get(l + ':' + v) > 1) {
          reasons.push('dup')
          break
        }
      }
      if (reasons.length) byIndex.set(r.index, reasons)
    }
    return byIndex
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(
      (r) =>
        (!activeCat || r.categoryId === activeCat) &&
        (!activeLvl || r.levelId === activeLvl) &&
        (!showIssuesOnly || issues.has(r.index)) &&
        // search matches any language, not just the one on screen
        (!q || LANGS.some((l) => (r.name?.[l] || '').toLowerCase().includes(q)))
    )
    const sortVal = (r) => {
      switch (sortKey) {
        case 'keyword':
          return tr(r.name, lang)
        case 'category':
          return tr(r.category, lang)
        case 'level':
          return r.levelOrder
        default:
          return r.index
      }
    }
    list = [...list].sort((a, b) => {
      const x = sortVal(a)
      const y = sortVal(b)
      const cmp =
        typeof x === 'number' && typeof y === 'number'
          ? x - y
          : String(x).localeCompare(String(y), lang)
      return cmp * sortDir
    })
    return list
  }, [rows, query, activeCat, activeLvl, showIssuesOnly, issues, sortKey, sortDir, lang])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const paged = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [filtered, currentPage]
  )

  // Jump back to the first page whenever the filters/search change the result set
  useEffect(() => {
    setPage(0)
  }, [query, activeCat, activeLvl, showIssuesOnly])

  // If issues get resolved while the issues-only view is active, drop the filter
  useEffect(() => {
    if (showIssuesOnly && issues.size === 0) setShowIssuesOnly(false)
  }, [showIssuesOnly, issues])

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => -d)
    else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  // Draw 5 distinct random rows from a pool
  function drawFive(pool) {
    if (pool.length <= 5) return [...pool]
    const idx = new Set()
    while (idx.size < 5) idx.add(Math.floor(Math.random() * pool.length))
    return [...idx].map((i) => pool[i])
  }

  // Played keywords, resolved back to full rows in play order (persisted by id)
  const rowsById = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => m.set(r.id, r))
    return m
  }, [rows])
  const played = useMemo(
    () => playedIds.map((n) => rowsById.get(n)).filter(Boolean),
    [playedIds, rowsById]
  )
  const playedSet = useMemo(() => new Set(playedIds), [playedIds])

  // The pool respects the active filters when they narrow things down,
  // otherwise it's the whole deck — and always excludes already-played keywords.
  const usingFilter =
    Boolean(query.trim() || activeCat || activeLvl || showIssuesOnly) && filtered.length >= 1
  const pickPool = (usingFilter ? filtered : rows).filter((r) => !playedSet.has(r.id))

  function openPicker() {
    if (!pickPool.length) return
    setPickerPool(usingFilter ? 'filtered' : 'all')
    setPickerItems(drawFive(pickPool))
    setPickerSel(null)
    setPickerOpen(true)
  }
  function reshuffle() {
    setPickerItems(drawFive(pickPool))
    setPickerSel(null)
  }
  function confirmPick() {
    if (pickerSel == null) return
    const chosen = pickerItems[pickerSel]
    setPlayedIds((prev) => (prev.includes(chosen.id) ? prev : [...prev, chosen.id]))
    setPickerOpen(false)
  }
  function removePlayed(id) {
    setPlayedIds((prev) => prev.filter((n) => n !== id))
  }

  // Close the picker on Escape
  useEffect(() => {
    if (!pickerOpen) return
    const onKey = (e) => e.key === 'Escape' && setPickerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pickerOpen])

  const cols = [
    { key: 'keyword', label: t.cols.keyword },
    { key: 'category', label: t.cols.category },
    { key: 'level', label: t.cols.level },
  ]

  // Secondary line: the English name, shown when it isn't already on screen.
  const secondary = (value) => {
    const main = tr(value, lang)
    const en = value?.[PRIMARY] || ''
    return lang !== PRIMARY && en && en !== main ? en : ''
  }

  return (
    <div className="page">
      <header className="app-header">
        <div className="brand">
          <img src="/favicon.svg" alt="Nine Games" className="brand-logo" />
          <div>
            <h1>Nine Games — Keywords</h1>
            <p className="sub">{t.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          className="random-btn"
          onClick={openPicker}
          disabled={loading || !pickPool.length}
        >
          <span className="dice" aria-hidden="true">🎲</span>
          {t.picker.button}
        </button>
      </header>

      {error && (
        <div className="error">
          {t.errorPrefix} {error}
        </div>
      )}

      {played.length > 0 && (
        <div className="played">
          <div className="played-head">
            <span className="played-title">{t.picker.playedTitle}</span>
            <span className="played-count">{played.length}</span>
            <button type="button" className="played-clear" onClick={() => setPlayedIds([])}>
              {t.picker.clearAll}
            </button>
          </div>
          <div className="played-list">
            {played.map((r) => (
              <div className="played-item" key={r.id}>
                <span className="pl-kw">
                  {tr(r.name, lang)}
                  {secondary(r.name) && <span className="pl-vi">· {secondary(r.name)}</span>}
                </span>
                <span className="pl-meta">
                  {tr(r.category, lang)}
                  <span className={'lvl ' + r.levelId}>{tr(r.level, lang)}</span>
                </span>
                <button
                  type="button"
                  className="pl-del"
                  onClick={() => removePlayed(r.id)}
                  aria-label={`${t.picker.remove}: ${tr(r.name, lang)}`}
                  title={t.picker.remove}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <section className="stats">
        <Stat value={rows.length} label={t.stats.total} />
        <Stat value={categories.length} label={t.stats.categories} />
        <Stat value={levelCounts.easy || 0} label={t.stats.easy} tone="easy" />
        <Stat value={levelCounts.medium || 0} label={t.stats.medium} tone="medium" />
        <Stat value={levelCounts.hard || 0} label={t.stats.hard} tone="hard" />
        <button
          type="button"
          className={
            'stat stat-btn' +
            (issues.size ? ' has-issues' : '') +
            (showIssuesOnly ? ' active' : '')
          }
          onClick={() => issues.size && setShowIssuesOnly((v) => !v)}
          disabled={!issues.size}
          title={issues.size ? t.issuesTooltip : t.noIssuesTooltip}
        >
          <b className={issues.size ? 'tone-hard' : 'tone-easy'}>{issues.size}</b>
          <span>
            {issues.size ? '⚠ ' : '✓ '}
            {t.stats.issues}
          </span>
        </button>
      </section>

      <section className="controls">
        <div className="control-group control-search">
          <label className="control-label">{t.search}</label>
          <input
            type="search"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label className="control-label">{t.language}</label>
          <div className="chips">
            {LOCALES.map((l) => (
              <button
                key={l.code}
                className={'chip' + (lang === l.code ? ' on' : '')}
                onClick={() => setLang(l.code)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">{t.category}</label>
          <div className="chips">
            {categories.map((c) => (
              <button
                key={c.id}
                className={'chip' + (activeCat === c.id ? ' on' : '')}
                onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}
                title={c.name?.[PRIMARY] || ''}
              >
                {tr(c.name, lang)}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">{t.level}</label>
          <div className="chips">
            {levels.map((l) => (
              <button
                key={l.id}
                className={'chip lvl-chip ' + l.id + (activeLvl === l.id ? ' on' : '')}
                onClick={() => setActiveLvl(activeLvl === l.id ? null : l.id)}
                title={l.name?.[PRIMARY] || ''}
              >
                {tr(l.name, lang)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="tablewrap">
        <table>
          <thead>
            <tr>
              {cols.map((c) => (
                <th
                  key={c.key}
                  onClick={() => toggleSort(c.key)}
                  className={c.key === 'index' ? 'num' : ''}
                >
                  {c.label}
                  {sortKey === c.key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r) => (
              <tr key={r.id} className={issues.has(r.index) ? 'row-issue' : ''}>
                <td>
                  {tr(r.name, lang)}
                  {issues.has(r.index) && (
                    <span
                      className="issue-flag"
                      title={issues
                        .get(r.index)
                        .map((k) => t.reasons[k])
                        .join(' · ')}
                    >
                      ⚠
                    </span>
                  )}
                </td>
                <td>{tr(r.category, lang)}</td>
                <td>
                  <span className={'lvl ' + r.levelId}>{tr(r.level, lang)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="empty">{t.loading}</div>}
        {!loading && filtered.length === 0 && <div className="empty">{t.noMatch}</div>}
      </section>

      <div className="pagination">
        <button
          className="pg-btn"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          ←
        </button>
        <span className="pg-info">
          {t.pagination.page} <b>{currentPage + 1}</b> {t.pagination.of} {pageCount}
        </span>
        <button
          className="pg-btn"
          onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
          disabled={currentPage >= pageCount - 1}
          aria-label="Next page"
        >
          →
        </button>
        <span className="pg-spacer" />
        <span className="pg-meta">
          {PAGE_SIZE} {t.pagination.rows}
        </span>
        <span className="pg-meta">
          {filtered.length.toLocaleString('en-US')} {t.pagination.records}
        </span>
      </div>

      {pickerOpen && (
        <div className="modal-overlay" onClick={() => setPickerOpen(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={t.picker.title}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <h2>{t.picker.title}</h2>
                <p className="modal-hint">
                  {t.picker.hint}{' '}
                  <span className="pool-tag">
                    {pickerPool === 'filtered' ? t.picker.poolFiltered : t.picker.poolAll}
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="modal-x"
                onClick={() => setPickerOpen(false)}
                aria-label={t.picker.cancel}
              >
                ×
              </button>
            </div>

            <div className="picker-list">
              {pickerItems.map((r, i) => (
                <button
                  type="button"
                  key={r.id}
                  className={'picker-item' + (pickerSel === i ? ' selected' : '')}
                  onClick={() => setPickerSel(i)}
                  aria-pressed={pickerSel === i}
                >
                  <span className="pi-num">{i + 1}</span>
                  <span className="pi-main">
                    <span className="pi-en">{tr(r.name, lang)}</span>
                    {secondary(r.name) && <span className="pi-vi">{secondary(r.name)}</span>}
                  </span>
                  <span className="pi-meta">
                    <span className="pi-cat">{tr(r.category, lang)}</span>
                    <span className={'lvl ' + r.levelId}>{tr(r.level, lang)}</span>
                  </span>
                </button>
              ))}
            </div>

            <div className="modal-foot">
              <button type="button" className="btn-ghost" onClick={reshuffle}>
                <span className="dice" aria-hidden="true">🎲</span>
                {t.picker.reshuffle}
              </button>
              <div className="foot-right">
                <button type="button" className="btn-ghost" onClick={() => setPickerOpen(false)}>
                  {t.picker.cancel}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={confirmPick}
                  disabled={pickerSel === null}
                >
                  {t.picker.confirm}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ value, label, tone }) {
  const display = typeof value === 'number' ? value.toLocaleString('en-US') : value
  return (
    <div className="stat">
      <b className={tone ? 'tone-' + tone : ''}>{display}</b>
      <span>{label}</span>
    </div>
  )
}
