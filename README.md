# PCFutbol Legacy

Juego de gestión futbolística inspirado en la etapa clásica de PC Fútbol, construido como SPA con React + TypeScript.

**Jugar:** https://danielviorreta.github.io/pcfutbol/

**Temporada:** 2026-27 — Primera (20), Segunda (22) y Primera Federación (2 grupos de 20), con plantillas reales.

## Cómo funciona

**Flujo principal:**
1. **Crear partida** — Elige club (cualquier división), nombre de manager y guardado
2. **Pantalla principal** — Accede a: Plantilla, Calendario, Finanzas, Mercado, Club o Jornada
3. **Jugar jornada** — Simula ronda: procesa todos los partidos, gestiona club (entrenamientos, renovaciones, cantera), resuelve ofertas y traspasos
4. **Ver resultado** — Detalle completo del partido: alineaciones, goleadores, incidencias, tácticas
5. **Repetir** — Avanza de ronda hasta ascenso/descenso, cambio de división o fin de temporada

**Arquitectura:**
- **Estado global** — Contexto React (`GameProvider`) gestiona: partida activa, liga simulada, plantilla del manager, ofertas pendientes, historial de finanzas
- **Acciones** (`src/state/gameActions.ts`) — Funciones puras `(partida, ...args) → { partida, aviso }`; el provider solo muestra el aviso y guarda si algo cambió
- **Motor de juego** (`src/engine/`) — Módulos puros para simulación, plantilla, fichajes, persistencia (0 React)
- **Páginas** (`src/pages/`) — UI específica de cada sección del juego
- **Persistencia** — Guardado automático en `localStorage` (una clave por partida) + export/import JSON para backups
- **Aleatoriedad con semilla** — Toda la simulación usa `engine/random.ts`; cada partida guarda su semilla, así que una jornada es reproducible

**Ciclo de persistencia:**
```
GameProvider (estado React) ←→ localStorage (índice + una clave por partida)
                            ↓
                     JSON export/import (backups manuales)
```

## Estado actual

El proyecto es jugable end-to-end en modo carrera y cubre el bucle completo de una temporada: crear partida, gestionar club/plantilla, disputar jornadas, mover mercado, controlar finanzas y cerrar ciclo con ascensos/descensos.

Además del guardado automático en navegador, ya incluye copia de seguridad manual mediante exportacion/importacion de partidas en JSON.

## Funcionalidades implementadas

- Partidas y guardado:
  - Multiples carreras guardadas en `localStorage`.
  - Crear, cargar, cambiar y eliminar partidas.
  - Nombre de manager y nombre del guardado editables.
  - Guardado automatico al avanzar y accion de guardado manual.
  - Exportar todas las partidas a JSON e importar copias locales (backup/restore).
- Estructura de competicion:
  - Ligas por divisiones y grupos (Primera, Segunda y Primera Federacion).
  - Clasificacion, calendario y avance por jornadas.
  - Sistema de ascensos/descensos y vista de promociones.
  - Estadisticas de temporada (partidos, goles, asistencias), tablas de goleadores y asistentes, e historial de temporadas (campeones, pichichis, ascensos/descensos y tu posicion).
- Simulacion de partido y jornada:
  - Flujo de `MatchDay`: previa, simulacion y resultado final.
  - Estadisticas del partido (posesion, tiros, ocasiones, asistencia).
  - Cronologia/comentarios, goleadores e incidencias.
  - Impacto de tactica y sustituciones en la simulacion.
  - Gestion de cansancio, lesiones/sanciones y noticias semanales.
- Gestion de plantilla:
  - Once inicial por roles tacticos.
  - Drag & drop directo en la lista para intercambiar jugadores.
  - Mapa tactico visual del once.
  - Indicadores de ajuste posicional (verde/naranja/rojo) y leyendas de roles.
  - Estados de jugador: disponible, lesionado o sancionado.
  - Renovaciones de contrato, rol prometido y promocion de cantera.
  - Fin de temporada: los jugadores cumplen años, progresan o declinan con la edad, los contratos vencen (agentes libres), los veteranos se retiran y las plantillas se completan con la cantera.
- Club y mercado:
  - Economia de club con libro financiero por categorias (sponsor, taquilla, salarios, fichajes, staff, infraestructura).
  - Ajustes de club: tactica, foco de entrenamiento y precio de entradas.
  - Mejoras de estadio y staff (medico y disciplina).
  - Mercado de fichajes con listado de transferibles, compra/venta y ofertas entrantes/salientes.
  - Persistencia completa del estado de carrera.

## Arquitectura técnica

**Capas y responsabilidades:**

```
┌─────────────────────────────┐
│    React Components (UI)    │  pages/*   Vistas específicas del juego
│  + GameContext Provider     │  components/   UI reutilizable
└──────────────┬──────────────┘
               │ setState/dispatch
               ↓
┌─────────────────────────────┐
│ Validation & Orchestration  │  purchaseValidation, staffUpgrades, roundProcessing
│ (Pure, composable logic)    │  Se ejecuta en la acción → actualiza gameState
└──────────────┬──────────────┘
               │ Función pura
               ↓
┌─────────────────────────────┐
│  Domain Logic / Simulation  │  engine/simulation, squad, transfers, club, etc.
│  (0 React, 100% testeable)  │  Transforma LeagueState → LeagueState
└─────────────────────────────┘
```

