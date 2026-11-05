# Migraciones de Supabase

**Este repo es la única fuente de verdad de las migraciones.** `supabase/migrations/` define todo el esquema del proyecto de Supabase
de Cale (tablas, seguridad por filas y funciones), también lo que usa `cale-api`.

## Quién es dueño de qué

| Repo | Responsabilidad |
|------|-----------------|
| `cale-reservas` (este) | La app de reservas y su panel, y **todas las migraciones** de Supabase. |
| `cale-api` (privado) | Solo Edge Functions e integraciones con Meta. **No tiene migraciones ni SQL de esquema** (un test lo controla). |

Los dos repos comparten un único proyecto de Supabase y, por lo tanto, **un único historial de migraciones**
(`supabase_migrations.schema_migrations`). Dividir las migraciones en dos repos descuadra ese historial.

## Cómo se cambia el esquema

1. Escribir la migración en `supabase/migrations/<14 dígitos>_<nombre_en_minúsculas>.sql` (la versión es la fecha y hora: `YYYYMMDDHHMMSS`).
2. Probarla contra el Supabase local y con los tests de `tests/db/`.
3. Correr `npm run check:migrations` (archivos bien formados, sin versiones ni nombres repetidos).
4. Aplicarla al proyecto remoto **solo con aprobación explícita**, con `supabase db push` desde este repo.
5. Correr `npm run check:migrations -- --remote` y comprobar que el historial remoto coincide con los archivos.

**No aplicar cambios de esquema por otro camino** (el panel de Supabase o `apply_migration` del MCP): dejan una migración registrada en
el remoto sin archivo acá, que es exactamente el descuadre que este control detecta.

**Una migración ya aplicada no se edita.** Un cambio nuevo es una migración nueva.

## Verificación

```bash
npm run check:migrations                 # solo archivos locales
SUPABASE_PROJECT_REF=<ref> npm run check:migrations -- --remote   # además, contra el historial del remoto
```

- `--remote` solo lee (`supabase db query --linked`), necesita la CLI de Supabase con sesión iniciada y el ref del proyecto en
  `SUPABASE_PROJECT_REF` (no se guarda en el repo).
- Falla (código 1) si hay: un archivo que no es una migración, una versión o un nombre repetidos, una migración aplicada en el remoto sin
  archivo acá, o la misma versión con otro nombre.
- Una migración con archivo y sin aplicar se informa, pero no es un error: es lo normal antes de un `db push`.
- La lógica está en `scripts/migrations-check.ts` y la prueban `tests/unit/migrations-check.test.ts` (que además controla las migraciones reales del repo).

Correr `--remote` antes de cada `db push` y después de él.

## Qué usa `cale-api` de acá

Las Edge Functions de `cale-api` leen tablas definidas en estas migraciones (por ejemplo `whatsapp_connections` y `reminder_deliveries`).
Cuando una función necesite una tabla o columna nueva, la migración se escribe acá y la función se despliega después desde `cale-api`.
