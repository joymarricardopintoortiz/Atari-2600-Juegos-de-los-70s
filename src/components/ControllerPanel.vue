<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import type { GamepadSupportApi, PadDevice } from '../types/gamepad-support'

const props = defineProps<{ frame?: HTMLIFrameElement | null }>()

const open = ref(false)
const devices = ref<PadDevice[]>([])
const supported = ref(true)
const loaded = ref(false)
const buscando = ref(false)

/** Botones que el emulador usa en el mando (índices ya normalizados) */
const chips = [
  { i: 0, label: 'Disparo' },
  { i: 8, label: 'Select' },
  { i: 9, label: 'Reset' },
  { i: 4, label: 'Pausa' },
  { i: 7, label: 'Rec. +' },
  { i: 6, label: 'Rec. −' },
]

const apiOf = (win?: Window | null): GamepadSupportApi | undefined => {
  try {
    return win?.GamepadSupport
  } catch {
    return undefined // iframe cruzado o aún sin cargar
  }
}

/** Lo que ve el emulador manda; si aún no está, usamos el de esta página */
const currentApi = (): GamepadSupportApi | undefined =>
  apiOf(props.frame?.contentWindow) ?? apiOf(window)

const loadSupport = () =>
  new Promise<void>((resolve) => {
    if (apiOf(window)) {
      resolve()
      return
    }
    const existing = document.querySelector('script[data-gamepad-support]')
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = '/javatari/gamepad-support.js'
    script.async = true
    script.dataset.gamepadSupport = ''
    script.onload = () => resolve()
    script.onerror = () => resolve()
    document.head.appendChild(script)
  })

const refresh = () => {
  const api = currentApi()
  if (!api) return
  supported.value = api.supported
  loaded.value = true
  devices.value = api.getDevices()
}

let timer = 0
const restartPolling = () => {
  window.clearInterval(timer)
  timer = window.setInterval(refresh, open.value ? 120 : 400)
}

const toggle = () => {
  open.value = !open.value
  refresh()
  restartPolling()
}

/** Algunos navegadores sólo leen mandos tras una interacción del usuario */
const detectar = () => {
  buscando.value = true
  try {
    navigator.getGamepads()
  } catch {
    /* ignore */
  }
  try {
    props.frame?.contentWindow?.navigator.getGamepads()
  } catch {
    /* ignore */
  }
  refresh()
  window.setTimeout(() => (buscando.value = false), 3000)
}

const summary = computed(() => {
  if (!loaded.value) return 'Buscando mandos…'
  if (!supported.value) return 'Este navegador no admite mandos'
  if (!devices.value.length) return 'Sin mandos · cable o Bluetooth'
  return devices.value
    .map((d) => `${d.label}${d.player ? ' · J' + d.player : ''}`)
    .join('  +  ')
})

const onGamepadEvent = () => refresh()

onMounted(async () => {
  await loadSupport()
  refresh()
  restartPolling()
  window.addEventListener('gamepadconnected', onGamepadEvent)
  window.addEventListener('gamepaddisconnected', onGamepadEvent)
})

onBeforeUnmount(() => {
  window.clearInterval(timer)
  window.removeEventListener('gamepadconnected', onGamepadEvent)
  window.removeEventListener('gamepaddisconnected', onGamepadEvent)
})
</script>

