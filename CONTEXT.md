# Cale: contexto para sesiones enfocadas

Actualizado: 04/11/2026. Leer también las preferencias de colaboración en CLAUDE.md (archivo local, fuera de Git).

## Proyecto

Aplicación de reservas para negocios. Repositorio de trabajo: cale-reservas dentro de projects-claude/personal.
React, Vite, TypeScript, Tailwind y Supabase cloud. Node 24. Sitio del panel: https://app.cale.com.ar. No Docker; navegador mediante CUA, sin Playwright.

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
- Footer comercial sin logo: invitación a probar Cale gratis por siete días. Es solo contenido comercial; no hay cobros ni vencimiento automático.

Último commit de la app publicado: b94bdf9 (ícono de confirmación con paleta).
Las migraciones aplicadas están reflejadas en supabase/migrations. Las funciones templates y send-message se usan para App Review de Meta: no tocarlas.

## Validación

Suite completa más reciente antes del último ajuste: 320 pruebas aprobadas. El último ajuste de logo pasó seis pruebas específicas, TypeScript y build. Revisar package.json para comandos actuales; npm test incluye pruebas de base históricas que requieren un entorno local no disponible. Para pruebas unitarias/componentes: npx vitest run tests/unit.

## Pendientes generales

- Recordatorios por WhatsApp e integración de pagos aún no disponibles.
- Control real de los siete días de prueba pendiente.
- Revisar textos legales y operación de conservación/borrado antes de abrir a negocios reales.
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
