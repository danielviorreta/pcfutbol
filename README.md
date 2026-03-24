# PCFutbol Legacy

Project inspired by the spirit of PC Futbol 4.0 with a playable manager loop.

## Implemented features

  - Dashboard
  - Squad management
  - Transfer market
- Multiple saved careers with active-game switching.
- New career creation with manager name, save name, and club selection.

## Stack

- React 19
- TypeScript
- Vite

## Run locally

```bash
npm install
npm run dev
```

Build production bundle:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

## Project structure

```text
src/
  components/
    LeagueTable.tsx
    NewsList.tsx
    ResultsList.tsx
  data/
    seedData.ts        # teams, squads and fixture generation
  engine/
    persistence.ts     # save/load helpers
    simulation.ts      # round simulation and standings
    squad.ts           # lineup helpers and ratings
    transfers.ts       # transfer market operations
  pages/
    DashboardPage.tsx
    SquadPage.tsx
    TransfersPage.tsx
  state/
    gameState.tsx      # global manager game state
  types/
    game.ts            # domain models
  App.tsx              # routed shell
  main.tsx             # router + provider bootstrap
```

## Suggested next milestones

1. Injuries, suspensions and fatigue accumulation.
2. Contract renewals, wages and sponsor objectives.
3. Training plans and youth academy.
4. Domestic cup and European competitions.
5. Historic stats and season records.
