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
    if (error.code === '23505') throw new Error('Ese nombre de usuario ya está ocupado.')
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

export async function saveCollection(userId: string, state: CollectionState) {
  const { error } = await client()
    .from('collections')
    .upsert({ user_id: userId, data: state, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function setCollectionPublic(userId: string, isPublic: boolean) {
  const { error } = await client().from('collections').update({ is_public: isPublic }).eq('user_id', userId)
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
