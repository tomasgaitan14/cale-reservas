# Escena 02 — Pasales tu link

Fotograma de prueba en revisión; no publicado. Salida: [prueba-02-reservas.jpg](../prueba-02-reservas.jpg), 1080 × 1920.

Texto aprobado: “Pasales tu link. Ellos eligen cuándo.”

La escena usa el SVG oficial de Cale, Manrope y DM Sans autoalojadas, y la paleta de `app/src/natural.css`. La pantalla dentro del marco renderiza directamente `BookingPage` y sus componentes actuales. Las únicas adaptaciones de presentación son el marco, el escalado y ocultar las barras de desplazamiento de la captura.

El negocio, los servicios y horarios son datos ilustrativos locales. Vite reemplaza los módulos de datos por fixtures exclusivamente para esta vista. No hay conexión a la base, alta de negocios ni creación de reservas. No representa una captura de un cliente real.

Vista elegida: Corte y brushing, viernes 6 de noviembre de 2026, 11:00. Se verificaron los tres controles en navegador, el logo y la visibilidad completa de Continuar. La captura quedó estática; el video aún no se produjo.

## Reproducir

Desde la raíz del proyecto, con Node 24:

```sh
npx vite --config marketing/reels/prueba-02/vite.config.ts
```

Abrir `http://127.0.0.1:5186/marketing/reels/prueba-02/index.html`, elegir servicio, fecha y horario dentro del teléfono y capturar la página completa. El lienzo mide 1080 × 1920. Las fechas se calculan con la lógica real de la app, por lo que cambiarán al recrear la captura otro día.

Es una composición HTML/CSS con interfaz real; no se utilizó ImageGen para dibujar pantallas ni logotipos.
