# Cale: contexto para sesiones enfocadas

Actualizado: 09/11/2026. Leer también las preferencias de colaboración en CLAUDE.md (archivo local, fuera de Git).

## Estado consolidado al 09/11/2026

Esta sección supersede los estados históricos que aparecen más abajo.

- Dominio canónico publicado: https://cale.com.ar. Panel: https://cale.com.ar/panel. El proyecto Vercel anterior `cale-turnos` fue eliminado por decisión del titular.
- Migración de dominio, Auth, Supabase, Meta Business y redirecciones finalizada. El ingreso con Google, la agenda, las reservas y la navegación en `cale.com.ar` fueron verificados.
- Cuenta y datos: existe eliminación permanente de cuenta desde Ajustes, incluyendo negocio, turnos, horarios, preferencias, logos, push y facturación.
- Planes: Gratis y Pro se leen desde `businesses.plan`. Gratis mantiene agenda, reservas, link, personalización y push de la app. La conexión automática con WhatsApp permanece en preparación para ambos planes.
- Experiencia de planes: el encabezado muestra el negocio y su badge `PRO` con corona o `GRATIS`; la navegación principal está en una barra inferior estilo app. `Avisos` solo aparece para negocios Pro y continúa marcado como “Próximamente”; las cuentas Gratis no ven esa opción ni pueden acceder por URL directa.
- Mercado Pago: checkout de Suscripciones funcionando; el webhook público funciona sin JWT y existe `sync-pro-subscription` para confirmar el estado al volver del checkout. El retorno usa `https://cale.com.ar/panel/ajustes?subscription=success`; el panel sincroniza, espera hasta dos minutos y muestra el plan. Si Mercado Pago demora el webhook, Cale muestra “Procesando tu suscripción… No vuelvas a pagar” mientras `business_billing` está pendiente. La baja cancela los próximos cobros, conserva Pro hasta `current_period_end` y muestra los días restantes solo mientras esa baja está activa; al vencer el período, la sincronización devuelve el negocio a Gratis. La cuenta de prueba de `Peluqueria Maria Rosa` fue aprobada y quedó en `pro/active`.
- Promoción archivada: `ProOfferBanner`, el cupón `DESCUENTOCALE50` y la validación de 14 días quedaron guardados para reactivarlos, pero no se muestran en la Agenda. La simulación de antigüedad de `tomasgaitan14@gmail.com` fue revertida a su fecha real.
- Cupones: la documentación oficial de Mercado Pago ubica los cupones documentados en Wallet Connect, no en el endpoint de Suscripciones usado por Cale. El backend conserva una implementación propia preparada para un primer período promocional de $7.499 y posterior normalización a $14.999, pero la promoción está archivada y no debe comunicarse como activa.
- WhatsApp: el envío automático real todavía no está conectado. La pantalla de Avisos muestra vista previa y estado “Próximamente”; las notificaciones push de la app sí están disponibles desde Ajustes.
- Facturación: el alta calcula el primer período proporcional sobre 30 días y el webhook/sincronización normalizan la suscripción a $14.999, día 10 y moneda ARS. `business_billing` guarda `billing_day`, `initial_charge_amount` y la fecha de configuración. La suscripción de prueba anterior conserva su período actual hasta el 8/12; la nueva prueba aprobada quedó activa y se configuró para los ciclos siguientes.
- Producción de Mercado Pago: las funciones de alta, sincronización, baja y webhook aceptan `MP_ACCESS_TOKEN`/`MP_WEBHOOK_SECRET` productivos con prioridad sobre las variables de prueba. El webhook valida la firma HMAC y ambas variables productivas ya están cargadas en Supabase. Falta únicamente la prueba controlada del flujo productivo, que la persona titular hará manualmente.

## Roadmap priorizado

