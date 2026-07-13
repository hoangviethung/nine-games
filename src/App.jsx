import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'
import { translations } from './i18n'

const LEVEL_ORDER = { Easy: 0, Medium: 1, Hard: 2 }
const PAGE_SIZE = 100

export default function App() {
  const [lang, setLang] = useState(
    () => localStorage.getItem('lang') || 'en'
  )
  const t = translations[lang] || translations.en

  useEffect(() => {
    localStorage.setItem('lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState(null)
  const [activeLvl, setActiveLvl] = useState(null)
  const [sortKey, setSortKey] = useState('index')
  const [sortDir, setSortDir] = useState(1)
  const [page, setPage] = useState(0)
  const [showIssuesOnly, setShowIssuesOnly] = useState(false)

  // Random keyword picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerItems, setPickerItems] = useState([])
  const [pickerSel, setPickerSel] = useState(null)
  const [pickerPool, setPickerPool] = useState('all')
  // Played keywords accumulate (by unique English name) and persist across reloads
  const [playedNames, setPlayedNames] = useState(() => {
    try {
      const a = JSON.parse(localStorage.getItem('playedKeywords') || '[]')
      return Array.isArray(a) ? a : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    localStorage.setItem('playedKeywords', JSON.stringify(playedNames))
  }, [playedNames])

  useEffect(() => {
    async function load() {
      setLoading(true)
      // PostgREST returns at most 1000 rows per request, so page through all of them.
      const CHUNK = 1000
      const select =
        'id, name, vietnamese, keyword_categories(id, name, vietnamese, sort_order), keyword_levels(name, vietnamese, sort_order)'
      let all = []
      let from = 0
      let fetchError = null
      for (;;) {
        const { data, error } = await supabase
          .from('keywords')
          .select(select)
          .order('id', { ascending: true })
          .range(from, from + CHUNK - 1)
        if (error) {
          fetchError = error
          break
        }
        all = all.concat(data)
        if (data.length < CHUNK) break
        from += CHUNK
      }

      if (fetchError) {
        setError(fetchError.message)
      } else {
        const mapped = all.map((r) => ({
          english: r.name,
          vietnamese: r.vietnamese,
          categoryId: r.keyword_categories?.id ?? '',
          categoryOrder: r.keyword_categories?.sort_order ?? 999,
          category: r.keyword_categories?.name ?? '',
          categoryVi: r.keyword_categories?.vietnamese ?? '',
          level: r.keyword_levels?.name ?? '',
          levelVi: r.keyword_levels?.vietnamese ?? '',
          levelOrder: r.keyword_levels?.sort_order ?? 9,
        }))
        // Default order: grouped by category, then Easy → Hard, then A→Z
        mapped.sort(
          (a, b) =>
            a.categoryOrder - b.categoryOrder ||
            a.levelOrder - b.levelOrder ||
            a.english.localeCompare(b.english)
        )
        mapped.forEach((r, i) => { r.index = i + 1 })
        setRows(mapped)
      }
      setLoading(false)
    }
    load()
  }, [])

  const categories = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => { if (!seen.has(r.category)) seen.set(r.category, r.categoryVi) })
    return [...seen.entries()].map(([name, vi]) => ({ name, vi }))
  }, [rows])

  const levels = useMemo(() => {
    const seen = new Map()
    rows.forEach((r) => { if (!seen.has(r.level)) seen.set(r.level, r.levelVi) })
    return [...seen.entries()]
      .map(([name, vi]) => ({ name, vi }))
      .sort((a, b) => (LEVEL_ORDER[a.name] ?? 9) - (LEVEL_ORDER[b.name] ?? 9))
  }, [rows])

  const levelCounts = useMemo(() => {
    const c = { Easy: 0, Medium: 0, Hard: 0 }
    rows.forEach((r) => { if (r.level in c) c[r.level]++ })
    return c
  }, [rows])

  // Data-quality scan: flag duplicate (case-insensitive) or blank keywords.
  // Returns a Map of row index -> human-readable reason for the problem.
  const issues = useMemo(() => {
    const enCount = new Map()
    const viCount = new Map()
    for (const r of rows) {
      const en = r.english.trim().toLowerCase()
      const vi = r.vietnamese.trim().toLowerCase()
      if (en) enCount.set(en, (enCount.get(en) || 0) + 1)
      if (vi) viCount.set(vi, (viCount.get(vi) || 0) + 1)
    }
    const byIndex = new Map()
    for (const r of rows) {
      const en = r.english.trim()
      const vi = r.vietnamese.trim()
      const reasons = []
      if (!en || !vi) reasons.push('missing')
      if (en && enCount.get(en.toLowerCase()) > 1) reasons.push('dupEn')
      if (vi && viCount.get(vi.toLowerCase()) > 1) reasons.push('dupVi')
      if (reasons.length) byIndex.set(r.index, reasons)
    }
    return byIndex
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(
      (r) =>
        (!activeCat || r.category === activeCat) &&
        (!activeLvl || r.level === activeLvl) &&
        (!showIssuesOnly || issues.has(r.index)) &&
        (!q ||
          r.english.toLowerCase().includes(q) ||
          r.vietnamese.toLowerCase().includes(q))
    )
    const sortVal = (r) => {
      switch (sortKey) {
        case 'keyword':
          return lang === 'vi' ? r.vietnamese : r.english
        case 'category':
          return lang === 'vi' ? r.categoryVi : r.category
        case 'level':
          return LEVEL_ORDER[r.level] ?? 9
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
          : String(x).localeCompare(String(y), lang === 'vi' ? 'vi' : 'en')
      return cmp * sortDir
    })
    return list
  }, [rows, query, activeCat, activeLvl, showIssuesOnly, issues, sortKey, sortDir, lang])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount - 1)
  const paged = useMemo(
    () =>
      filtered.slice(
        currentPage * PAGE_SIZE,
        currentPage * PAGE_SIZE + PAGE_SIZE
      ),
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
    else { setSortKey(key); setSortDir(1) }
  }

  // Draw 5 distinct random rows from a pool
  function drawFive(pool) {
    if (pool.length <= 5) return [...pool]
    const idx = new Set()
    while (idx.size < 5) idx.add(Math.floor(Math.random() * pool.length))
    return [...idx].map((i) => pool[i])
  }

  // Played keywords, resolved back to full rows in play order (persisted by name)
  const rowsByName = useMemo(() => {
    const m = new Map()
    rows.forEach((r) => m.set(r.english, r))
    return m
  }, [rows])
  const played = useMemo(
    () => playedNames.map((n) => rowsByName.get(n)).filter(Boolean),
    [playedNames, rowsByName]
  )
  const playedSet = useMemo(() => new Set(playedNames), [playedNames])

  // The pool respects the active filters when they narrow things down,
  // otherwise it's the whole deck — and always excludes already-played keywords.
  const usingFilter =
    Boolean(query.trim() || activeCat || activeLvl || showIssuesOnly) &&
    filtered.length >= 1
  const pickPool = (usingFilter ? filtered : rows).filter(
    (r) => !playedSet.has(r.english)
  )

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
    setPlayedNames((prev) =>
      prev.includes(chosen.english) ? prev : [...prev, chosen.english]
    )
    setPickerOpen(false)
  }
  function removePlayed(name) {
    setPlayedNames((prev) => prev.filter((n) => n !== name))
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

  return (
    <div className="page">
      <header className="app-header">
        <div>
          <h1>Nine Games — Keywords</h1>
          <p className="sub">{t.subtitle}</p>
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
            <button
              type="button"
              className="played-clear"
              onClick={() => setPlayedNames([])}
            >
              {t.picker.clearAll}
            </button>
          </div>
          <div className="played-list">
            {played.map((r) => (
              <div className="played-item" key={r.english}>
                <span className="pl-kw">
                  {r.english} <span className="pl-vi">· {r.vietnamese}</span>
                </span>
                <span className="pl-meta">
                  {lang === 'vi' ? r.categoryVi : r.category}
                  <span className={'lvl ' + r.level}>
                    {t.levels[r.level] || r.level}
                  </span>
                </span>
                <button
                  type="button"
                  className="pl-del"
                  onClick={() => removePlayed(r.english)}
                  aria-label={`${t.picker.remove}: ${r.english}`}
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
        <Stat value={levelCounts.Easy} label={t.stats.easy} tone="easy" />
        <Stat value={levelCounts.Medium} label={t.stats.medium} tone="medium" />
        <Stat value={levelCounts.Hard} label={t.stats.hard} tone="hard" />
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
          <b className={issues.size ? 'tone-hard' : 'tone-easy'}>
            {issues.size}
          </b>
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
            <button
              className={'chip' + (lang === 'en' ? ' on' : '')}
              onClick={() => setLang('en')}
            >
              English
            </button>
            <button
              className={'chip' + (lang === 'vi' ? ' on' : '')}
              onClick={() => setLang('vi')}
            >
              Tiếng Việt
            </button>
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">{t.category}</label>
          <div className="chips">
            {categories.map((c) => (
              <button
                key={c.name}
                className={'chip' + (activeCat === c.name ? ' on' : '')}
                onClick={() => setActiveCat(activeCat === c.name ? null : c.name)}
                title={lang === 'vi' ? c.name : c.vi}
              >
                {lang === 'vi' ? c.vi : c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <label className="control-label">{t.level}</label>
          <div className="chips">
            {levels.map((l) => (
              <button
                key={l.name}
                className={
                  'chip lvl-chip ' + l.name + (activeLvl === l.name ? ' on' : '')
                }
                onClick={() => setActiveLvl(activeLvl === l.name ? null : l.name)}
                title={l.vi}
              >
                {t.levels[l.name] || l.name}
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
              <tr key={r.index} className={issues.has(r.index) ? 'row-issue' : ''}>
                <td>
                  {lang === 'vi' ? r.vietnamese : r.english}
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
                <td>{lang === 'vi' ? r.categoryVi : r.category}</td>
                <td>
                  <span className={'lvl ' + r.level}>
                    {t.levels[r.level] || r.level}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="empty">{t.loading}</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty">{t.noMatch}</div>
        )}
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
          {t.pagination.page} <b>{currentPage + 1}</b> {t.pagination.of}{' '}
          {pageCount}
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
                    {pickerPool === 'filtered'
                      ? t.picker.poolFiltered
                      : t.picker.poolAll}
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
                  key={r.index}
                  className={'picker-item' + (pickerSel === i ? ' selected' : '')}
                  onClick={() => setPickerSel(i)}
                  aria-pressed={pickerSel === i}
                >
                  <span className="pi-num">{i + 1}</span>
                  <span className="pi-main">
                    <span className="pi-en">{r.english}</span>
                    <span className="pi-vi">{r.vietnamese}</span>
                  </span>
                  <span className="pi-meta">
                    <span className="pi-cat">
                      {lang === 'vi' ? r.categoryVi : r.category}
                    </span>
                    <span className={'lvl ' + r.level}>
                      {t.levels[r.level] || r.level}
                    </span>
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
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setPickerOpen(false)}
                >
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
  const display =
    typeof value === 'number' ? value.toLocaleString('en-US') : value
  return (
    <div className="stat">
      <b className={tone ? 'tone-' + tone : ''}>{display}</b>
      <span>{label}</span>
    </div>
  )
}