<template>
  <section class="pads" :class="{ open }">
    <button
      type="button"
      class="pads-head"
      :aria-expanded="open"
      aria-controls="pads-body"
      @click="toggle"
    >
      <span class="pads-icon" aria-hidden="true">🎮</span>
      <span class="pads-name">MANDOS</span>
      <span class="pads-badge" :class="{ on: devices.length }">{{ devices.length }}</span>
      <span class="pads-summary">{{ summary }}</span>
      <span class="pads-caret" aria-hidden="true">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" id="pads-body" class="pads-body">
      <p v-if="!supported" class="pads-note bad">
        Tu navegador no soporta la Gamepad API. Prueba con Chrome, Edge, Firefox o Safari.
      </p>

      <template v-else>
        <div v-if="devices.length" class="pads-list">
          <article v-for="d in devices" :key="d.index" class="pad">
            <header class="pad-head">
              <h3>{{ d.label }}</h3>
              <span class="tag player">{{ d.player ? 'Jugador ' + d.player : 'Sin asignar' }}</span>
              <span class="tag">{{ d.profileLabel }}</span>
              <span class="tag">
                {{ d.connection }}<em v-if="d.inferred" title="El navegador no indica la conexión: se deduce del nombre del mando."> · inferido</em>
              </span>
            </header>

            <div class="pad-test">
              <div class="dpad" aria-label="Cruceta">
                <i :class="{ on: d.dpad.up }" class="u">▲</i>
                <i :class="{ on: d.dpad.left }" class="l">◀</i>
                <i :class="{ on: d.dpad.right }" class="r">▶</i>
                <i :class="{ on: d.dpad.down }" class="d">▼</i>
              </div>

              <div class="stick" aria-label="Stick izquierdo">
                <i
                  :style="{
                    left: 50 + Math.max(-1, Math.min(1, d.axes[0])) * 42 + '%',
                    top: 50 + Math.max(-1, Math.min(1, d.axes[1] || 0)) * 42 + '%',
                  }"
                />
              </div>

              <ul class="chips">
                <li v-for="c in chips" :key="c.i" :class="{ on: d.buttons[c.i] }">
                  {{ c.label }}
                </li>
              </ul>
            </div>

            <p class="pad-live">Mueve la cruceta, el stick o pulsa botones: si se encienden, van a juego.</p>
          </article>
        </div>

        <div v-else class="pads-empty">
          <p>No hay ningún mando conectado todavía.</p>
          <ul class="tips">
            <li><b>Cable:</b> conéctalo y se reconoce solo.</li>
            <li><b>Bluetooth:</b> empareja el mando y pulsa su botón Home/Acciones.</li>
            <li>Si ya estaba emparejado, pulsa <b>Detectar mandos</b>.</li>
          </ul>
        </div>

        <div class="pads-actions">
          <button type="button" class="detect" @click="detectar">Detectar mandos</button>
          <p v-if="buscando" class="pads-note">
            Leyendo mandos… Si no aparece, comprueba que esté encendido y emparejado.
          </p>
        </div>

        <details class="help">
          <summary>Controles del mando</summary>
          <ul class="legend">
            <li><b>Cruceta / stick izq.</b> — mover</li>
            <li><b>Cross · A</b> — disparar</li>
            <li><b>Share / View</b> — Select</li>
            <li><b>Options / Menú</b> — Reset</li>
            <li><b>L1 / LB</b> — pausa</li>
            <li><b>R2·RT</b> — más rápido · <b>L2·LT</b> — más lento</li>
            <li><b>Segundo mando</b> — se asigna al Jugador 2 (W A S D + R)</li>
          </ul>
          <p class="fine">
            Compatible con mandos por <b>cable y Bluetooth</b>: PS3, PS4, PS5, Xbox One, Xbox
            Series, Switch Pro/Joy-Con, Stadia, 8BitDo y mandos genéricos. Si tu mando llega con
            los botones en otro orden (PS3, DInput), aquí se reordenan solos antes de llegar al
            juego.
          </p>
        </details>
      </template>
    </div>
  </section>
</template>

<style scoped>
.pads {
  margin-top: 1rem;
  border: 1px solid rgba(0, 240, 255, 0.35);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(6px);
  overflow: hidden;
  text-align: left;
}

.pads-head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.7rem 0.9rem;
  border: 0;
  background: transparent;
  color: var(--text, #f4ecff);
  font-family: var(--font-pixel, 'Press Start 2P', monospace);
  font-size: 0.66rem;
  cursor: pointer;
}

.pads-head:hover {
  background: rgba(0, 240, 255, 0.1);
}

.pads-icon {
  font-size: 1rem;
}

.pads-badge {
  min-width: 1.6em;
  padding: 0.15em 0.4em;
  border-radius: 999px;
  text-align: center;
  font-size: 0.6rem;
  color: #9ad7dd;
  background: rgba(255, 255, 255, 0.1);
}

