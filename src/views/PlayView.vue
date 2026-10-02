<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getGameById } from '../data/games'
import EmulatorScreen from '../components/EmulatorScreen.vue'

const route = useRoute()
const game = computed(() => getGameById(route.params.id as string))
</script>

<template>
  <main class="play">
    <RouterLink to="/" title="Volver al catálogo (tecla Esc)">← Volver al catálogo</RouterLink>
    <template v-if="game">
      <h1>{{ game.title }}</h1>
      <EmulatorScreen :rom-url="game.romUrl" />
      <p>🎮 {{ game.controls }}</p>
    </template>
    <p v-else>Juego no encontrado.</p>
  </main>
</template>

<style scoped>
.play { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; text-align: center; }
a { color: #e94560; }
</style>