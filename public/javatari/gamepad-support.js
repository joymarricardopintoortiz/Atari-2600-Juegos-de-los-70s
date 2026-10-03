/*
 * gamepad-support.js · Capa de compatibilidad de mandos para Javatari
 * =====================================================================
 *
 * El navegador expone los mandos con la "Gamepad API" y, cuando lo sabe,
 * los entrega ya en disposición estándar (Xbox, PS4, PS5, Stadia...).
 * Los mandos antiguos o raros (PS3/Sixaxis, mandos genéricos DInput,
 * adaptadores de mando retro...) llegan con los botones en otro orden:
 * la cruceta puede estar en los botones 4-7, en un eje tipo "hat",
 * o no existir. A esos mandos les va mal cualquier emulador.
 *
 * Esta capa:
 *   1. Normaliza TODOS los mandos a la disposición estándar W3C, para que
 *      el emulador reciba siempre lo mismo haga lo que haga el mando.
 *   2. Traduce el "hat" (cruceta en ejes) a los botones 12-15.
 *   3. Si un mando se desconecta con una tecla pulsada, emite un último
 *      fotograma "suelto" para que el emulador no se quede con teclas
 *      pulsadas (bug típico de los mandos Bluetooth).
 *   4. Expone window.GamepadSupport con el estado en crudo para que la
 *      página pueda mostrar qué mandos hay y probarlos.
 *
 * Sin dependencias y sin tocar javatari.js.
 */
