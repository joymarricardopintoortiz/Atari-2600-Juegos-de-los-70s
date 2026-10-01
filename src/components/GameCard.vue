<script setup lang="ts">
import { ref } from 'vue'
import type { Game } from '../types/game'

defineProps<{ game: Game }>()

// Si la imagen no carga, se muestra el bloque de color con el título
const failed = ref(false)
</script>

<template>
  <RouterLink :to="`/play/${game.id}`" class="card">
    <div class="cover" :style="{ background: game.color }">
      <img
        v-if="game.cover && !failed"
        :src="game.cover"
        :alt="`Portada de ${game.title}`"
        @error="failed = true"
      />
      <span v-else>{{ game.title }}</span>
    </div>
    <div class="info">
      <h3>{{ game.title }}</h3>
      <p>{{ game.description }}</p>
      <small>{{ game.year }}</small>
    </div>
  </RouterLink>
</template>

<style scoped>
.card {
  display: block;
  background: #1a1a2e;
  border: 3px solid #16213e;
  border-radius: 8px;
  overflow: hidden;
  text-decoration: none;
  color: #fff;
  transition: transform 0.15s, border-color 0.15s;
}
.card:hover {
  transform: translateY(-4px);
  border-color: #e94560;
}
.cover {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Courier New', monospace;
  font-size: 1.4rem;
  font-weight: bold;
  text-align: center;
  padding: 0;
  overflow: hidden;
}
.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover; /* cambia a "contain" si no quieres que se recorte */
}
.cover span {
  padding: 0.5rem;
}
.info {
  padding: 0.8rem 1rem 1rem;
}
.info h3 { margin: 0 0 0.4rem; }
.info p { margin: 0 0 0.6rem; font-size: 0.9rem; color: #bbb; }
.info small { color: #e94560; }
</style>