1. **Cerrar facturación de producción.** Ejecutar la prueba controlada del alta, webhook y baja con una cuenta real. La prioridad de credenciales productivas, la baja con gracia y el contador de días ya están implementados.
2. **Conectar recordatorios de WhatsApp.** Completar conexión Meta/WABA, templates aprobados, consentimiento, cola/scheduler, entregas, respuestas de confirmar/cancelar, opt-out, reintentos y trazabilidad en `reminder_deliveries`.
3. **QA de lanzamiento.** Ejecutar la suite de base con Docker/Supabase local, corregir el entorno Node para usar la versión declarada, hacer smoke test Gratis/Pro en escritorio y móvil y revisar los estados de error de Mercado Pago.
4. **Legal y operación.** Revisar términos, privacidad, retención de datos, reembolsos, cancelación, precio promocional y mensajes de WhatsApp antes de abrir la suscripción al público.
5. **Crecimiento.** Reactivar la oferta de 14 días solo después de validar el mecanismo de descuento en producción; luego agregar métricas de conversión, límites de frecuencia y campañas administrables.

## Proyecto

Aplicación de reservas para negocios. Repositorio de trabajo: cale-reservas dentro de projects-claude/personal.
React, Vite, TypeScript, Tailwind y Supabase cloud. Node 24. Sitio del panel: https://cale.com.ar/panel. No Docker disponible actualmente; navegador mediante CUA, sin Playwright.

## Estado publicado

- Acceso con Google, alta de negocio, servicios, horarios, agenda, turnos manuales y bloqueos.
- Reserva pública por identificador del negocio. Selector de cuatro fechas visibles y desplazamiento horizontal. Botón para reservar otro turno.
- Reserva mediante Edge Function book-appointment con validación Turnstile. El RPC create_booking solo permite acceso al servidor.
- Diseño cálido; panel mobile con mejoras de espaciado.
- PWA del panel: manifiesto, iconos, apertura en /panel, guía de instalación iPhone y pantalla sin conexión. No se cachean turnos ni sesiones.
- Push: activación por dispositivo, prueba y desactivación en Ajustes; invitación inicial; cola y tarea cada minuto. Recepción y apertura de agenda verificadas por el usuario en iPhone.
- Títulos push por evento: Nueva reserva, Turno cancelado, Notificación de prueba. iOS controla la indicación del origen de la app.
- Personalización: logo y tres colores de la página pública; paletas, vista previa, contraste automático, restauración. Tabla business_branding y bucket público business-logos con permisos por negocio.
- Logo: botón Subir logo/Cambiar logo, miniatura junto al control y vista previa completa. PNG/JPG/WebP hasta 5 MB; conversión a PNG de 512 px, máximo 1 MB publicado.
- Plan Gratis sin vencimiento automático. Los cobros solo ocurren al iniciar Pro mediante Mercado Pago.
- Navegación del panel: barra inferior fija, adaptada a área segura de iPhone. Gratis muestra Agenda, Negocio y Ajustes; Pro agrega Avisos.

Último commit de la app publicado: b94bdf9 (ícono de confirmación con paleta).
Las migraciones aplicadas están reflejadas en supabase/migrations. Las funciones templates y send-message se usan para App Review de Meta: no tocarlas.

## Validación

Suite completa más reciente antes del último ajuste: 320 pruebas aprobadas. El último ajuste de logo pasó seis pruebas específicas, TypeScript y build. Revisar package.json para comandos actuales; npm test incluye pruebas de base históricas que requieren un entorno local no disponible. Para pruebas unitarias/componentes: npx vitest run tests/unit.

## Pendientes generales

- Recordatorios por WhatsApp todavía no disponibles; producción de Mercado Pago ya está configurada y publicada, pendiente de smoke test controlado.
- La política de cancelación conserva Pro hasta el fin del período pagado y muestra la cantidad de días restantes solo a cuentas canceladas.
- Revisar textos legales y operación de conservación/borrado antes de abrir suscripciones a negocios reales.
- Cualquier idea nueva se trabaja en un chat con un objetivo específico.

## Operación y privacidad