**Flujo de datos (ejemplo: jugar ronda)**
```
UI click "Jugar jornada"
  → gameState.playRound()
    → processRound(game, lineup)
      → playCurrentRound() [simula partidos]
      → applyWeeklyClubManagement() [procesa ofertas]
      → resolveRenewalOffers() [resuelve renovaciones]
      → buyPlayer() x N [resuelve transferencias salientes]
    ← RoundProcessingResult {nextLeagueState, financeEntries, ...}
  → applyRoundResult(game, result) [nueva partida + semilla]
  → updateActiveGame(...)
    → persistCollection(nextGames) [guarda solo las partidas que cambiaron]
```

**Módulos principales:**
- `engine/simulation.ts` — Simulador de partidos (stats, goles, incidencias)
- `engine/squad.ts` — Validación y gestión de alineaciones
- `engine/transfers.ts` — Lógica de compra/venta de jugadores
- `engine/club/` — Gestión semanal, entrenamiento, ascensos/descensos y playoffs, staff/estadio, renovaciones y cantera
- `engine/roundProcessing.ts` — Orquestación completa de ronda
- `engine/random.ts` — Generador aleatorio con semilla
- `engine/fixtures.ts` — Calendario (liga a doble vuelta)
- `engine/purchaseValidation.ts` — Validaciones de compra (modular e independiente)


## Stack y decisiones

**Stack técnico:**
- React 19 (context API para estado global, sin Redux por simplicidad)
- TypeScript 5 (strict mode para catching bugs temprano)
- Vite 8 (fast refresh + dev server)
- React Router 7 (HashRouter para GitHub Pages)
- Vitest 3 (tests unitarios de engine modules)

**Decisiones clave:**
- **Sin external state management** — Context API suficiente para complejidad actual
- **Lógica de dominio desacoplada de React** — `src/engine/` es 100% funcional/pura, fácil de testear sin React
- **Persistencia con localStorage** — Fácil, offline-first. JSON export/import para backups manuales
- **Validación centralizada** — Cada acción delega a validadores especializados (e.g., `purchaseValidation.ts`)
- **Modularización progresiva** — A medida que `gameState.tsx` crecía (era 1582 líneas), se extraían módulos (`roundProcessing`, `staffUpgrades`, `matchPresentation`)

## Scripts

```bash
npm install
npm run dev       # entorno local
npm run lint      # analisis estatico
npm run test      # tests en watch
npm run test:run  # tests en una pasada
npm run build     # build de produccion
npm run preview   # preview del build
```

## Calidad y CI

- Tests unitarios del motor (`simulation`, `squad`, `transfers`, `finance`, `persistence`, `random`, ascensos/descensos), de las acciones y una temporada completa simulada.
- Workflow de PR con comprobaciones de lint, test y build.
- Workflow de despliegue a GitHub Pages.

## Despliegue

- Build preparado para subruta `/pcfutbol/`.
- Deploy automatico con GitHub Actions (`deploy-pages.yml`).
- Requiere activar GitHub Pages con fuente `GitHub Actions` en la configuracion del repositorio.

## Estructura de archivos

```
src/
  components/           # UI reutilizable (tabla, noticias, resultados, escudos)
  data/                # season-2026-27.json (equipos y plantillas) + seedData.ts (genera la liga)
  engine/              # lógica pura del juego (0 React)
    ├── simulation.ts   # simulador de partidos, stats, goles, incidencias
    ├── squad.ts        # validación de alineaciones y posiciones
    ├── transfers.ts    # compra/venta de jugadores
    ├── club/           # gestión semanal, entrenamiento, ascensos, staff, renovaciones, cantera
    ├── random.ts       # aleatoriedad con semilla
    ├── fixtures.ts     # generación del calendario
    ├── matchPresentation.ts     # construcción de narrativa del partido
    ├── roundProcessing.ts       # orquestación de ronda completa
    ├── purchaseValidation.ts    # validadores de compra
    ├── gameUtils.ts    # utilidades (buildGame, mergeOffers, etc)
    ├── finance.ts      # gestión de presupuesto y libro financiero
    └── persistence.ts  # localStorage e import/export JSON
  pages/               # vistas del juego (Games, Dashboard, Matches, Squad, etc.)
  state/               # GameProvider + gameActions (acciones puras)
  types/               # tipos compartidos (Team, Player, LeagueState, etc)
```

## Actualizar la temporada

Los equipos y plantillas viven en `src/data/season-2026-27.json` (un equipo por línea). Cada equipo tiene 22 jugadores en este orden de huecos: once titular (POR, 4 DEF, 3 MED, 3 DEL) y banquillo (POR, 4 DEF, 4 MED, 2 DEL). Edad y media (`overall`) son estimaciones. Para una nueva temporada basta con sustituir el JSON y cambiar la importación en `seedData.ts`; las partidas guardadas conservan sus datos.

## Próximos pasos sugeridos

1. Balance economico mas profundo (sueldos, renovaciones, primas).
2. Evolucion de jugadores y cantera.
3. Eventos de temporada y objetivos de largo plazo.
4. Mas profundidad tactica durante el partido.
5. Mas cobertura de tests en flujos UI/estado.
