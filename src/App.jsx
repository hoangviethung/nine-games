import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const LEVEL_ORDER = { Easy: 0, Medium: 1, Hard: 2 }

export default function App() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [query, setQuery] = useState('')
  const [activeCat, setActiveCat] = useState(null)
  const [activeLvl, setActiveLvl] = useState(null)
  const [sortKey, setSortKey] = useState('index')
  const [sortDir, setSortDir] = useState(1)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('keywords')
        .select(
          'id, name, vietnamese, keyword_categories(id, name, vietnamese), keyword_levels(name, vietnamese, sort_order)'
        )

      if (error) {
        setError(error.message)
      } else {
        const mapped = data.map((r) => ({
          english: r.name,
          vietnamese: r.vietnamese,
          categoryId: r.keyword_categories?.id ?? 0,
          category: r.keyword_categories?.name ?? '',
          categoryVi: r.keyword_categories?.vietnamese ?? '',
          level: r.keyword_levels?.name ?? '',
          levelVi: r.keyword_levels?.vietnamese ?? '',
          levelOrder: r.keyword_levels?.sort_order ?? 9,
        }))
        // Default order: grouped by category, then Easy → Hard, then A→Z
        mapped.sort(
          (a, b) =>
            a.categoryId - b.categoryId ||
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = rows.filter(
      (r) =>
        (!activeCat || r.category === activeCat) &&
        (!activeLvl || r.level === activeLvl) &&
        (!q ||
          r.english.toLowerCase().includes(q) ||
          r.vietnamese.toLowerCase().includes(q))
    )
    list = [...list].sort((a, b) => {
      let x = a[sortKey]
      let y = b[sortKey]
      if (sortKey === 'level') { x = LEVEL_ORDER[x] ?? 9; y = LEVEL_ORDER[y] ?? 9 }
      if (x > y) return sortDir
      if (x < y) return -sortDir
      return 0
    })
    return list
  }, [rows, query, activeCat, activeLvl, sortKey, sortDir])

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => -d)
    else { setSortKey(key); setSortDir(1) }
  }

  const cols = [
    { key: 'index', label: '#' },
    { key: 'english', label: 'English' },
    { key: 'vietnamese', label: 'Tiếng Việt' },
    { key: 'category', label: 'Category' },
    { key: 'level', label: 'Level' },
  ]

  return (
    <div className="page">
      <header>
        <h1>Nine Games — Keywords</h1>
        <p className="sub">
          Charades &amp; guessing keywords · live from Supabase
        </p>
      </header>

      {error && <div className="error">Could not load data: {error}</div>}

      <section className="stats">
        <Stat value={rows.length} label="total keywords" />
        <Stat value={categories.length} label="categories" />
        <Stat value={levelCounts.Easy} label="easy" tone="easy" />
        <Stat value={levelCounts.Medium} label="medium" tone="medium" />
        <Stat value={levelCounts.Hard} label="hard" tone="hard" />
        <Stat value={filtered.length} label="shown" />
      </section>

      <section className="controls">
        <input
          type="search"
          placeholder="Search English / Tiếng Việt…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="chips">
          {categories.map((c) => (
            <button
              key={c.name}
              className={'chip' + (activeCat === c.name ? ' on' : '')}
              onClick={() => setActiveCat(activeCat === c.name ? null : c.name)}
              title={c.vi}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="chips">
          {levels.map((l) => (
            <button
              key={l.name}
              className={'chip lvl-chip ' + l.name + (activeLvl === l.name ? ' on' : '')}
              onClick={() => setActiveLvl(activeLvl === l.name ? null : l.name)}
              title={l.vi}
            >
              {l.name}
            </button>
          ))}
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
            {filtered.map((r) => (
              <tr key={r.index}>
                <td className="num">{r.index}</td>
                <td>{r.english}</td>
                <td>{r.vietnamese}</td>
                <td>
                  {r.category}
                  <span className="muted"> · {r.categoryVi}</span>
                </td>
                <td>
                  <span className={'lvl ' + r.level}>{r.level}</span>
                  <span className="muted"> {r.levelVi}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="empty">Loading keywords…</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty">No keywords match the current filters.</div>
        )}
      </section>
    </div>
  )
}

function Stat({ value, label, tone }) {
  return (
    <div className="stat">
      <b className={tone ? 'tone-' + tone : ''}>{value}</b>
      <span>{label}</span>
    </div>
  )
}
