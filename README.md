# PCFutbol Legacy

Juego de gestion futbolistica inspirado en la etapa clasica de PC Futbol, construido como SPA con React + TypeScript.

## Cómo funciona

**Flujo principal:**
1. **Crear partida** — Elige club (cualquier divisón), nombre de manager y guardado
2. **Pantalla principal** — Accede a: Plantilla, Calendario, Finanzas, Mercado, Club o Jornada
3. **Jugar jornada** — Simula ronda: procesa todos los partidos, gestiona club (entrenamientos, renovaciones, renovales), resuelve ofertas y traspasos
4. **Ver resultado** — Detalle completo del partido: alineaciones, goleadores, incidencias, tácticas
5. **Repetir** — Avanza de ronda hasta ascenso/descenso, cambio de división o fin de temporada

**Arquitectura:**
- **Estado global** — Contexto React (`GameProvider`) gestiona: partida activa, liga simulada, plantilla del manager, ofertas pendientes, historial de finanzas
- **Motor de juego** (`src/engine/`) — Módulos puros para simulación, plantilla, fichajes, persistencia (0 React)
- **Páginas** (`src/pages/`) — UI specific per sección del juego
- **Persistencia** — Guardado automático en `localStorage` + export/import JSON para backups

**Ciclo de persistencia:**
```
GameProvider (estado React) ←→ localStorage (sincronización automática)
                            ↓
                     JSON export/import (backups manuales)
```

## Estado actual

El proyecto es jugable end-to-end en modo carrera y cubre el bucle completo de una temporada: crear partida, gestionar club/plantilla, disputar jornadas, mover mercado, controlar finanzas y cerrar ciclo con ascensos/descensos.

Ademas del guardado automatico en navegador, ya incluye copia de seguridad manual mediante exportacion/importacion de partidas en JSON.

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
  → updateActiveGame(prev → {...prev, leagueState, financeEntries, ...})
    → persistCollection(nextGames) [localStorage + React state]
```

**Módulos principales:**
- `engine/simulation.ts` — Simulador de partidos (stats, goles, incidencias)
- `engine/squad.ts` — Validación y gestión de alineaciones
- `engine/transfers.ts` — Lógica de compra/venta de jugadores
- `engine/club.ts` — Upgrade de staff, tactica, entrenamiento
- `engine/roundProcessing.ts` — Orquestación completa de ronda (extrae duplicación)
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

- Tests unitarios en modulos de motor (`simulation`, `squad`, `transfers`).
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
  data/                # datos semilla y bootstrap de ligas/equipos
  engine/              # lógica pura del juego (0 React)
    ├── simulation.ts   # simulador de partidos, stats, goles, incidencias
    ├── squad.ts        # validación de alineaciones y posiciones
    ├── transfers.ts    # compra/venta de jugadores
    ├── club.ts         # upgrade de staff, tácticas, entrenamientos
    ├── matchPresentation.ts     # construcción de narrativa del partido
    ├── roundProcessing.ts       # orquestación de ronda completa
    ├── purchaseValidation.ts    # validadores de compra
    ├── gameUtils.ts    # utilidades (buildGame, mergeOffers, etc)
    ├── finance.ts      # gestión de presupuesto y libro financiero
    └── persistence.ts  # localStorage e import/export JSON
  pages/               # vistas del juego (Games, Dashboard, Matches, Squad, etc.)
  state/               # GameContext y GameProvider (orquestación del estado)
  types/               # tipos compartidos (Team, Player, LeagueState, etc)
```

## Proximos pasos sugeridos

1. Balance economico mas profundo (sueldos, renovaciones, primas).
2. Evolucion de jugadores y cantera.
3. Eventos de temporada y objetivos de largo plazo.
4. Mas profundidad tactica durante el partido.
5. Mas cobertura de tests en flujos UI/estado.
