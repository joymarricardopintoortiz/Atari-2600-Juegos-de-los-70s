# Vue 3 + TypeScript + Vite

This template should help get you started developing with Vue 3 and TypeScript in Vite. The template uses Vue 3 `<script setup>` SFCs, check out the [script setup docs](https://v3.vuejs.org/api/sfc-script-setup.html#sfc-script-setup) to learn more.

Learn more about the recommended Project Setup and IDE Support in the [Vue Docs TypeScript Guide](https://vuejs.org/guide/typescript/overview.html#project-setup).

## Mandos (Gamepad API)

La página admite mandos **por cable y por Bluetooth**: PS3, PS4, PS5, Xbox One, Xbox Series,
Switch Pro / Joy-Con, Stadia, 8BitDo y mandos genéricos de PC.

### Cómo se usa

1. Conecta o empareja el mando (Bluetooth: pulsa su botón Home/acciones).
2. Abre el panel **🎮 MANDOS** que hay debajo de la pantalla del emulador.
3. Si no aparece, pulsa **Detectar mandos** (los navegadores sólo leen mandos tras un
   gesto del usuario).
4. Mueve la cruceta, el stick o pulsa botones: los indicadores deben encenderse. Si se
   encienden ahí, van al juego.

El **primer mando** se asigna al Jugador 1 y el **segundo** al Jugador 2 (W A S D + R),
igual que en Javatari.

### Controles

| Mando | Acción en el juego |
| --- | --- |
| Cruceta / stick izquierdo | mover |
| Cross · A | disparar |
| Share / View | Select |
| Options / Menú | Reset |
| L1 / LB | pausa |
| R2 / RT · L2 / LT | más rápido · más lento |

### Cómo funciona

Javatari lee `navigator.getGamepads()` directamente y sólo entiende la disposición
**estándar W3C**. Muchos mandos (PS3, mandos DInput, algunos genéricos) llegan con otro
orden de botones y una cruceta codificada como eje "hat", así que el juego recibe cruces
invertidas o botones cruzados.

`public/javatari/gamepad-support.js` se carga dentro del iframe del emulador y **parchea
`navigator.getGamepads()` sólo ahí**: convierte cada mando a la disposición estándar
(perfiles `standard`, `ds3`, `ds4raw`, `dinput`; traducción del "hat" a botones 12–15) y
deja el estado legible en `window.GamepadSupport`, que es lo que muestra el panel 🎮
MANDOS. Al soltar un mando se emite un fotograma "fantasma" con los botones sueltos para
que no se quede ninguna tecla pegada.

Archivos: `public/javatari/gamepad-support.js` (núcleo), `src/components/ControllerPanel.vue`
(panel), `src/types/gamepad-support.d.ts` (tipos).
