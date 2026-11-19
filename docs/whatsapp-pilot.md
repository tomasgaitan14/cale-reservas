# WhatsApp: configuración asistida por Cale

El negocio conserva su número y sus activos de Meta. Cale configura la integración y muestra estados del proveedor. El usuario no ingresa tokens ni contraseñas en el panel.

## Conexión piloto en dev

En **Ajustes → WhatsApp del negocio → Configurar WhatsApp**, el dueño o un administrador de un negocio habilitado puede abrir el registro de Meta. Debe elegir su cuenta existente de WhatsApp Business y seleccionar **Finalizar**. Cale confirma la cuenta, el número y la coexistencia con Meta, y guarda la conexión cuando Meta acepta la suscripción a los webhooks.

Para habilitar el piloto, el origen de dev debe estar permitido en Facebook Login para empresas y la configuración de Meta tiene que usar Embedded Signup para WhatsApp. Los secretos de registro, cifrado y verificación se configuran en las Edge Functions de `cale-dev`. El origen y los identificadores de negocio admitidos se declaran ahí. La función `whatsapp-signup` y el receptor `whatsapp-webhook` se despliegan desde el repo privado `cale-api`.

La suscripción del piloto apunta los eventos de mensajes a dev para esa cuenta de WhatsApp. Meta entrega los eventos de cuenta, como `account_update`, al webhook general de la app. Revisá esa ruta antes de la prueba con Meta. En el piloto no hace falta compartir ni importar el historial de la clienta.

## Datos en el panel

- Ajustes: estado real y número comercial, solo para dueño/admin. La configuración asistida sigue disponible.
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

La conexión piloto y la activación de envíos son pasos separados.
