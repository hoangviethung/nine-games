# Nine Games — Keywords

A React + Vite app that displays the bilingual (English / Tiếng Việt) board-game
keyword deck, served live from Supabase. Browse, search, and filter keywords by
category and difficulty — the same view used to prototype the game content.

## Stack

- [Vite](https://vitejs.dev/) + React 18
- [Supabase JS](https://supabase.com/docs/reference/javascript) (read-only, publishable key)

## Data

Three tables in the `nine-games` Supabase project:

- `keywords` — one row per guessable word (`english`, `vietnamese`, FKs to category & level)
- `keyword_categories` — 10 fixed categories (`name`, `vietnamese`)
- `keyword_levels` — Easy / Medium / Hard (`name`, `vietnamese`, `sort_order`)

Row Level Security allows public read access; writes require the service role.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase URL + publishable key
npm run dev
```

The app runs at http://localhost:5180.

## Environment variables

| Variable | Description |
| --- | --- |
| `VITE_SUPABASE_URL` | Your project URL, e.g. `https://xxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The `sb_publishable_...` key (safe for the browser) |
