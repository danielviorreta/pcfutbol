# PCFutbol Legacy

Juego de gestion futbolistica inspirado en la etapa clasica de PC Futbol, construido como SPA con React + TypeScript.

## Estado actual

El proyecto ya es jugable end-to-end en modo carrera, con guardado local, simulacion de jornadas, gestion de plantilla, economia de club y flujo de partido con previa/resultado.

## Funcionalidades implementadas

- Partidas y guardado:
  - Multiples carreras guardadas en `localStorage`.
  - Crear, cargar, cambiar y eliminar partidas.
  - Nombre de manager y nombre del guardado editables.
- Estructura de competicion:
  - Ligas por divisiones y grupos.
  - Clasificacion, calendario y avance por jornadas.
  - Sistema de ascensos/descensos y vista de promociones.
- Simulacion de partido y jornada:
  - Flujo de `MatchDay`: previa, simulacion y resultado final.
  - Estadisticas del partido (posesion, tiros, ocasiones, asistencia).
  - Cronologia/comentarios, goleadores e incidencias.
  - Impacto de tactica y sustituciones en la simulacion.
- Gestion de plantilla:
  - Once inicial por roles tacticos.
  - Drag & drop directo en la lista para intercambiar jugadores.
  - Mapa tactico visual del once.
  - Indicadores de ajuste posicional (verde/naranja/rojo) y leyendas de roles.
  - Estados de jugador: disponible, lesionado o sancionado.
- Club y mercado:
  - Economia de club (presupuesto, ingresos/gastos base).
  - Mercado de fichajes con operaciones de compra.
  - Persistencia de estado de plantilla y club.

## Stack tecnico

- React 19
- TypeScript 5
- Vite 8
- React Router 7 (`HashRouter`, compatible con GitHub Pages)
- ESLint 9
- Vitest 3

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

## Estructura principal

```text
src/
  components/      # UI reutilizable (tabla, noticias, resultados, escudos)
  data/            # datos semilla y bootstrap de ligas/equipos
  engine/          # logica de simulacion, plantilla, fichajes, persistencia
  pages/           # vistas: games, dashboard, matchday, squad, club, promotions, transfers
  state/           # estado global del modo carrera
  types/           # modelos de dominio
```

## Proximos pasos sugeridos

1. Balance economico mas profundo (sueldos, renovaciones, primas).
2. Evolucion de jugadores y cantera.
3. Eventos de temporada y objetivos de largo plazo.
4. Mas profundidad tactica durante el partido.
5. Mas cobertura de tests en flujos UI/estado.
