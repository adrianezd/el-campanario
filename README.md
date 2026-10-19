# El campanario

Juego de fiesta de deducción social para 5 a 16 jugadores: un demonio y sus esbirros contra el pueblo. El móvil hace de narrador: despierta a cada uno de noche, reparte información (que puede ser falsa si estás envenenado o borracho) y lleva las votaciones. Los muertos siguen jugando como fantasmas, con un único voto para el resto de la partida.

🔗 **Jugar ahora:** https://adrianezd.github.io/el-campanario/

## Dos modos

- **Mismo móvil:** el móvil se pasa de mano en mano para las fases secretas y hace de narrador. Funciona sin conexión.
- **Con código de sala:** uno crea la sala y elige los ajustes; el resto entra con el código y cada uno juega en su móvil. Los móviles se comunican por [ntfy.sh](https://ntfy.sh) (sin cuentas), así que hace falta internet.

## Reglas

- Gana el pueblo si muere el demonio; gana el mal si solo quedan dos vivos.
- Para ejecutar hacen falta los votos de al menos la mitad de los vivos.
- Reparto automático según el número de jugadores: 13 papeles del pueblo, 3 forasteros, 4 esbirros y el demonio.

## Stack técnico

Sitio estático sin dependencias ni build: HTML, CSS y JavaScript vanilla servidos por GitHub Pages.

- `script.js`: el juego. Un único motor (`act`, `privateTurn`, `render`) para los dos modos.
- `mesa.js`: modo «Mismo móvil», igual en los juegos de fiesta por fases.
- `sala.js` y `sala.css`: modo con código de sala, iguales en todos los juegos de fiesta.
- `kit.js` y `style.css`: piezas y estilos comunes. `juego.css`: lo propio de este juego.
- `sw.js`: caché para jugar sin conexión.

## Aviso

Juego de fiesta **original**, no afiliado a ninguna marca, producto o juego comercial.
