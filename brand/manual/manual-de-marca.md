# Manual de marca de Cale

Versión 1.0 · isotipo aprobado el 01/11/2026.

Este manual explica cómo se ve y cómo suena Cale. La marca es el símbolo (isotipo), el nombre escrito (wordmark), los
colores, las tipografías y el tono de los textos. El dibujo vive en código, en [`src/lib/brand.ts`](../../src/lib/brand.ts);
si algo de acá contradice al código, manda el código y hay que corregir el manual.

![Isotipo de Cale](../../public/favicon.svg)

---

## 1. Idea

Cale manda recordatorios de turnos por WhatsApp y el cliente final confirma con un botón. El isotipo cuenta eso en un solo
símbolo: **dos tildes**.

- El primer tilde, **tenue**, es el recordatorio enviado.
- El segundo tilde, **pleno**, es el cliente que confirmó.

La personalidad es clara, cálida y directa: un negocio chico que no se pierde turnos, sin vueltas ni jerga técnica.

## 2. Isotipo

Un cuadrado negro de esquinas redondeadas con los dos tildes verdes adentro.

| Parte | Valor |
|---|---|
| Cuadrícula | 64 × 64 |
| Esquinas de la ficha | radio 18 (28 % del lado) |
| Ficha | `#15191C` (`--ink`) |
| Tildes | trazo de 6,5 con puntas y uniones redondeadas, `#25D366` (`--accent`) |
| Tilde 1 (enviado) | `M11 33 L21 43 L40 21.5`, opacidad 45 % |
| Tilde 2 (confirmado) | `M24 33 L34 43 L53 21.5`, opacidad 100 % |

Los tildes están centrados en la ficha y caben dentro del círculo inscrito con un margen del 12,5 %, para que la foto de
perfil de WhatsApp, que se recorta en círculo, no los corte.

### Versiones

| Versión | Dónde se usa | Archivo |
|---|---|---|
| **Ficha con esquinas redondeadas** (la principal) | Encabezado del sitio, favicon, cualquier lugar donde el símbolo va solo | [`public/favicon.svg`](../../public/favicon.svg) |
| **A sangre** (cuadrado sin esquinas redondeadas) | Íconos que cada plataforma enmascara por su cuenta | PNG de abajo |

| Pieza | Tamaño | Archivo |
|---|---|---|
| Favicon | vectorial | [`public/favicon.svg`](../../public/favicon.svg) |
| Ícono de pantalla de inicio (iOS) | 180 × 180 | [`public/apple-touch-icon.png`](../../public/apple-touch-icon.png) |
| Ícono de la app de Meta | 1024 × 1024 | [`cale-app-icon-1024.png`](cale-app-icon-1024.png) |
| Foto de perfil de WhatsApp | 640 × 640 | [`cale-whatsapp-profile-640.png`](cale-whatsapp-profile-640.png) |
| Imagen para compartir el enlace (`og:image`) | 1200 × 630 | [`public/og-image.png`](../../public/og-image.png) |
| Lockup horizontal para usar fuera del sitio | vectorial | [`cale-lockup.svg`](cale-lockup.svg) |

Los PNG van a sangre, sin transparencia y con la ficha negra de lado a lado: iOS, Meta y WhatsApp aplican sus propias
esquinas o su recorte circular, y una ficha ya redondeada dejaría bordes de otro color.

## 3. Wordmark y lockup

El nombre se escribe **«cale»**, siempre en minúscula, en Manrope 800 con el espaciado entre letras cerrado (`-0.05em`).
Es texto del sitio, no una imagen: se ve nítido en cualquier tamaño y lo lee un lector de pantalla.

**Lockup horizontal** (isotipo + nombre), como en el encabezado del sitio:

- El isotipo mide **1,4 veces la altura del texto** (34 px con texto de 24 px).
- La separación entre isotipo y texto es **0,375 veces el tamaño del texto** (9 px con texto de 24 px).
- Isotipo y texto van centrados en vertical.
- El texto va en `--text` (`#15191C`) sobre fondos claros y en blanco sobre fondos oscuros.

