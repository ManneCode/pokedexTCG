// Cliente de Supabase y acceso a perfiles y colecciones (ver supabase/schema.sql).
import { createClient } from '@supabase/supabase-js'
import type { CollectionState } from './store'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** null cuando no hay variables de entorno: la app funciona solo en modo local. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null

export type Profile = { id: string; username: string }

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/

/** Mínimo de Supabase por defecto (Authentication → Providers → Email). */
export const MIN_PASSWORD = 6

function client() {
  if (!supabase) throw new Error('Supabase no está configurado')
  return supabase
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await client().from('profiles').select('id, username').eq('id', userId).maybeSingle()
  if (error) throw error
  return data
}

export async function createProfile(userId: string, username: string): Promise<Profile> {
  const { data, error } = await client()
    .from('profiles')
    .insert({ id: userId, username })
    .select('id, username')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error('error.username_taken')
    throw error
  }
  return data
}

export type CloudCollection = { state: CollectionState; isPublic: boolean; updatedAt: string }

export async function loadCollection(userId: string): Promise<CloudCollection | null> {
  const { data, error } = await client()
    .from('collections')
    .select('data, is_public, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data && { state: data.data, isPublic: data.is_public, updatedAt: data.updated_at }
}

export type CollectionSummary = { with_card: number; total_cards: number; value_usd: number }

/** false si la base todavía no tiene las columnas de 003_explore.sql: guardamos sin resumen. */
let summaryColumns = true

export async function saveCollection(userId: string, state: CollectionState, summary?: CollectionSummary) {
  const row = { user_id: userId, data: state, updated_at: new Date().toISOString() }
  if (summary && summaryColumns) {
    const { error } = await client()
      .from('collections')
      .upsert({ ...row, ...summary })
    if (!error) return
    // PGRST204: columna desconocida (falta correr 003_explore.sql).
    if (error.code !== 'PGRST204') throw error
    summaryColumns = false
  }
  const { error } = await client().from('collections').upsert(row)
  if (error) throw error
}

export type CollectorRow = {
  username: string
  withCard: number
  totalCards: number
  valueUsd: number
  updatedAt: string
}

export type CollectorSort = 'with_card' | 'value_usd' | 'total_cards' | 'updated_at'

/** Colecciones públicas para Explorar, ordenadas por el criterio elegido. */
export async function listCollectors(sort: CollectorSort, search = '', limit = 60): Promise<CollectorRow[]> {
  let query = client()
    .from('collections')
    .select('with_card, total_cards, value_usd, updated_at, profiles!inner(username)')
    .eq('is_public', true)
    .gt('total_cards', 0)
    .order(sort, { ascending: false })
    .limit(limit)
  const q = search
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
  if (q) query = query.ilike('profiles.username', `%${q}%`)
  const { data, error } = await query
  if (error) throw error
  type Row = {
    with_card: number
    total_cards: number
    value_usd: number
    updated_at: string
    profiles: { username: string } | { username: string }[]
  }
  return ((data ?? []) as Row[]).map((r) => ({
    username: Array.isArray(r.profiles) ? r.profiles[0]?.username : r.profiles.username,
    withCard: r.with_card,
    totalCards: r.total_cards,
    valueUsd: Number(r.value_usd),
    updatedAt: r.updated_at,
  }))
}

export async function setCollectionPublic(userId: string, isPublic: boolean) {
  const { error } = await client().from('collections').update({ is_public: isPublic }).eq('user_id', userId)
  if (error) throw error
}

export type FeedbackKind = 'suggestion' | 'bug' | 'other'

/** Guarda un mensaje del buzón (tabla feedback, ver supabase/002_feedback.sql). */
export async function sendFeedback(input: { kind: FeedbackKind; message: string; contact?: string }) {
  const { error } = await client()
    .from('feedback')
    .insert({
      kind: input.kind,
      message: input.message,
      contact: input.contact || null,
      page: window.location.pathname.slice(0, 300),
      user_agent: navigator.userAgent.slice(0, 400),
    })
  if (error) throw error
}

export type PublicCollection =
  | { status: 'ok'; profile: Profile; state: CollectionState; updatedAt: string }
  | { status: 'not-found' }
  | { status: 'private' }

/** Colección de otro usuario por su nombre, para la página /u/<username>. */
export async function loadPublicCollection(username: string): Promise<PublicCollection> {
  const { data: profile, error } = await client()
    .from('profiles')
    .select('id, username')
    .eq('username', username.toLowerCase())
    .maybeSingle()
  if (error) throw error
  if (!profile) return { status: 'not-found' }
  const { data, error: err2 } = await client()
    .from('collections')
    .select('data, updated_at, is_public')
    .eq('user_id', profile.id)
    .maybeSingle()
  if (err2) throw err2
  // Con RLS, una colección privada de otra persona no regresa filas (igual que una que no existe).
  if (!data) return { status: 'private' }
  return { status: 'ok', profile, state: data.data, updatedAt: data.updated_at }
}
