import type { Game } from '../types/game'

export const games: Game[] = [
  {
    id: 'pitfall',
    title: 'Pitfall!',
    year: 1982,
    description: 'Explora la selva, salta troncos y esquiva cocodrilos.',
    romUrl: '/roms/pitfall.a26',
    controls: 'Flechas para moverte, Espacio para saltar',
    color: '#2e7d32',
    cover: '/covers/pitfall.jpg',
  },
  {
    id: 'pac-man',
    title: 'Pac-Man',
    year: 1982,
    description: 'Come todos los puntos y huye de los fantasmas.',
    romUrl: '/roms/pac-man.a26',
    controls: 'Flechas para moverte',
    color: '#f9a825',
    cover: '/covers/pac-man.jpg',
  },
  {
    id: 'pitfall-2',
    title: 'Pitfall II: Lost Caverns',
    year: 1984,
    description: 'Recorre las cavernas perdidas en busca del tesoro.',
    romUrl: '/roms/pitfall-2.a26',
    controls: 'Flechas para moverte, Espacio para saltar',
    color: '#6a1b9a',
    cover: '/covers/pitfall-2.jpg',
  },
  {
    id: 'combat',
    title: 'Combat',
    year: 1977,
    description: 'El clásico icónico de tanques y aviones donde te enfrentas cara a cara en diferentes escenarios con laberintos y rebotes.',
    romUrl: '/roms/combat.a26',
    controls: 'J1: flechas + Espacio · J2: W A S D + R · F11 cambia el modo · F12 inicia',
    color: '#b30808',
    cover: '/covers/combat.jpg',
  },
]

export const getGameById = (id: string) => games.find((g) => g.id === id)