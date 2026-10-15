# Publicar Pokédex TCG

La página se publica en **Vercel** y guarda las cuentas y colecciones en **Supabase**. Los dos son gratis para este tamaño. Son unos 15 minutos y solo se hace una vez.

## 1. Supabase (base de datos y login)

1. Crea una cuenta en https://supabase.com y un proyecto nuevo (región: la más cercana, p. ej. `East US`). Guarda la contraseña de la base de datos en un lugar seguro.
2. Ve a **SQL Editor → New query**, pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**. Repite con [`supabase/002_feedback.sql`](supabase/002_feedback.sql) (el buzón de sugerencias).
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

   La llave `anon` es pública por diseño: las reglas del esquema (RLS) son las que impiden que alguien edite colecciones ajenas. **Nunca** uses la llave `service_role` en la página.
4. Para probar en tu compu, copia `.env.example` como `.env.local`, pega esos dos valores y reinicia `npm run dev`.

### Login con correo y contraseña

Ya viene activado (**Authentication → Sign In / Providers → Email**). Dos ajustes recomendados ahí mismo:

- **Confirm email**: si está prendido, al crear cuenta Supabase manda un correo para confirmarla. El servidor de correo gratuito de Supabase solo envía **unos pocos correos por hora**, así que con varios amigos registrándose a la vez algunos tendrían que esperar. Puedes apagarlo para que entren directo, o configurar un SMTP propio (por ejemplo Resend, que es gratis) en **Authentication → Emails → SMTP Settings**.
- **Minimum password length**: la app pide al menos 6 caracteres, igual que el valor por defecto de Supabase. Si lo cambias, cambia también `MIN_PASSWORD` en `src/lib/supabase.ts`.

"Olvidé mi contraseña" manda un correo con un link. Al abrirlo, la página pide la contraseña nueva.

## 2. GitHub

Sube el proyecto a un repositorio (puede ser privado). `.env.local` no se sube porque está en `.gitignore`.

## 3. Vercel (la página)

1. Entra a https://vercel.com con tu cuenta de GitHub y elige **Add New → Project**. Importa el repositorio.
2. Vercel detecta Vite solo. En **Environment Variables** agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los valores del paso 1.
3. Dale **Deploy**. Te da una dirección como `https://pokedex-tcg.vercel.app`. Desde ahí, cada push a `main` se publica solo.

`vercel.json` ya hace que los links `/u/usuario` abran la app.

## 4. Conecta Supabase con tu dominio

En Supabase, **Authentication → URL Configuration**:

- **Site URL**: tu dirección de Vercel, p. ej. `https://pokedex-tcg.vercel.app`
- **Redirect URLs**: agrega esa misma dirección y `http://localhost:5173` (para desarrollo).

Sin esto, los links de confirmación y de recuperar contraseña te regresarían a una página equivocada.

## Listo

- Entra a tu página, **Iniciar sesión → Crea una**, y elige tu usuario. Lo que tenías en ese navegador se sube a tu cuenta.
- **Compartir** te da el link `https://…/u/tu-usuario`. Tus amigos lo ven sin cuenta y, si quieren la suya, le dan **Arma la tuya**.
- En **Compartir** puedes hacer tu colección privada.

## Buzón de sugerencias

Los mensajes del botón **Sugerencias y bugs** se guardan en la tabla `feedback`. Léelos en **Table Editor → feedback**. Desde la página nadie puede leerlos, solo enviarlos.
