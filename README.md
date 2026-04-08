# PCFutbol Legacy

Juego de gestion futbolistica inspirado en la etapa clasica de PC Futbol, construido como SPA con React + TypeScript.

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
  pages/           # vistas: games, dashboard, calendar, finances, matchday, squad, club, promotions, transfers
  state/           # estado global del modo carrera
  types/           # modelos de dominio
```

## Proximos pasos sugeridos

1. Balance economico mas profundo (sueldos, renovaciones, primas).
2. Evolucion de jugadores y cantera.
3. Eventos de temporada y objetivos de largo plazo.
4. Mas profundidad tactica durante el partido.
5. Mas cobertura de tests en flujos UI/estado.
