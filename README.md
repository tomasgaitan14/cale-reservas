# cale-reservas

Reservas de turnos y recordatorios por WhatsApp para negocios con agenda (peluquerías, estéticas, consultorios). Es la parte de producto de
[Cale](https://cale.com.ar): cada negocio tiene su página de reservas en `app.cale.com.ar/<negocio>` y su panel en `app.cale.com.ar/panel`.

**Estado:** en construcción (MVP). Hoy hay la base de datos con sus tests y la página del negocio (entrar, servicios, horarios y agenda) y la página pública de reservas. El alcance, el estado y el orden de entrega están en [`CLAUDE.md`](CLAUDE.md).

## Cómo funciona (MVP)

1. El negocio entra con Google, crea su negocio y carga servicios y horarios.
2. Sus clientes reservan en `app.cale.com.ar/<negocio>`.
3. Cada turno queda en la base de Cale y el negocio lo ve y lo gestiona en su agenda del panel, donde también carga turnos a mano y bloquea horarios.
4. Cale manda un recordatorio por WhatsApp con la anticipación que el negocio eligió, con botones para confirmar o cancelar.
5. El panel muestra cuántos turnos están pendientes, confirmados y cancelados.

## Desarrollo

Requiere Node 24 (`nvm use`) y, para los tests de base de datos, Docker y la CLI de Supabase.

Las variables van en `.env` (ver `.env.example`); nunca se commitean.

## Migraciones

`supabase/migrations/` es la **única fuente de verdad** del esquema de Supabase, también para `cale-api` (que solo tiene Edge Functions e
integraciones con Meta). `npm run check:migrations` detecta archivos mal formados o repetidos y, con `-- --remote`, las migraciones aplicadas
sin archivo. Ver [`docs/migrations.md`](docs/migrations.md). Permisos de la base y paridad con producción: [`docs/migrations.md`](docs/migrations.md#permisos-el-local-no-es-igual-a-producción). Cómo se guardan y procesan los avisos de WhatsApp: [`docs/whatsapp-webhook-events.md`](docs/whatsapp-webhook-events.md).

## Contacto

`cale.turnos@gmail.com`
