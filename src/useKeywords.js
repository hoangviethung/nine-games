import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Loads every keyword from Supabase (paging past PostgREST's 1000-row cap)
// and returns them in a flat, display-ready shape. Shared by the player
// homepage and the admin table.
//
// `name`, `category` and `level` are jsonb i18n values shaped
// {"en": "Cat", "vi": "Mèo", ...}. Read them with tr(value, lang) from i18n.js
// rather than indexing a language directly, so missing translations fall back
// to English the same way the database's i18n_text() does.
export function useKeywords() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const CHUNK = 1000
      const select =
        'id, name, keyword_categories(id, name, sort_order), keyword_levels(id, name, sort_order)'
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
      if (cancelled) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        const mapped = all.map((r) => ({
          id: r.id,
          name: r.name ?? {},
          categoryId: r.keyword_categories?.id ?? '',
          category: r.keyword_categories?.name ?? {},
          categoryOrder: r.keyword_categories?.sort_order ?? 999,
          levelId: r.keyword_levels?.id ?? '',
          level: r.keyword_levels?.name ?? {},
          levelOrder: r.keyword_levels?.sort_order ?? 9,
        }))
        // Default order: grouped by category, then Easy → Hard, then A→Z (English)
        mapped.sort(
          (a, b) =>
            a.categoryOrder - b.categoryOrder ||
            a.levelOrder - b.levelOrder ||
            (a.name.en || '').localeCompare(b.name.en || '')
        )
        mapped.forEach((r, i) => {
          r.index = i + 1
        })
        setRows(mapped)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return { rows, loading, error }
}
