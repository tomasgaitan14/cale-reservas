# WhatsApp: configuración asistida por Cale

El negocio conserva su número y sus activos de Meta. Cale configura la integración y muestra estados del proveedor. El usuario no ingresa tokens ni contraseñas en el panel.

## Primera entrega en dev

- Ajustes: estado real, número comercial y coordinación de configuración asistida, solo para dueño/admin.
- Avisos Pro: consulta del historial real, actualización manual, estados y fechas. Sin datos simulados.
- Reserva pública: consentimiento de WhatsApp opcional; sin aceptación, consented_at permanece null.
- Conexiones e historial: lectura por administrador del negocio, sin acceso del navegador a credential_reference, WABA, token ni identificadores de proveedor.

## Pendiente antes de habilitar envíos

- Verificar el recorrido oficial de Meta para esta cuenta y elegibilidad de coexistencia. No se garantiza por configurar manualmente; validar permisos, revisión y requisitos aplicables.
- Configurar número, credenciales exclusivamente de servidor y plantillas aprobadas.
- Revisar programador/emisor, cancelaciones, reintentos y exclusión de turnos sin consentimiento.
- Ampliar evidencia del consentimiento con versión de texto y origen.
- Incorporar controles de anticipación y pausa con autorización del servidor.
- Asociar historial con turno/cliente y definir refresco automático.
- Actualizar textos legales sobre tratamiento por cuenta del negocio, Meta, conservación, costos, bajas y derechos; revisar antes de publicación.
- QA de conexión, envío, entrega, lectura, error y respuesta con número de prueba autorizado.

No hay envío real habilitado por esta primera entrega. Producción no se modifica.
