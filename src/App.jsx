import { useEffect, useMemo, useState } from 'react'
import { useKeywords } from './useKeywords'
import { translations, LOCALES, LANGS, PRIMARY, tr } from './i18n'

const PAGE_SIZE = 100

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

  const cols = [
    { key: 'keyword', label: t.cols.keyword },
    { key: 'category', label: t.cols.category },
    { key: 'level', label: t.cols.level },
  ]

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
      </header>

      {error && (
        <div className="error">
          {t.errorPrefix} {error}
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