.pads-badge.on {
  color: #06210f;
  background: var(--cyan, #00f0ff);
}

.pads-summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-body, system-ui, sans-serif);
  font-size: 0.82rem;
  color: var(--text-soft, #c9b8f0);
}

.pads-caret {
  color: var(--yellow, #ffe14d);
}

.pads-body {
  padding: 0 0.9rem 0.9rem;
}

.pads-list {
  display: grid;
  gap: 0.7rem;
}

.pad {
  padding: 0.7rem 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.25);
}

.pad-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.pad-head h3 {
  flex: 1 1 100%;
  margin: 0;
  font-family: var(--font-pixel, 'Press Start 2P', monospace);
  font-size: 0.66rem;
  color: var(--cyan, #00f0ff);
  overflow-wrap: anywhere;
}

.tag {
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--text-soft, #c9b8f0);
  background: rgba(255, 255, 255, 0.1);
}

.tag em {
  font-style: normal;
  opacity: 0.7;
}

.tag.player {
  color: #06210f;
  background: var(--yellow, #ffe14d);
  font-weight: 700;
}

.pad-test {
  display: flex;
  align-items: center;
  gap: 0.9rem;
  margin-top: 0.6rem;
}

.dpad {
  display: grid;
  grid-template-columns: repeat(3, 1.05rem);
  grid-template-rows: repeat(3, 1.05rem);
  gap: 2px;
}

.dpad i {
  display: flex;
  align-items: center;
  justify-content: center;
  font-style: normal;
  font-size: 0.6rem;
  color: rgba(255, 255, 255, 0.3);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  transition: 0.08s;
}

.dpad i.on {
  color: #06210f;
  background: var(--cyan, #00f0ff);
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.7);
}

.dpad .u { grid-area: 1 / 2; }
.dpad .l { grid-area: 2 / 1; }
.dpad .r { grid-area: 2 / 3; }
.dpad .d { grid-area: 3 / 2; }

.stick {
  position: relative;
  width: 3rem;
  height: 3rem;
  border: 1px dashed rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

.stick i {
  position: absolute;
  width: 0.7rem;
  height: 0.7rem;
  margin: -0.35rem 0 0 -0.35rem;
  border-radius: 50%;
  background: var(--pink, #ff2e97);
  transition: 0.05s linear;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips li {
  padding: 0.2rem 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  font-size: 0.72rem;
  color: var(--text-soft, #c9b8f0);
  background: rgba(255, 255, 255, 0.06);
  transition: 0.08s;
}

.chips li.on {
  color: #1a0b3d;
  font-weight: 700;
  background: var(--yellow, #ffe14d);
  border-color: var(--yellow, #ffe14d);
}

.pad-live,
.pads-note,
.fine {
  margin: 0.55rem 0 0;
  font-size: 0.76rem;
  color: var(--text-soft, #c9b8f0);
}

.pads-empty p {
  margin: 0.2rem 0 0.4rem;
  font-size: 0.9rem;
}

.tips {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  color: var(--text-soft, #c9b8f0);
}

.tips li {
  margin: 0.2rem 0;
}

.pads-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.7rem;
}

.detect {
  padding: 0.55rem 1rem;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-pixel, 'Press Start 2P', monospace);
  font-size: 0.62rem;
  color: #fff;
  background: linear-gradient(135deg, var(--pink, #ff2e97), var(--purple, #8b5cf6));
}

.detect:hover {
  filter: brightness(1.15);
}

.pads-note.bad {
  color: #ff9db4;
}

.help {
  margin-top: 0.8rem;
  border-top: 1px dashed rgba(255, 255, 255, 0.18);
  padding-top: 0.5rem;
}

.help summary {
  cursor: pointer;
  font-family: var(--font-pixel, 'Press Start 2P', monospace);
  font-size: 0.6rem;
  color: var(--yellow, #ffe14d);
}

.legend {
  margin: 0.5rem 0 0;
  padding-left: 1.1rem;
  font-size: 0.8rem;
  color: var(--text-soft, #c9b8f0);
}

.legend li {
  margin: 0.18rem 0;
}

.legend b {
  color: var(--text, #f4ecff);
}

@media (max-width: 520px) {
  .pad-test {
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .pads-name {
    display: none;
  }
}
</style>