(function () {
  'use strict';

  var VERSION = 1;

  var RELEASED = { pressed: false, value: 0 };
  var PRESSED = { pressed: true, value: 1 };

  var PROFILE_LABELS = {
    standard: 'Mando estándar',
    ds3: 'PlayStation 3',
    ds4raw: 'PlayStation 4',
    dinput: 'Mando genérico',
  };

  /* ------------------------------------------------------------------
   * Tablas: índice ESTÁNDAR -> índice REAL del mando
   * ------------------------------------------------------------------ */

  // PS3 / Sixaxis / DualShock 3. Orden real en HID:
  // 0 Select, 1 L3, 2 R3, 3 Start, 4 Arriba, 5 Derecha, 6 Abajo,
  // 7 Izquierda, 8 L2, 9 R2, 10 L1, 11 R1, 12 Triángulo, 13 Círculo,
  // 14 Cruz, 15 Cuadrado, 16 PS
  var DS3_MAP = [14, 13, 15, 12, 10, 11, 8, 9, 0, 3, 1, 2, 4, 6, 7, 5, 16];

  // DualShock 4 / DualSense sin disposición estándar:
  // 0 Cuadrado, 1 Cruz, 2 Círculo, 3 Triángulo, 4 L1, 5 R1, 6 L2, 7 R2,
  // 8 Share, 9 Options, 10 L3, 11 R3, 12 PS, 13 Touchpad. La cruceta
  // viene en el eje "hat" (-1 = sin pulsar).
  var DS4_MAP = [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, -1, -1, -1, -1, 12];

  // Mando genérico DirectInput / XInput antiguo (8-12 botones):
  // 0 A, 1 B, 2 X, 3 Y, 4 LB, 5 RB, 6 Back, 7 Start, 8 L3, 9 R3.
  // La cruceta viene del eje "hat".
  var DINPUT_MAP = [0, 1, 2, 3, 4, 5, -1, -1, 6, 7, 8, 9, -1, -1, -1, -1];

  var MAPS = { ds3: DS3_MAP, ds4raw: DS4_MAP, dinput: DINPUT_MAP };

  /* ------------------------------------------------------------------
   * Perfil: qué tabla hay que usar para este mando
   * ------------------------------------------------------------------ */
  function detectProfile(pad) {
    if (pad.mapping === 'standard') return 'standard';

    var id = String(pad.id || '').toLowerCase();
    var count = pad.buttons ? pad.buttons.length : 0;

    if (/playstation\(r\)3|sixaxis|dualshock\s*3|\bps3\b/.test(id)) {
      return 'ds3';
    }
    if (/sony|054c|dualshock|dualsense|wireless controller/.test(id)) {
      return count >= 16 ? 'ds3' : 'ds4raw';
    }
    if (count >= 16) return 'standard'; // botonera ya en orden estándar
    return 'dinput';
  }

  var profileCache = Object.create(null);
  function profileFor(pad) {
    var key = pad.index + '|' + pad.id + '|' + (pad.buttons ? pad.buttons.length : 0) + '|' + pad.mapping;
    var hit = profileCache[key];
    if (hit === undefined) {
      hit = detectProfile(pad);
      profileCache[key] = hit;
    }
    return hit;
  }

  /* ------------------------------------------------------------------
   * Hat (cruceta en un eje) -> botones 12-15
   * -1 o 8 = sin pulsar · 0 N · 1 NE · 2 E · 3 SE · 4 S · 5 SW · 6 W · 7 NW
   * Sólo se usa con mandos cuya cruceta NO viene en botones.
   * ------------------------------------------------------------------ */
  function isInteger(v) {
    return typeof v === 'number' && isFinite(v) && Math.abs(v - Math.round(v)) < 1e-6;
  }

  function hatButtons(v) {
    return [
      v === 0 || v === 1 || v === 7, // arriba
      v === 3 || v === 4 || v === 5, // abajo
      v === 5 || v === 6 || v === 7, // izquierda
      v === 1 || v === 2 || v === 3, // derecha
    ];
  }

  // Ejes donde la mayoría de mandos guardan el POV/hat (nunca 0 y 1, que
  // son los sticks principales). Se comprueba cuál de ellos se comporta
  // como hat: enteros siempre y con centro en -1, o llegando a 2..8
  // (un stick nunca pasa de 1).
  var HAT_CANDIDATES = [9, 8, 7, 6, 5, 4, 3, 2];

  var hatState = Object.create(null);

  function hatStat(state, i) {
    var st = state.stats[i];
    if (!st) st = state.stats[i] = { ints: 0, frac: 0, neg: 0, over: 0 };
    return st;
  }

  function looksLikeHat(st) {
    if (st.over > 0) return true; // 2..7 o 8: imposible en un stick
    if (st.frac > 0) return false; // algún decimal: es un stick
    return st.ints >= 15 && st.neg > 0; // siempre entero y centrado en -1
  }

  function readHat(pad, state) {
    var axes = pad.axes || [];

    if (state.axis === null || state.axis === undefined) {
      for (var c = 0; c < HAT_CANDIDATES.length; c++) {
        var i = HAT_CANDIDATES[c];
        if (i >= axes.length) continue;
        var probe = axes[i];
        if (typeof probe !== 'number' || !isFinite(probe)) continue;
        var st = hatStat(state, i);
        if (!isInteger(probe)) {
          st.frac++;
          continue;
        }
        if (probe === -1) st.neg++;
        else if (probe === 8 || probe >= 2) st.over++;
        st.ints++;
        if (looksLikeHat(st)) {
          state.axis = i;
          break;
        }
      }
      if (state.axis === null || state.axis === undefined) return null;
    }

    var v = axes[state.axis];
    if (!isInteger(v) || v < -1 || v > 8) return null;
    return hatButtons(v);
  }

  /* ------------------------------------------------------------------
   * Normalización: mando real -> disposición estándar
   * ------------------------------------------------------------------ */
  function normalize(pad) {
    if (!pad) return null;

    var profile = profileFor(pad);
    if (profile === 'standard') return pad; // ya viene bien, sin copiar

    var map = MAPS[profile];
    var source = pad.buttons || [];
    var out = new Array(18);

    for (var i = 0; i < out.length; i++) {
      var s = i < map.length ? map[i] : -1;
      out[i] = s >= 0 && s < source.length ? source[s] : RELEASED;
    }

    // Sólo si el perfil dice que la cruceta viene en el eje "hat"
    if (profile === 'ds4raw' || profile === 'dinput') {
      var state = hatState[pad.index] || (hatState[pad.index] = { axis: null, stats: {} });
      var hat = readHat(pad, state);
      if (hat) {
        out[12] = hat[0] ? PRESSED : RELEASED;
        out[13] = hat[1] ? PRESSED : RELEASED;
        out[14] = hat[2] ? PRESSED : RELEASED;
        out[15] = hat[3] ? PRESSED : RELEASED;
      }
    }

    var axes = pad.axes ? pad.axes.slice(0) : [];
    while (axes.length < 4) axes.push(0); // evita NaN en el stick del emulador

    return {
      id: pad.id,
      index: pad.index,
      connected: pad.connected !== false,
      timestamp: pad.timestamp,
      mapping: 'standard',
      buttons: out,
      axes: axes,
      __profile: profile,
    };
  }

  function isPressed(np) {
    var buttons = np.buttons || [];
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (b && (b === 1 || b.pressed || b.value > 0.5)) return true;
    }
    var axes = np.axes || [];
    // mismo muerto que usa el emulador (0.3)
    return Math.abs(axes[0] || 0) > 0.3 || Math.abs(axes[1] || 0) > 0.3;
  }

  /* ------------------------------------------------------------------
   * Acceso a la API real del navegador
   * ------------------------------------------------------------------ */
  var rawGetGamepads = null;
  try {
    rawGetGamepads = navigator.getGamepads;
  } catch (e) {
    rawGetGamepads = null;
  }
  var hasAPI = typeof rawGetGamepads === 'function';

  function rawPads() {
    if (!hasAPI) return [];
    try {
      return rawGetGamepads.call(navigator) || [];
    } catch (e) {
      return [];
    }
  }

  /* ------------------------------------------------------------------
   * Parche: lo único que ve el emulador son mandos ya normalizados
   * ------------------------------------------------------------------ */
  var lastState = Object.create(null); // indice -> { pressed: bool, id: string }
  var patched = false;

  function slotOf(pad, fallback) {
    var idx = pad.index;
    return typeof idx === 'number' && idx >= 0 && idx < 64 ? idx : fallback;
  }

  function ghost(index, id) {
    var buttons = new Array(18);
    for (var i = 0; i < buttons.length; i++) buttons[i] = RELEASED;
    return {
      id: id || '',
      index: index,
      connected: false,
      mapping: 'standard',
      timestamp: Date.now(),
      buttons: buttons,
      axes: [0, 0, 0, 0],
      __profile: 'ghost',
    };
  }

  function patchedGetGamepads() {
    var raw = rawPads();
    var out = [];

    for (var i = 0; i < raw.length; i++) {
      var pad = raw[i];
      if (!pad || pad.connected === false) continue;
      var slot = slotOf(pad, i);
      var np = normalize(pad);
      if (!np) continue;
      out[slot] = np;
      lastState[slot] = { pressed: isPressed(np), id: pad.id };
    }

    // Un mando que desaparece con botones/stick pulsados: damos un último
    // fotograma "suelto" para que el emulador libere las teclas.
    for (var key in lastState) {
      if (out[key] === undefined) {
        var was = lastState[key];
        if (was.pressed) out[key] = ghost(Number(key), was.id);
        delete lastState[key];
      }
    }

    return out;
  }

  function installPatch() {
    if (patched || !hasAPI) return patched;
    try {
      navigator.getGamepads = patchedGetGamepads;
      patched = navigator.getGamepads === patchedGetGamepads;
    } catch (e) {
      patched = false;
    }
    if (!patched) {
      try {
        Object.defineProperty(navigator, 'getGamepads', {
          value: patchedGetGamepads,
          configurable: true,
          writable: true,
        });
        patched = true;
      } catch (e2) {
        patched = false;
      }
    }
    if (!patched) {
      try {
        Object.defineProperty(Navigator.prototype, 'getGamepads', {
          value: patchedGetGamepads,
          configurable: true,
          writable: true,
        });
        patched = true;
      } catch (e3) {
        patched = false;
      }
    }
    return patched;
  }

  /* ------------------------------------------------------------------
   * Estado legible para la página (panel de mandos)
   * ------------------------------------------------------------------ */
  function cleanLabel(id) {
    return String(id || '')
      .replace(/^[0-9a-f]{4}-[0-9a-f]{4}\s+/i, '')
      .replace(/\s*\(standard gamepad\)\s*$/i, '')
      .trim();
  }

  function guessConnection(id) {
    id = String(id || '');
    if (/bluetooth/i.test(id)) return 'Bluetooth';
    if (/xbox wireless controller/i.test(id)) return 'Bluetooth';
    if (/(wired|usb|for windows|cable)/i.test(id)) return 'Cable';
    if (/wireless/i.test(id)) return 'Bluetooth o cable';
    return 'Cable o Bluetooth';
  }

  function buttonAt(np, i) {
    var b = (np.buttons || [])[i];
    return !!b && (b === 1 || b.pressed || b.value > 0.5);
  }

  function deviceInfo(pad, player) {
    var np = normalize(pad) || pad;
    var profile = np.__profile || profileFor(pad);
    var ax = np.axes || [];
    var x = ax[0] || 0;
    var y = ax[1] || 0;
    var buttons = [];
    for (var i = 0; i < 18; i++) buttons.push(buttonAt(np, i));

    return {
      index: pad.index,
      id: pad.id || '',
      label: cleanLabel(pad.id) || 'Mando sin nombre',
      profile: profile,
      profileLabel: PROFILE_LABELS[profile] || 'Mando',
      connection: guessConnection(pad.id),
      inferred: true,
      player: player,
      mapping: pad.mapping || '',
      buttons: buttons,
      dpad: {
        up: buttons[12] || y < -0.5,
        down: buttons[13] || y > 0.5,
        left: buttons[14] || x < -0.5,
        right: buttons[15] || x > 0.5,
      },
      axes: [x, y],
    };
  }

  function getDevices() {
    var raw = rawPads();
    var list = [];
    for (var i = 0; i < raw.length; i++) {
      var pad = raw[i];
      if (pad && pad.connected !== false) list.push(pad);
    }
    list.sort(function (a, b) {
      return (a.index || 0) - (b.index || 0);
    });
    // El emulador asigna el primer mando al Jugador 1 y el segundo al 2.
    return list.map(function (pad, i) {
      return deviceInfo(pad, i < 2 ? i + 1 : null);
    });
  }

  /* ------------------------------------------------------------------
   * API pública
   * ------------------------------------------------------------------ */
  // Sólo parcheamos dentro de la página del emulador (tiene #javatari-screen).
  var isEmulatorPage = !!document.getElementById('javatari-screen');
  if (isEmulatorPage) installPatch();

  window.GamepadSupport = {
    version: VERSION,
    supported: hasAPI,
    patched: patched,
    profiles: PROFILE_LABELS,
    getDevices: getDevices,
    normalize: normalize,
    detectProfile: detectProfile,
  };
})();
