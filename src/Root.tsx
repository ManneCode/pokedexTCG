// Rutas: "/" es tu Pokédex (local o en la nube) y "/u/<usuario>" la de alguien más, solo lectura.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useAuth } from './lib/auth'
import { CollectionProvider, loadLocalCollection, type CollectionState } from './lib/store'
import {
  USERNAME_RE,
  loadCollection,
  loadPublicCollection,
  saveCollection,
  setCollectionPublic,
  type Profile,
  type PublicCollection,
} from './lib/supabase'
import App, { type SaveStatus } from './App'

export default function Root() {
  const match = window.location.pathname.match(/^\/u\/([^/]+)\/?$/)
  return match ? <PublicPage username={decodeURIComponent(match[1])} /> : <HomePage />
}

function HomePage() {
  const { auth } = useAuth()
  switch (auth.status) {
    case 'disabled':
    case 'signed-out':
      return (
        <CollectionProvider>
          <App mode={{ kind: 'local' }} />
        </CollectionProvider>
      )
    case 'loading':
      return <Splash text="Cargando…" />
    case 'error':
      return <Splash text={auth.message} />
    case 'needs-profile':
      return <UsernameSetup />
    case 'ready':
      return <CloudDex key={auth.profile.id} profile={auth.profile} />
  }
}

/** Tu colección en la nube; la primera vez sube lo que tenías en este navegador. */
function CloudDex({ profile }: { profile: Profile }) {
  const [initial, setInitial] = useState<CollectionState | null>(null)
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const pending = useRef<CollectionState | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    loadCollection(profile.id)
      .then(async (cloud) => {
        if (cloud) {
          setIsPublic(cloud.isPublic)
          setInitial(cloud.state)
          return
        }
        const local = loadLocalCollection()
        await saveCollection(profile.id, local)
        setInitial(local)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar tu colección.'))
  }, [profile.id])

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    const state = pending.current
    if (!state) return
    pending.current = null
    setSaveStatus('saving')
    try {
      await saveCollection(profile.id, state)
      setSaveStatus(pending.current ? 'pending' : 'saved')
    } catch {
      pending.current ??= state
      setSaveStatus('error')
    }
  }, [profile.id])

  // Junta los cambios rápidos en un solo guardado.
  const onChange = useCallback(
    (state: CollectionState) => {
      pending.current = state
      setSaveStatus('pending')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, 800)
    },
    [flush],
  )

  // Guarda antes de cerrar o cambiar de pestaña.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void flush()
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [flush])

  async function togglePublic() {
    const next = !isPublic
    setIsPublic(next)
    try {
      await setCollectionPublic(profile.id, next)
    } catch {
      setIsPublic(!next)
    }
  }

  if (error) return <Splash text={error} />
  if (!initial) return <Splash text="Cargando tu colección…" />
  return (
    <CollectionProvider initial={initial} onChange={onChange}>
      <App mode={{ kind: 'cloud', profile, isPublic, onTogglePublic: togglePublic, saveStatus, onRetrySave: flush }} />
    </CollectionProvider>
  )
}

function PublicPage({ username }: { username: string }) {
  const { auth } = useAuth()
  const [result, setResult] = useState<PublicCollection | { status: 'error'; message: string } | null>(null)

  useEffect(() => {
    if (auth.status === 'disabled') return
    loadPublicCollection(username).then(setResult, (e) =>
      setResult({ status: 'error', message: e instanceof Error ? e.message : 'No se pudo cargar.' }),
    )
  }, [username, auth.status])

  if (auth.status === 'disabled') return <Splash text="Los perfiles públicos necesitan Supabase configurado." home />
  if (!result) return <Splash text={`Cargando la Pokédex de @${username}…`} />
  if (result.status === 'not-found') return <Splash text={`No existe el usuario @${username}.`} home />
  if (result.status === 'private') return <Splash text={`La colección de @${username} es privada.`} home />
  if (result.status === 'error') return <Splash text={result.message} home />
  const isMine = auth.status === 'ready' && auth.profile.id === result.profile.id
  return (
    <CollectionProvider initial={result.state} readOnly>
      <App mode={{ kind: 'public', profile: result.profile, updatedAt: result.updatedAt, isMine }} />
    </CollectionProvider>
  )
}

function UsernameSetup() {
  const { chooseUsername, signOut } = useAuth()
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const valid = USERNAME_RE.test(username)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await chooseUsername(username)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.')
      setBusy(false)
    }
  }

  return (
    <div className="splash">
      <form className="setup stack" onSubmit={submit}>
        <h1>Elige tu nombre de usuario</h1>
        <p className="hint">Así se verá el link que compartas con tus amigos.</p>
        <label htmlFor="setup-username" className="sr-only">
          Nombre de usuario
        </label>
        <div className="username-field">
          <span>{window.location.host}/u/</span>
          <input
            id="setup-username"
            autoFocus
            required
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={20}
            placeholder="ash_ketchum"
          />
        </div>
        <span className="hint">3 a 20 caracteres: letras minúsculas, números y guion bajo.</span>
        <button type="submit" disabled={!valid || busy}>
          {busy ? 'Guardando…' : 'Continuar'}
        </button>
        {error && <p className="error">{error}</p>}
        <button type="button" className="ghost" onClick={signOut}>
          Salir
        </button>
      </form>
    </div>
  )
}

function Splash({ text, home }: { text: string; home?: boolean }) {
  return (
    <div className="splash">
      <p>{text}</p>
      {home && <a href="/">Ir a mi Pokédex</a>}
    </div>
  )
}
