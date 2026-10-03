/**
 * Estado de los mandos expuesto por public/javatari/gamepad-support.js
 * (se carga tanto dentro del iframe del emulador como en la página).
 */

export interface PadDpad {
  up: boolean
  down: boolean
  left: boolean
  right: boolean
}

export interface PadDevice {
  /** Índice del mando en el navegador */
  index: number
  /** Identificador crudo que da el navegador */
  id: string
  /** Nombre legible (sin prefijos raros) */
  label: string
  /** Perfil de mapeo usado: standard | ds3 | ds4raw | dinput */
  profile: string
  /** Nombre del perfil en español */
  profileLabel: string
  /** Cable o Bluetooth (inferido: el navegador no lo expone) */
  connection: string
  inferred: boolean
  /** Jugador al que lo asigna el emulador (1 u 2), o null si sobra */
  player: number | null
  /** mapping del navegador: "standard" o vacío */
  mapping: string
  /** Botones ya normalizados a la disposición estándar (18) */
  buttons: boolean[]
  /** Cruceta resultante (botones o stick) */
  dpad: PadDpad
  /** Stick izquierdo: [x, y] */
  axes: number[]
}

export interface GamepadSupportApi {
  version: number
  /** false si el navegador no tiene Gamepad API */
  supported: boolean
  /** true si el iframe del emulador recibe mandos normalizados */
  patched: boolean
  profiles: Record<string, string>
  getDevices(): PadDevice[]
}

declare global {
  interface Window {
    GamepadSupport?: GamepadSupportApi
  }
}