**Fuera del sitio** (presentaciones, perfiles de redes, firmas) se usa [`cale-lockup.svg`](cale-lockup.svg): el mismo
lockup con el nombre convertido a trazos, para que no dependa de tener Manrope instalada. Tiene fondo transparente y el
nombre en negro, así que va sobre fondos claros. Los trazos del nombre están en [`src/lib/wordmark.ts`](../../src/lib/wordmark.ts),
con la nota de cómo se obtuvieron.

![Lockup de Cale](cale-lockup.svg)

## 4. Espacio y tamaños

- **Espacio libre:** alrededor del isotipo y del lockup, al menos **la mitad del lado de la ficha**. No pegar texto,
  bordes ni otros logos dentro de esa zona.
- **Tamaño mínimo del isotipo:** 16 px (el favicon). Por debajo de 16 px los dos tildes se funden.
- **Tamaño mínimo del lockup:** isotipo de 24 px.

## 5. Color

| Color | Hex | Token | Uso |
|---|---|---|---|
| Negro | `#15191C` | `--ink`, `--text` | Ficha del isotipo, texto, bandas oscuras |
| Verde | `#25D366` | `--accent` | Tildes del isotipo, botones, acentos sobre negro |
| Crema | `#F7F4EE` | `--bg` | Fondo del sitio |
| Blanco | `#FFFFFF` | `--surface` | Tarjetas y superficies |
| Verde oscuro | `#0A6B3B` | `--link` | Enlaces y texto verde sobre fondos claros |
| Verde claro | `#E2F4E7` | `--tint` | Fondos suaves, burbujas de la clienta |

La paleta completa está en [`src/styles/tokens.css`](../../src/styles/tokens.css), y [`tests/contrast.test.ts`](../../tests/contrast.test.ts)
controla los contrastes.

**Contraste del isotipo:**

| Combinación | Contraste | Resultado |
|---|---|---|
| Tilde pleno sobre la ficha negra | 8,9 : 1 | Cumple 3 : 1 para gráficos |
| Tilde tenue sobre la ficha negra | 2,8 : 1 | Decorativo, se distingue de la ficha |
| Verde `#25D366` sobre crema | 1,8 : 1 | **No cumple**: por eso el verde nunca va suelto sobre claro |

**Reglas del verde:**

- Nunca es color de texto.
- Nunca se usa suelto sobre crema ni sobre blanco: va como relleno de un botón, o sobre negro.
- Es el mismo verde que usa WhatsApp. Se mantiene porque el producto vive ahí, pero el isotipo no copia el logo de
  WhatsApp ni el de Meta.

## 6. Tipografía

| Uso | Fuente | Peso | Notas |
|---|---|---|---|
| Wordmark y títulos | Manrope | 800 | Espaciado `-0.045em` a `-0.05em` |
| Texto | DM Sans | Variable | Cuerpo de 18 px, interlineado 1,55 |

Ambas se sirven desde el propio sitio (`@fontsource-variable`), sin pedidos a Google Fonts. Los tamaños y pesos exactos
están en [`src/styles/tokens.css`](../../src/styles/tokens.css).

## 7. Formas y movimiento

- Superficies muy redondeadas (`--radius-island`, de 28 a 40 px), sombras difusas teñidas del color del fondo y nunca
  negras.
- Encabezado flotante en pastilla de vidrio.
- Bloques de tamaños desiguales en lugar de filas de tarjetas iguales.
- El movimiento usa solo `transform` y `opacity`, y respeta `prefers-reduced-motion`.
- Íconos Phosphor en peso Bold, de un solo grosor.

## 8. Tono de voz

