# Prueba de movimiento — v2

Alcance aprobado: unir las dos escenas existentes para evaluar ritmo, transición y lectura. No es el Reel completo.

Archivo para revisar: `prueba-03-movimiento-v2.mp4`. Vertical 1080 × 1920, 30 fps, H.264, 11 segundos, sin audio. La v1 se conserva como borrador anterior; la v2 evita superponer los títulos durante la transición.

## Secuencia

| Tiempo | Escena | Movimiento |
|---|---|---|
| 0–5,25 s | Tenés dos manos. Y cinco mensajes preguntando por turnos. | Acercamiento suave, hasta 1,8%. |
| 5,25–5,75 s | Paso de la situación cotidiana al producto. | Salida y entrada a través del fondo crema, sin superponer títulos. |
| 5,75–11 s | Pasales tu link. Ellos eligen cuándo. | Alejamiento muy leve, desde 1,2%, terminando en la composición original. |

El movimiento se aplica a las imágenes aprobadas. La persona y los botones no se animan de manera independiente. La pantalla conserva sus datos ilustrativos. Esta entrega no incluye voz, música, CTA final ni publicación.

## Fuentes

- `prueba-01-apertura.png`: primera escena aprobada, generada con IA.
- `prueba-02-reservas.jpg`: segunda escena aprobada, componentes reales de Cale con datos de ejemplo.

## Reproducir

Se requiere FFmpeg instalado. Desde el proyecto:

```sh
node marketing/reels/render-prueba-movimiento.cjs
```

El script no sobrescribe versiones existentes.
