<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ romUrl: string }>()

// Parte de la API interna de Javatari que usamos
type Monitor = {
  displayScaleIncrease(): void
  displayScaleDecrease(): void
  fullscreenToggle(): void
}
type JavatariWindow = Window & {
  Javatari?: { room?: { screen?: { getMonitor(): Monitor } } }
}

// Cada paso de Javatari cambia el tamaño 0.1x; por pulsación damos 2 pasos (0.2x)
const STEPS_PER_PRESS = 2
const MAX_LEVEL = 4 // hasta 4 pulsaciones para agrandar
const MIN_LEVEL = -6 // hasta 6 pulsaciones para achicar

const frame = ref<HTMLIFrameElement | null>(null)
const src = computed(() => `/javatari/index.html?ROM=${props.romUrl}`)

let level = 0
let frameWindow: Window | null = null

const getMonitor = (): Monitor | undefined =>
  (frame.value?.contentWindow as JavatariWindow | null)?.Javatari?.room?.screen?.getMonitor()

const resize = (dir: 1 | -1) => {
  const next = level + dir
  if (next > MAX_LEVEL || next < MIN_LEVEL) return
  const monitor = getMonitor()
  if (!monitor) return
  for (let i = 0; i < STEPS_PER_PRESS; i++) {
    if (dir > 0) monitor.displayScaleIncrease()
    else monitor.displayScaleDecrease()
  }
  level = next
}

const toggleFullscreen = () => getMonitor()?.fullscreenToggle()

const focusGame = () => frameWindow?.focus()

// Para los botones: ejecuta la acción y devuelve el foco al juego
const press = (action: () => void) => {
  action()
  focusGame()
}

// Atajos: + agrandar · - achicar · F pantalla completa
const onKey = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return

  let handled = true
  if (e.key === '+' || e.key === '=') resize(1)
  else if (e.key === '-' || e.key === '_') resize(-1)
  else if (e.key === 'f' || e.key === 'F') {
    if (!e.repeat) toggleFullscreen()
  } else handled = false

  if (handled) {
    e.preventDefault()
    e.stopPropagation() // evita que Javatari también procese estas teclas
  }
}

// Cuando el iframe carga, escuchamos las teclas también DENTRO del juego
const onLoad = () => {
  level = 0
  frameWindow = frame.value?.contentWindow ?? null
  frameWindow?.addEventListener('keydown', onKey, true)
  focusGame()
}

// Y cuando el foco está fuera del juego (en la página de Vue)
onMounted(() => window.addEventListener('keydown', onKey, true))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  frameWindow?.removeEventListener('keydown', onKey, true)
})
</script>

<template>
  <div class="wrapper">
    <iframe
      ref="frame"
      :key="romUrl"
      :src="src"
      allow="autoplay; fullscreen"
      allowfullscreen
      @load="onLoad"
    />

    <div class="toolbar">
      <button title="Achicar (tecla -)" @click="press(() => resize(-1))">−</button>
      <button title="Agrandar (tecla +)" @click="press(() => resize(1))">+</button>
      <button title="Pantalla completa (tecla F)" @click="press(toggleFullscreen)">
        ⛶ Pantalla completa
      </button>
    </div>

    <p class="hint">
      <kbd>+</kbd> / <kbd>−</kbd> tamaño · <kbd>F</kbd> pantalla completa
    </p>
  </div>
</template>

<style scoped>
.wrapper { margin: 1rem 0; }

iframe {
  width: 100%;
  height: clamp(460px, 75vh, 720px);
  border: 4px solid #16213e;
  border-radius: 8px;
  background: #000;
}

.toolbar {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 0.6rem;
}
.toolbar button {
  padding: 0.5rem 1rem;
  background: #e94560;
  color: #fff;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
}
.toolbar button:hover { background: #ff5a75; }

.hint { margin: 0.6rem 0 0; font-size: 0.85rem; color: #aaa; }
kbd {
  padding: 0.1rem 0.4rem;
  border: 1px solid #555;
  border-radius: 4px;
  background: #1a1a2e;
  font-family: 'Courier New', monospace;
}
</style>