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

**Única excepción (09/11/2026):** `20261104142607_schedule_push_delivery.sql` se editó después de aplicarse porque llevaba escrita la URL del
proyecto de producción: en un proyecto de desarrollo el job del push llamaba a producción. La URL ahora sale de Vault (ver
más abajo) y `20261109200000_push_job_url_from_vault.sql` actualiza el job en los proyectos donde ya existía. La edición no cambia el esquema,
solo evita que un proyecto nuevo nazca apuntando a otro entorno. `tests/unit/push-job-migration.test.ts` y `tests/unit/no-production-urls.test.ts`
impiden que vuelva a pasar.

## Entornos

Estas migraciones se aplican a más de un proyecto de Supabase: `cale-api` (producción) y `cale-dev` (desarrollo). **Nada en una migración ni en
una Edge Function puede llevar escrito un dominio o un proyecto de un entorno**: lo que cambia entre entornos es configuración (secretos de las
funciones y secretos de Vault), no código. Antes de correr `supabase db push` o `supabase secrets set` hay que comprobar a qué proyecto apunta
la CLI (`supabase/.temp/project-ref`, que recuerda el último proyecto vinculado) y pasar siempre `--project-ref`.

### Secretos de Vault que exige cada proyecto

Se cargan **antes** de aplicar las migraciones del job del push; sin ellos la migración falla a propósito (`configure_cale_push_job_secret_first`
o `configure_cale_functions_base_url_first`), para que el job nunca apunte a otro entorno.

| Secreto de Vault | Valor | Debe coincidir con |
|------------------|-------|--------------------|
| `cale_push_job_secret` | clave aleatoria de 32 caracteres o más | el secreto `PUSH_JOB_SECRET` de las Edge Functions del mismo proyecto |
| `cale_functions_base_url` | `https://<ref>.supabase.co/functions/v1` del mismo proyecto, sin barra final | — |

Para dar de alta un proyecto nuevo o corregir uno existente: cargar los dos secretos, aplicar las migraciones y comprobar que el comando del job
(`select command from cron.job where jobname = 'cale-push-delivery'`) lee la URL de Vault y no lleva ningún dominio escrito.

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

## Permisos: el local no es igual a producción

El Supabase actual de producción **no da ningún permiso de datos por defecto** a `anon`, `authenticated` ni `service_role` sobre las
tablas nuevas de `public` (solo TRUNCATE, REFERENCES, TRIGGER y MAINTAIN), y las funciones no se pueden ejecutar sin un `GRANT`. El
stack local de la CLI concede todo. Resultado: un objeto sin `GRANT` explícito pasa los tests locales y falla con `permission denied`
solo en producción (pasó con `whatsapp_connections` y `reminder_deliveries`, que quedaron sin permisos para el servidor).

Para que no se repita:

- **Toda tabla o función nueva lleva sus `GRANT` explícitos** en la migración que la crea, para cada rol que la use. No se depende de los
  permisos por defecto.
- **`npm run db:reset:parity`** reinicia la base LOCAL con los permisos por defecto de producción (vacía `public`, fija los permisos por
  defecto, carga los secretos de Vault de mentira del job del push, aplica todas las migraciones y desprograma los jobs, que en local no
  tienen a quién llamar). Usarlo en vez de
  `supabase db reset` antes de correr los tests de base.
- **`supabase/privileges.json`** es el manifiesto de permisos esperados (por tabla, vista y función). `tests/db/privileges.test.ts`
  comprueba que la base local tenga los permisos por defecto de producción y que todo coincida con el manifiesto; si no pasan, el
  mensaje dice qué hacer. Al cambiar permisos en una migración: `npm run check:privileges -- --update`, revisar el `git diff` del
  manifiesto y commitearlo junto con la migración.
- **`SUPABASE_PROJECT_REF=<ref> npm run check:privileges -- --remote`** compara producción con el manifiesto, solo en lectura. Los objetos
  del manifiesto que todavía no existen en producción (migración sin aplicar) se informan sin fallar; cualquier otra diferencia falla.
  Correrlo antes y después de cada `db push`.

## Qué usa `cale-api` de acá

Las Edge Functions de `cale-api` leen tablas definidas en estas migraciones (por ejemplo `whatsapp_connections` y `reminder_deliveries`).
Cuando una función necesite una tabla o columna nueva, la migración se escribe acá y la función se despliega después desde `cale-api`.
