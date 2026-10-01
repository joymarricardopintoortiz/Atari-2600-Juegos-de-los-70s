<script setup lang="ts">
import GameCard from '../components/GameCard.vue'
import { games } from '../data/games'
</script>

<template>
  <main class="home">
    <header>
      <h1>🕹️ Atari 2600 Arcade</h1>
      <p>Elige un juego y a jugar. Sin anuncios.</p>
    </header>
    <section class="grid">
      <GameCard v-for="game in games" :key="game.id" :game="game" />
    </section>
  </main>
</template>

<style scoped>
.home { max-width: 1000px; margin: 0 auto; padding: 2rem 1rem; }
header { text-align: center; margin-bottom: 2rem; }
h1 { font-family: 'Courier New', monospace; margin: 0; }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1.5rem;
}
</style>