No publicar secretos ni datos personales del titular o clientes; único contacto público: cale.turnos@gmail.com.
Pedir autorización concreta para producción, commits/push y publicación, sin repetir autorizaciones vigentes. No crear reservas ni enviar avisos de prueba sin autorización. Hacer pruebas sintéticas y reversibles cuando corresponda.
Preferir herramientas de Supabase; no modificar otros repositorios de Cale por implicación.

## Modelo de una sesión

Título: área y objetivo concreto.
Inicio: objetivo, carpeta confirmada, modelo recomendado y alcance.
Trabajo: cambios necesarios, pruebas proporcionadas y revisión móvil si aplica.
Cierre: qué cambió, qué se comprobó, commit/publicación si se autorizaron, pendiente específico si existe.

## Mejoras tras revisión UX (04/11/2026)

- Mensajes de portada e ingreso centrados en reservas y agenda; WhatsApp automático sigue marcado como próximo.
- Alta reducida a cinco pasos; las preferencias futuras de recordatorios siguen en Avisos.
- Validación previa de nombre, celular y consentimiento, con mensaje y foco en el primer campo pendiente.
- Dirección editable sin prefijo dentro del campo y vista completa del link debajo.
- El usuario autorizó mostrar el WhatsApp del negocio como contacto público. Migración public_business_contact aplicada y verificada como anon con datos ficticios y ROLLBACK; botón de contacto en confirmación con mensaje del turno y aclaración de que no cancela automáticamente.
- Prueba UX: negocio ficticio separado, un turno creado y cancelado. No se modificó el negocio existente. Safari/PWA en iPhone no se revalidó en esta revisión.
- Validación: 324 pruebas unitarias/componentes, TypeScript y build aprobados. Publicado en https://app.cale.com.ar y comprobado en navegador. Commit de la app: 2b9524b.

## Reparación de configuración de publicación (04/11/2026)

- El ingreso publicado apuntaba a un dominio de ejemplo antes de llegar a Google. Se repusieron las cuatro variables públicas de producción de Vercel desde la configuración local existente.
- La compilación ahora rechaza variables ausentes y destinos de ejemplo/inválidos; nueve pruebas de configuración, TypeScript y build aprobados.
- No se cambiaron permisos, datos ni credenciales privadas de Supabase.

- Reparación publicada: d7ff8a5. Ingreso con Google verificado hasta agenda autenticada. En la prueba el retorno terminó en cale-reservas.vercel.app; queda revisar la URL de retorno de Supabase para conservar app.cale.com.ar.

## Publicado: hora actual y contraste (04/11/2026)

- Agenda: línea roja con hora argentina en la columna de hoy, en día y semana, dentro del rango visible. Actualiza cada minuto y al volver a la app; no captura clics.
- Marca: textos secundarios y principales dentro del resumen usan el contraste del fondo; títulos y enlaces sobre fondo claro ajustan el color primario para mantener lectura.
- Revisado con componentes reales y datos ficticios en escritorio y móvil, con verde oscuro, rosa oscuro y rosa claro. Sin cambios en datos ni colores guardados. Publicado en app.cale.com.ar; estilos y configuración Supabase comprobados en el paquete servido. Validación: 340 pruebas, TypeScript y build aprobados.

- Ajuste publicado de contraste: se prioriza blanco desde tonos intermedios con umbral visual de 2.2:1 a pedido del usuario (incluye #dd9c9f; blanco tiene menor contraste que negro); los tonos claros conservan negro. 17 pruebas de marca, TypeScript y build aprobados.

- Encabezado público: debajo del nombre del negocio aparece “Reservas con [ícono] Cale”. El enlace Cale abre https://cale-reservas.vercel.app en otra pestaña. Revisado en móvil; TypeScript y build correctos; publicado y paquete verificado.

- Confirmación de reserva: recuadro del tilde usa color primario y texto de contraste de la marca, en lugar del verde fijo. TypeScript/build correctos; publicado y paquete verificado.
