// Montaje de las dos escenas aprobadas. No genera ni altera las pantallas del producto.
const { execFileSync } = require('node:child_process');
const { join } = require('node:path');
const { existsSync } = require('node:fs');

const output = join(__dirname, 'prueba-03-movimiento-v2.mp4');
if (existsSync(output)) throw new Error('El archivo ya existe. Usá otro nombre de versión para conservarlo.');

// 5,5 s de apertura + 5,5 s de producto = 11 s. Transición por crema sin superponer títulos.
// Movimiento máximo 1,8%: conserva margen y permite leer los títulos.
const filters = [
  "[0:v]scale=2160:3840:flags=lanczos,setsar=1,zoompan=z='1+0.018*(1-cos(PI*min(on/164,1)))/2':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,trim=duration=5.5,settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p,fade=t=out:st=5.25:d=0.25:color=0xf6f3eb[a]",
  "[1:v]scale=2160:3840:flags=lanczos,setsar=1,zoompan=z='1+0.012*(1+cos(PI*min(on/164,1)))/2':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=1080x1920:fps=30,trim=duration=5.5,settb=AVTB,setpts=PTS-STARTPTS,format=yuv420p,fade=t=in:st=0:d=0.25:color=0xf6f3eb[b]",
  '[a][b]concat=n=2:v=1:a=0,format=yuv420p[out]',
].join(';');

execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'warning', '-n', '-filter_complex_threads', '2',
  '-loop', '1', '-framerate', '30', '-t', '5.5', '-i', join(__dirname, 'prueba-01-apertura.png'),
  '-loop', '1', '-framerate', '30', '-t', '5.5', '-i', join(__dirname, 'prueba-02-reservas.jpg'),
  '-filter_complex', filters, '-map', '[out]', '-an',
  '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-threads', '4',
  '-pix_fmt', 'yuv420p', '-r', '30', '-t', '11', '-movflags', '+faststart',
  '-metadata', 'title=Cale · Prueba de movimiento 01',
  '-metadata', 'comment=Dos escenas aprobadas. Animación de imágenes fijas. Sin audio. Borrador no publicado.',
  output,
], { stdio: 'inherit' });
console.log(output);