- **Español rioplatense con voseo:** «Conectá», «Anotá», «Escribinos», «Elegí».
- **Desde el problema del negocio:** menos turnos perdidos, menos tiempo escribiendo mensajes uno por uno.
- **Corto y concreto.** Poco texto por bloque, una idea por frase.
- **Sin jerga técnica** (API, token, webhook, plantilla, opt-in): se explica lo que el negocio gana, no cómo funciona por
  dentro.
- **Sin emojis en la interfaz.**
- **Sin inventar datos:** nada de cifras de uso, precios, testimonios ni promesas que todavía no se cumplen.
- **Contacto solo por correo** (`cale.turnos@gmail.com`): el sitio no publica teléfonos ni enlaces de WhatsApp.

## 9. Usos incorrectos

No hacer esto con el isotipo:

- Cambiar los colores, la opacidad del primer tilde o el grosor del trazo.
- Estirarlo, rotarlo, inclinarlo o ponerle sombras, degradados o contornos.
- Usar los tildes sueltos, sin la ficha, sobre crema o blanco (el verde no se ve).
- Poner la ficha negra sobre un fondo negro sin un borde que la separe.
- Cambiar el orden: el tilde tenue va a la izquierda y el pleno a la derecha.
- Volver al calendario con tilde, que fue la marca anterior.
- Escribir el nombre en mayúsculas («CALE») o con otra tipografía.
- Combinarlo con el logo de WhatsApp o de Meta como si fueran una sola marca.

## 10. Cómo se aplica en el sitio

| Lugar | Cómo |
|---|---|
| Encabezado | `src/components/Brand.astro`: isotipo en SVG en línea con los tokens + el nombre en texto |
| Favicon | `public/favicon.svg`, generado desde `brand.ts` |
| Pantalla de inicio de iOS | `public/apple-touch-icon.png` (180 × 180) |
| Ícono de la app de Meta | `docs/brand/cale-app-icon-1024.png` (se sube a mano en el panel de Meta) |
| Foto de perfil de WhatsApp | `docs/brand/cale-whatsapp-profile-640.png` (se sube a mano al perfil del número) |
| Vista previa del enlace (WhatsApp, redes, buscadores) | `public/og-image.png`: el lockup centrado sobre el crema, declarado en `og:image` y `twitter:image` de todas las páginas. Pesa menos de 300 KB, el tope de WhatsApp |
| Datos estructurados | `Organization` y `WebSite` en la portada (`src/lib/structured-data.ts`), con el apple-touch-icon como logo |

**Si cambia el dibujo:** editar solo `src/lib/brand.ts`, correr `npm run brand` para regenerar el favicon, el lockup, la
imagen para compartir y los PNG, y `npm test`. Los tests fallan si el encabezado, el favicon, el lockup o los PNG dejan
de coincidir con el código, si los colores se separan de los tokens o si los tildes dejan de entrar en el círculo de la
foto de perfil. Si cambia la tipografía o el espaciado del nombre, hay que volver a generar `src/lib/wordmark.ts` (la
nota de ese archivo explica cómo).

**Si cambia un color:** cambiarlo en `src/styles/tokens.css` (que también vive en `cale-app`) y en `BRAND_COLORS` de
`brand.ts`; un test controla que coincidan.

## 11. Pendientes

- **Lockup sobre fondo oscuro** (nombre en blanco): hoy el archivo suelto es solo para fondos claros.
- **Versión monocromática** para impresión o sellos (tildes blancos sobre negro, o negros sobre blanco).
- **`cale-app/docs/DISENO.md`** («Marca») todavía describe el calendario con tilde: actualizarlo cuando ese repo se retome.

## 12. Aplicación en contenidos

Para la aplicación de la marca en Instagram, Facebook, Reels, Stories y campañas, consultar el anexo operativo:

[`guia-de-contenidos-y-aplicacion.md`](guia-de-contenidos-y-aplicacion.md)

Ese documento consolida la propuesta de valor, los pilares de contenido, la voz rioplatense, los CTA, los formatos y los recursos visuales a partir de los repositorios actuales de Cale.
