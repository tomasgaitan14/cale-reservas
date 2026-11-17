# Cale Reservas — handoff para continuar en Claude

Fecha del handoff: 2026-11-12

## División de responsabilidades

### Codex — Community Manager

Codex se encargará principalmente de:

- Crear publicaciones para Instagram, Reels, carruseles y otros canales.
- Proponer ideas, copys, títulos, llamados a la acción y hashtags.
- Mantener y organizar los materiales de `marketing/`.
- Preparar calendarios editoriales y adaptar contenidos a la marca Cale.

No usar Claude para reemplazar este trabajo de contenido salvo que sea necesario para una tarea técnica.

### Claude — desarrollo del producto

Claude se encargará de:

- Modificar el código de la aplicación.
- Corregir errores y hacer ajustes de UX/UI.
- Trabajar en frontend, Supabase, migraciones, Edge Functions y tests.
- Ejecutar validaciones, builds y revisiones técnicas.
- Preparar cambios para revisión, sin publicar ni hacer push sin autorización.

La carpeta completa del repositorio se abre en Claude porque necesita acceso al código. El trabajo de publicaciones queda principalmente dentro de `marketing/` y lo gestiona Codex.

## Carpeta que hay que abrir

Abrir exactamente esta carpeta como proyecto/workspace:

```text
/Users/tomasgaitan/projects-claude/personal/cale-reservas
```

No abrir solamente `app/`, `tests/` ni `supabase/`: Claude necesita la raíz para ver el frontend, migraciones, documentación, configuración y tests.

## Cómo continuar en Claude

1. Abrir Claude Code o Claude Desktop.
2. Elegir **Open folder / Abrir carpeta**.
3. Seleccionar:
   `/Users/tomasgaitan/projects-claude/personal/cale-reservas`
4. Antes de pedir cambios, indicarle que lea estos archivos en este orden:
   - `CLAUDE.md` — reglas de colaboración, secretos y contexto amplio.
   - `CONTEXT.md` — estado consolidado, roadmap y decisiones recientes.
   - `README.md` — descripción y comandos básicos.
   - `docs/migrations.md` — reglas de Supabase y migraciones.
   - Este archivo: `CLAUDE_HANDOFF.md`.
5. Si necesita ejecutar la aplicación localmente:

   ```bash
   nvm use
   npm install
   npm run dev
   ```

   La aplicación queda normalmente en `http://localhost:5173` o en el puerto que informe Vite.

6. Para validar un cambio frontend:

   ```bash
   npx vitest run tests/unit
   npm run typecheck
   npm run build
   ```

   `npm test` incluye pruebas históricas que pueden requerir Docker y Supabase local.

## Prompt inicial recomendado para Claude

Copiar y pegar:

> Vos sos el responsable técnico de Cale Reservas. Primero leé `CLAUDE.md`, `CONTEXT.md`, `README.md`, `docs/migrations.md` y `CLAUDE_HANDOFF.md`. Codex se ocupa del Community Management y de crear publicaciones; vos ocupate de todos los ajustes técnicos posibles del producto: código, errores, UX/UI, Supabase, migraciones, Edge Functions, tests y builds. Primero inspeccioná el estado de Git sin modificar ni borrar archivos. Antes de hacer cambios, resumime qué entendiste, qué archivos relevantes encontraste y qué validaciones vas a ejecutar. No publiques en producción, no hagas push ni modifiques Supabase remoto sin mi autorización explícita.

## Qué es el proyecto

Cale Reservas es la aplicación de reservas de Cale para negocios con agenda. Está publicada en `https://cale.com.ar`:

- Página pública de cada negocio: `https://cale.com.ar/<negocio>`.
- Panel del negocio: `https://cale.com.ar/panel`.
- Frontend: React + Vite + TypeScript + Tailwind.
- Backend: Supabase cloud, migraciones SQL y Edge Functions.
- Node requerido: 24.
- Repositorio remoto: `https://github.com/tomasgaitan14/cale-reservas.git`.

## Estado actual

- Login con Google, alta de negocio, servicios, horarios, profesionales, agenda y reservas funcionando.
- Reservas públicas con validación Turnstile.
- Turnos manuales, bloqueos, agenda por profesional y base de clientes funcionando.
- Personalización de marca, logo, QR/link, PWA y notificaciones push implementados.
- Plan Gratis y plan Pro implementados.
- Mercado Pago para suscripciones implementado; falta realizar la prueba controlada final en producción.
- WhatsApp automático todavía no está conectado: Avisos sigue marcado como “Próximamente”.
- Dominio publicado: `https://cale.com.ar`.
- Desarrollo: `https://dev.cale.com.ar` y local.

## Prioridades siguientes

1. Ejecutar y documentar una prueba controlada de Mercado Pago en producción: alta, webhook, retorno, sincronización y baja con gracia.
2. Completar la integración real de recordatorios de WhatsApp: Meta/WABA, templates, consentimiento, cola, scheduler, entregas, confirmar/cancelar, opt-out, reintentos y trazabilidad.
3. Ejecutar QA de lanzamiento en escritorio y móvil, incluyendo Gratis/Pro y estados de error de Mercado Pago.
4. Revisar textos legales, privacidad, retención, reembolsos, cancelación y precio antes de abrir suscripciones al público.

## Estado de Git al preparar este handoff

- Rama: `codex/fix-business-tab`.
- Commit actual: `342e2e8` (`feat: show current role in panel header`).
- La rama figura alineada con `origin/dev` al momento de preparar este archivo.
- Hay un archivo local nuevo no commiteado que debe preservarse:
  `marketing/instagram/calendario-2026-11-12.md`.
- No asumir que ese archivo se debe borrar, commitear o publicar; preguntarme antes si el trabajo lo afecta.

## Reglas importantes

- Nunca leer, mostrar ni commitear secretos de `.env.local` o archivos de credenciales.
- Usar `.env.example` como referencia.
- `supabase/migrations/` es la fuente de verdad del esquema.
- Antes de cualquier operación remota de Supabase, verificar el proyecto y pedir autorización.
- No crear reservas reales ni enviar avisos de prueba sin autorización.
- No hacer `git push`, desplegar ni modificar producción sin autorización explícita.
- No tocar las funciones `templates` y `send-message`, usadas para App Review de Meta.
- Mantener los cambios acotados al objetivo de la sesión.

## Archivos y carpetas clave

- `app/`: aplicación frontend.
- `supabase/migrations/`: esquema y permisos de base.
- `supabase/functions/`: Edge Functions de reservas, cuenta, push y Mercado Pago.
- `tests/unit/`: pruebas unitarias y de componentes.
- `tests/support/`: utilidades de pruebas, incluyendo Supabase.
- `docs/`: documentación operativa y de migraciones.
- `brand/`: logos, colores y manual de marca.
- `marketing/`: materiales de marketing; contiene el archivo local nuevo indicado arriba.

## Comandos disponibles

```bash
npm run dev
npm run build
npm run typecheck
npx vitest run tests/unit
npm run check:migrations
npm run check:privileges
```

No ejecutar `supabase db push --include-all` en producción mientras WhatsApp siga en preparación. Revisar `CONTEXT.md` y `docs/migrations.md` antes de tocar migraciones.

