import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Loads every keyword from Supabase (paging past PostgREST's 1000-row cap)
// and returns them in a flat, display-ready shape. Shared by the player
// homepage and the admin table.
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
      if (cancelled) return
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setRows(
          all.map((r) => ({
            english: r.name,
            vietnamese: r.vietnamese,
            category: r.keyword_categories?.name ?? '',
            categoryVi: r.keyword_categories?.vietnamese ?? '',
            level: r.keyword_levels?.name ?? '',
            levelVi: r.keyword_levels?.vietnamese ?? '',
          }))
        )
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
