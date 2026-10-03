<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ControllerPanel from './ControllerPanel.vue'

const props = defineProps<{ romUrl: string }>()
const router = useRouter()

// Parte de la API interna de Javatari que usamos
type Monitor = {
  displayScaleIncrease(): void
  displayScaleDecrease(): void
  fullscreenToggle(): void
}
type JavatariWindow = Window & {
  Javatari?: { room?: { screen?: { getMonitor(): Monitor } } }
}
// Prefijos antiguos de la API de pantalla completa
type FullscreenDocument = Document & { webkitFullscreenElement?: Element | null }

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

const frameDoc = (): Document | null => frame.value?.contentDocument ?? null

// Pantalla completa nativa (la que hace el navegador con F11 o la API Fullscreen)
const nativeFullscreenElement = (): Element | null => {
  for (const doc of [document, frameDoc()]) {
    if (!doc) continue
    const fd = doc as FullscreenDocument
    const el = fd.fullscreenElement ?? fd.webkitFullscreenElement ?? null
    if (el) return el
  }
  return null
}

// Pantalla completa "de Javatari" (clase que él mismo pone en su <html>)
const isEmulatorFullscreen = () =>
  frameDoc()?.documentElement.classList.contains('jt-full-screen') ?? false

// La Esc con la que el navegador salió de pantalla completa no debe
// llevarnos al catálogo: esa Esc ya fue "gastada" por el navegador
let fullscreenExitedAt = 0
const ESCAPE_GRACE_MS = 400
const onFullscreenChange = () => {
  if (!nativeFullscreenElement()) fullscreenExitedAt = Date.now()
}

// Esc: en pantalla completa primero se vuelve a la normal, después al catálogo
const handleEscape = (e: KeyboardEvent) => {
  // El navegador se encarga de salir de pantalla completa con esta misma Esc
  if (nativeFullscreenElement()) return
  if (Date.now() - fullscreenExitedAt < ESCAPE_GRACE_MS) return

  // Fullscreen sin API nativa (ej. iOS): la primera Esc devuelve a la normal
  if (isEmulatorFullscreen()) {
    toggleFullscreen()
    e.preventDefault()
    e.stopPropagation()
    return
  }

  // Ya en pantalla normal: volver al catálogo
  e.preventDefault()
  e.stopPropagation()
  router.push('/')
}

const focusGame = () => frameWindow?.focus()

// Para los botones: ejecuta la acción y devuelve el foco al juego
const press = (action: () => void) => {
  action()
  focusGame()
}

// Atajos: + agrandar · - achicar · F3 pantalla completa · Esc volver al catálogo
const onKey = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.altKey || e.metaKey) return

  if (e.key === 'Escape') {
    handleEscape(e)
    return
  }

  let handled = true
  if (e.key === '+' || e.key === '=') resize(1)
  else if (e.key === '-' || e.key === '_') resize(-1)
  else if (e.key === 'F3') {
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
  frameWindow?.addEventListener('fullscreenchange', onFullscreenChange)
  frameWindow?.addEventListener('webkitfullscreenchange', onFullscreenChange)
  focusGame()
}

// Y cuando el foco está fuera del juego (en la página de Vue)
onMounted(() => {
  window.addEventListener('keydown', onKey, true)
  window.addEventListener('fullscreenchange', onFullscreenChange)
  window.addEventListener('webkitfullscreenchange', onFullscreenChange)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey, true)
  window.removeEventListener('fullscreenchange', onFullscreenChange)
  window.removeEventListener('webkitfullscreenchange', onFullscreenChange)
  frameWindow?.removeEventListener('keydown', onKey, true)
  frameWindow?.removeEventListener('fullscreenchange', onFullscreenChange)
  frameWindow?.removeEventListener('webkitfullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div class="wrapper">
    <iframe
      ref="frame"
      :key="romUrl"
      :src="src"
      allow="autoplay; fullscreen; gamepad"
      allowfullscreen
      @load="onLoad"
    />

    <div class="toolbar">
      <button title="Achicar (tecla -)" @click="press(() => resize(-1))">−</button>
      <button title="Agrandar (tecla +)" @click="press(() => resize(1))">+</button>
      <button title="Pantalla completa (tecla F3)" @click="press(toggleFullscreen)">
        ⛶ Pantalla completa
      </button>
    </div>

    <ControllerPanel :frame="frame" />

    <p class="hint">
      <kbd>+</kbd> / <kbd>−</kbd> tamaño · <kbd>F3</kbd> pantalla completa ·
      <kbd>Esc</kbd> volver al catálogo
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