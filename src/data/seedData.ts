import type {
  LeagueState,
  Player,
  Position,
  RolePosition,
  Tactic,
  Team,
  TrainingFocus,
  YouthPlayer,
} from '../types/game'

type TeamSeed = Omit<
  Team,
  | 'points'
  | 'played'
  | 'wins'
  | 'draws'
  | 'losses'
  | 'goalsFor'
  | 'goalsAgainst'
  | 'players'
  | 'youthPlayers'
  | 'sponsor'
  | 'staff'
  | 'tactic'
  | 'trainingFocus'
>

const baseTeams: TeamSeed[] = [
  {
    id: 'rma',
    name: 'Real Madrid',
    crestUrl: 'https://icons.duckduckgo.com/ip3/realmadrid.com.ico',
    stadium: { name: 'Santiago Bernabéu', capacity: 81_044, ticketPrice: 70 },
    budget: 110_000_000,
    morale: 83,
    attack: 91,
    midfield: 89,
    defense: 88,
  },
  {
    id: 'bar',
    name: 'FC Barcelona',
    crestUrl: 'https://icons.duckduckgo.com/ip3/fcbarcelona.com.ico',
    stadium: { name: 'Spotify Camp Nou', capacity: 99_354, ticketPrice: 75 },
    budget: 98_000_000,
    morale: 80,
    attack: 88,
    midfield: 90,
    defense: 83,
  },
  {
    id: 'atm',
    name: 'Atletico Madrid',
    crestUrl: 'https://icons.duckduckgo.com/ip3/atleticodemadrid.com.ico',
    stadium: { name: 'Cívitas Metropolitano', capacity: 68_456, ticketPrice: 55 },
    budget: 86_000_000,
    morale: 79,
    attack: 85,
    midfield: 84,
    defense: 86,
  },
  {
    id: 'ath',
    name: 'Athletic Club',
    crestUrl: 'https://icons.duckduckgo.com/ip3/athletic-club.eus.ico',
    stadium: { name: 'San Mamés', capacity: 53_289, ticketPrice: 50 },
    budget: 62_000_000,
    morale: 77,
    attack: 80,
    midfield: 80,
    defense: 82,
  },
  {
    id: 'bet',
    name: 'Real Betis',
    crestUrl: 'https://icons.duckduckgo.com/ip3/realbetisbalompie.es.ico',
    stadium: { name: 'Estadio Benito Villamarín', capacity: 60_721, ticketPrice: 45 },
    budget: 56_000_000,
    morale: 74,
    attack: 79,
    midfield: 78,
    defense: 76,
  },
  {
    id: 'cel',
    name: 'Celta Vigo',
    crestUrl: 'https://icons.duckduckgo.com/ip3/rccelta.es.ico',
    stadium: { name: 'Abanca-Balaídos', capacity: 29_000, ticketPrice: 35 },
    budget: 45_000_000,
    morale: 70,
    attack: 75,
    midfield: 74,
    defense: 72,
  },
  {
    id: 'get',
    name: 'Getafe CF',
    crestUrl: 'https://icons.duckduckgo.com/ip3/getafecf.com.ico',
    stadium: { name: 'Coliseum', capacity: 17_393, ticketPrice: 30 },
    budget: 41_000_000,
    morale: 71,
    attack: 72,
    midfield: 73,
    defense: 75,
  },
  {
    id: 'gir',
    name: 'Girona FC',
    crestUrl: 'https://icons.duckduckgo.com/ip3/gironafc.cat.ico',
    stadium: { name: 'Estadi Montilivi', capacity: 13_450, ticketPrice: 32 },
    budget: 49_000_000,
    morale: 76,
    attack: 81,
    midfield: 79,
    defense: 74,
  },
  {
    id: 'lpa',
    name: 'UD Las Palmas',
    crestUrl: 'https://icons.duckduckgo.com/ip3/udlaspalmas.es.ico',
    stadium: { name: 'Gran Canaria Stadium', capacity: 32_400, ticketPrice: 30 },
    budget: 37_000_000,
    morale: 69,
    attack: 71,
    midfield: 72,
    defense: 71,
  },
  {
    id: 'mal',
    name: 'RCD Mallorca',
    crestUrl: 'https://icons.duckduckgo.com/ip3/rcdmallorca.es.ico',
    stadium: { name: 'Son Moix', capacity: 23_142, ticketPrice: 32 },
    budget: 39_000_000,
    morale: 70,
    attack: 72,
    midfield: 72,
    defense: 74,
  },
  {
    id: 'osa',
    name: 'CA Osasuna',
    crestUrl: 'https://icons.duckduckgo.com/ip3/osasuna.es.ico',
    stadium: { name: 'El Sadar', capacity: 23_576, ticketPrice: 30 },
    budget: 42_000_000,
    morale: 72,
    attack: 74,
    midfield: 75,
    defense: 75,
  },
  {
    id: 'ray',
    name: 'Rayo Vallecano',
    crestUrl: 'https://icons.duckduckgo.com/ip3/rayovallecano.es.ico',
    stadium: { name: 'Campo de Fútbol de Vallecas', capacity: 14_708, ticketPrice: 28 },
    budget: 36_000_000,
    morale: 69,
    attack: 71,
    midfield: 73,
    defense: 72,
  },
  {
    id: 'rso',
    name: 'Real Sociedad',
    crestUrl: 'https://icons.duckduckgo.com/ip3/realsociedad.eus.ico',
    stadium: { name: 'Reale Arena', capacity: 39_500, ticketPrice: 42 },
    budget: 58_000_000,
    morale: 76,
    attack: 79,
    midfield: 82,
    defense: 81,
  },
  {
    id: 'sev',
    name: 'Sevilla FC',
    crestUrl: 'https://icons.duckduckgo.com/ip3/sevillafc.es.ico',
    stadium: { name: 'Estadio Ramón Sánchez-Pizjuán', capacity: 43_883, ticketPrice: 45 },
    budget: 50_000_000,
    morale: 72,
    attack: 76,
    midfield: 76,
    defense: 75,
  },
  {
    id: 'val',
    name: 'Valencia CF',
    crestUrl: 'https://icons.duckduckgo.com/ip3/valenciacf.com.ico',
    stadium: { name: 'Mestalla', capacity: 49_430, ticketPrice: 40 },
    budget: 53_000_000,
    morale: 73,
    attack: 77,
    midfield: 76,
    defense: 77,
  },
  {
    id: 'vil',
    name: 'Villarreal CF',
    crestUrl: 'https://icons.duckduckgo.com/ip3/villarrealcf.es.ico',
    stadium: { name: 'Estadio de la Cerámica', capacity: 23_500, ticketPrice: 38 },
    budget: 57_000_000,
    morale: 74,
    attack: 80,
    midfield: 79,
    defense: 76,
  },
  {
    id: 'ala',
    name: 'Deportivo Alaves',
    crestUrl: 'https://icons.duckduckgo.com/ip3/deportivoalaves.com.ico',
    stadium: { name: 'Mendizorroza', capacity: 19_840, ticketPrice: 28 },
    budget: 35_000_000,
    morale: 69,
    attack: 70,
    midfield: 71,
    defense: 73,
  },
  {
    id: 'cad',
    name: 'Cadiz CF',
    crestUrl: 'https://icons.duckduckgo.com/ip3/cadizcf.com.ico',
    stadium: { name: 'Nuevo Mirandilla', capacity: 20_724, ticketPrice: 25 },
    budget: 33_000_000,
    morale: 67,
    attack: 68,
    midfield: 69,
    defense: 70,
  },
  {
    id: 'alm',
    name: 'UD Almeria',
    crestUrl: 'https://icons.duckduckgo.com/ip3/udalmeriasad.com.ico',
    stadium: { name: 'Power Horse Stadium', capacity: 22_000, ticketPrice: 25 },
    budget: 34_000_000,
    morale: 67,
    attack: 69,
    midfield: 70,
    defense: 68,
  },
  {
    id: 'gra',
    name: 'Granada CF',
    crestUrl: 'https://icons.duckduckgo.com/ip3/granadacf.es.ico',
    stadium: { name: 'Estadio Nuevo Los Cármenes', capacity: 19_336, ticketPrice: 25 },
    budget: 34_000_000,
    morale: 68,
    attack: 70,
    midfield: 70,
    defense: 69,
  },
]

const trainingFocusCycle: TrainingFocus[] = ['fitness', 'attack', 'midfield', 'defense']
const tacticCycle: Tactic[] = ['4-3-3', '4-4-2', '5-4-1']

const firstNames = [
  'Iker', 'Raul', 'Pablo', 'Luis', 'Fernando', 'Miguel', 'Javier', 'Sergio', 'Diego',
  'Alvaro', 'Juan', 'Dani', 'Ruben', 'Victor', 'Cesar', 'Hector', 'Marcos', 'Ivan',
]

const lastNames = [
  'Sanchez',
  'Lopez',
  'Martin',
  'Molina',
  'Pardo',
  'Nieto',
  'Costa',
  'Torres',
  'Salas',
  'Varela',
  'Rios',
  'Nadal',
  'Campos',
  'Herrera',
  'Suarez',
  'Romero',
  'Gil',
  'Arenas',
]

const sponsors = [
  'Telefonia Nova',
  'Banco Iberico',
  'Astur Cola',
  'Viajes Orbe',
  'MotorEuropa',
  'Construcciones Arce',
  'Seguros Brio',
  'MetalSur',
]

const squadShape = [
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'FWD',
  'FWD',
  'FWD',
  'GK',
  'DEF',
  'DEF',
  'DEF',
  'DEF',
  'MID',
  'MID',
  'MID',
  'MID',
  'FWD',
  'FWD',
] as const

type RosterEntry = { name: string; position: Position }

const rolePools: Record<Position, RolePosition[]> = {
  GK: ['GK'],
  DEF: ['RB', 'CB', 'CB', 'LB', 'RWB', 'LWB'],
  MID: ['DM', 'CM', 'CM', 'AM', 'RM', 'LM'],
  FWD: ['RW', 'LW', 'ST', 'CF'],
}

const secondaryRolesByPrimary: Record<RolePosition, RolePosition[]> = {
  GK: ['GK'],
  RB: ['RWB', 'LB'],
  CB: ['DM'],
  LB: ['LWB', 'RB'],
  RWB: ['RB', 'RM'],
  LWB: ['LB', 'LM'],
  DM: ['CM', 'CB'],
  CM: ['DM', 'AM'],
  AM: ['CM', 'CF'],
  RM: ['RW', 'CM'],
  LM: ['LW', 'CM'],
  RW: ['RM', 'CF'],
  LW: ['LM', 'CF'],
  CF: ['ST', 'AM'],
  ST: ['CF', 'RW'],
}

function inferNaturalPositions(basePosition: Position, playerIndex: number): RolePosition[] {
  const pool = rolePools[basePosition]
  const primary = pool[playerIndex % pool.length]

  if (basePosition === 'GK') {
    return ['GK']
  }

  const secondary = secondaryRolesByPrimary[primary][0]
  return secondary ? [primary, secondary] : [primary]
}

const playerOverallOverrides: Record<string, number> = {
  'Kylian Mbappe': 91,
  'Vinicius Junior': 90,
  'Jude Bellingham': 90,
  'Thibaut Courtois': 89,
  'Federico Valverde': 88,
  'Rodrygo': 87,
  'Aurelien Tchouameni': 86,
  'Eduardo Camavinga': 86,
  'Antonio Rudiger': 87,
  'Eder Militao': 86,
  'Ferland Mendy': 82,
  'Dani Carvajal': 84,
  'David Alaba': 84,
  'Luka Modric': 85,
  'Robert Lewandowski': 88,
  'Lamine Yamal': 86,
  Raphinha: 85,
  Pedri: 87,
  Gavi: 84,
  'Frenkie de Jong': 87,
  'Marc-Andre ter Stegen': 88,
  'Ronald Araujo': 86,
  'Jules Kounde': 85,
  'Dani Olmo': 84,
  'Jan Oblak': 88,
  'Antoine Griezmann': 88,
  'Julian Alvarez': 85,
  'Rodrigo De Paul': 84,
  Koke: 83,
  'Marcos Llorente': 84,
  'Jose Maria Gimenez': 85,
  'Robin Le Normand': 84,
  'Nico Williams': 86,
  'Inaki Williams': 84,
  'Unai Simon': 85,
  'Oihan Sancet': 83,
  'Alex Berenguer': 81,
  Isco: 84,
  'Ayoze Perez': 83,
  'Giovani Lo Celso': 83,
  'Pablo Fornals': 80,
  'Johnny Cardoso': 80,
  'Iago Aspas': 83,
  'Borja Iglesias': 78,
  'Djene Dakonam': 81,
  'Borja Mayoral': 82,
  'Luis Milla': 81,
  'Artem Dovbyk': 84,
  Savio: 82,
  'Aleix Garcia': 82,
  'Yangel Herrera': 81,
  'Sergi Darder': 81,
  'Vedat Muriqi': 80,
  'Ante Budimir': 82,
  'Mikel Oyarzabal': 84,
  'Martin Zubimendi': 85,
  'Mikel Merino': 84,
  'Takefusa Kubo': 83,
  'Sergio Ramos': 81,
  'Youssef En-Nesyri': 81,
  'Lucas Ocampos': 81,
  'Giorgi Mamardashvili': 84,
  'Jose Gaya': 82,
  Pepelu: 80,
  'Hugo Duro': 79,
  'Gerard Moreno': 84,
  'Dani Parejo': 83,
  'Alex Baena': 82,
  'Yeremy Pino': 80,
  'Raul Albiol': 78,
  'Conan Ledesma': 80,
  'Raul de Tomas': 79,
  'Lucas Boye': 78,
  'Myrto Uzuni': 79,
}

const teamRosters: Record<string, RosterEntry[]> = {
  rma: [
    { name: 'Thibaut Courtois', position: 'GK' },
    { name: 'Andriy Lunin', position: 'GK' },
    { name: 'Dani Carvajal', position: 'DEF' },
    { name: 'Antonio Rudiger', position: 'DEF' },
    { name: 'Eder Militao', position: 'DEF' },
    { name: 'David Alaba', position: 'DEF' },
    { name: 'Ferland Mendy', position: 'DEF' },
    { name: 'Federico Valverde', position: 'MID' },
    { name: 'Aurelien Tchouameni', position: 'MID' },
    { name: 'Eduardo Camavinga', position: 'MID' },
    { name: 'Jude Bellingham', position: 'MID' },
    { name: 'Luka Modric', position: 'MID' },
    { name: 'Vinicius Junior', position: 'FWD' },
    { name: 'Rodrygo', position: 'FWD' },
    { name: 'Kylian Mbappe', position: 'FWD' },
    { name: 'Endrick', position: 'FWD' },
  ],
  bar: [
    { name: 'Marc-Andre ter Stegen', position: 'GK' },
    { name: 'Inaki Pena', position: 'GK' },
    { name: 'Jules Kounde', position: 'DEF' },
    { name: 'Ronald Araujo', position: 'DEF' },
    { name: 'Pau Cubarsi', position: 'DEF' },
    { name: 'Inigo Martinez', position: 'DEF' },
    { name: 'Alejandro Balde', position: 'DEF' },
    { name: 'Pedri', position: 'MID' },
    { name: 'Gavi', position: 'MID' },
    { name: 'Frenkie de Jong', position: 'MID' },
    { name: 'Dani Olmo', position: 'MID' },
    { name: 'Fermin Lopez', position: 'MID' },
    { name: 'Lamine Yamal', position: 'FWD' },
    { name: 'Raphinha', position: 'FWD' },
    { name: 'Robert Lewandowski', position: 'FWD' },
    { name: 'Ferran Torres', position: 'FWD' },
  ],
  atm: [
    { name: 'Jan Oblak', position: 'GK' },
    { name: 'Horatiu Moldovan', position: 'GK' },
    { name: 'Nahuel Molina', position: 'DEF' },
    { name: 'Jose Maria Gimenez', position: 'DEF' },
    { name: 'Robin Le Normand', position: 'DEF' },
    { name: 'Clement Lenglet', position: 'DEF' },
    { name: 'Reinildo Mandava', position: 'DEF' },
    { name: 'Rodrigo De Paul', position: 'MID' },
    { name: 'Koke', position: 'MID' },
    { name: 'Pablo Barrios', position: 'MID' },
    { name: 'Conor Gallagher', position: 'MID' },
    { name: 'Marcos Llorente', position: 'MID' },
    { name: 'Antoine Griezmann', position: 'FWD' },
    { name: 'Julian Alvarez', position: 'FWD' },
    { name: 'Alexander Sorloth', position: 'FWD' },
    { name: 'Angel Correa', position: 'FWD' },
  ],
  ath: [
    { name: 'Unai Simon', position: 'GK' },
    { name: 'Julen Agirrezabala', position: 'GK' },
    { name: 'Dani Vivian', position: 'DEF' },
    { name: 'Yeray Alvarez', position: 'DEF' },
    { name: 'Aitor Paredes', position: 'DEF' },
    { name: 'Yuri Berchiche', position: 'DEF' },
    { name: 'Oscar de Marcos', position: 'DEF' },
    { name: 'Inigo Ruiz de Galarreta', position: 'MID' },
    { name: 'Mikel Vesga', position: 'MID' },
    { name: 'Oihan Sancet', position: 'MID' },
    { name: 'Benat Prados', position: 'MID' },
    { name: 'Alex Berenguer', position: 'MID' },
    { name: 'Inaki Williams', position: 'FWD' },
    { name: 'Nico Williams', position: 'FWD' },
    { name: 'Gorka Guruzeta', position: 'FWD' },
    { name: 'Alvaro Djalo', position: 'FWD' },
  ],
  bet: [
    { name: 'Rui Silva', position: 'GK' },
    { name: 'Fran Vieites', position: 'GK' },
    { name: 'German Pezzella', position: 'DEF' },
    { name: 'Marc Bartra', position: 'DEF' },
    { name: 'Diego Llorente', position: 'DEF' },
    { name: 'Romain Perraud', position: 'DEF' },
    { name: 'Hector Bellerin', position: 'DEF' },
    { name: 'Johnny Cardoso', position: 'MID' },
    { name: 'William Carvalho', position: 'MID' },
    { name: 'Isco', position: 'MID' },
    { name: 'Sergi Altimira', position: 'MID' },
    { name: 'Pablo Fornals', position: 'MID' },
    { name: 'Ayoze Perez', position: 'FWD' },
    { name: 'Cedric Bakambu', position: 'FWD' },
    { name: 'Abde Ezzalzouli', position: 'FWD' },
    { name: 'Chimy Avila', position: 'FWD' },
  ],
  cel: [
    { name: 'Vicente Guaita', position: 'GK' },
    { name: 'Ivan Villar', position: 'GK' },
    { name: 'Carl Starfelt', position: 'DEF' },
    { name: 'Unai Nunez', position: 'DEF' },
    { name: 'Carlos Dominguez', position: 'DEF' },
    { name: 'Oscar Mingueza', position: 'DEF' },
    { name: 'Javier Manquillo', position: 'DEF' },
    { name: 'Fran Beltran', position: 'MID' },
    { name: 'Renato Tapia', position: 'MID' },
    { name: 'Hugo Sotelo', position: 'MID' },
    { name: 'Ilaix Moriba', position: 'MID' },
    { name: 'Williot Swedberg', position: 'MID' },
    { name: 'Iago Aspas', position: 'FWD' },
    { name: 'Jorgen Strand Larsen', position: 'FWD' },
    { name: 'Anastasios Douvikas', position: 'FWD' },
    { name: 'Jonathan Bamba', position: 'FWD' },
  ],
  get: [
    { name: 'David Soria', position: 'GK' },
    { name: 'Daniel Fuzato', position: 'GK' },
    { name: 'Djene Dakonam', position: 'DEF' },
    { name: 'Omar Alderete', position: 'DEF' },
    { name: 'Stefan Mitrovic', position: 'DEF' },
    { name: 'Diego Rico', position: 'DEF' },
    { name: 'Juan Iglesias', position: 'DEF' },
    { name: 'Nemanja Maksimovic', position: 'MID' },
    { name: 'Mauro Arambarri', position: 'MID' },
    { name: 'Luis Milla', position: 'MID' },
    { name: 'Carles Alena', position: 'MID' },
    { name: 'Oscar Rodriguez', position: 'MID' },
    { name: 'Borja Mayoral', position: 'FWD' },
    { name: 'Juanmi Latasa', position: 'FWD' },
    { name: 'Bertug Yildirim', position: 'FWD' },
    { name: 'Jaime Mata', position: 'FWD' },
  ],
  gir: [
    { name: 'Paulo Gazzaniga', position: 'GK' },
    { name: 'Juan Carlos', position: 'GK' },
    { name: 'Eric Garcia', position: 'DEF' },
    { name: 'David Lopez', position: 'DEF' },
    { name: 'Daley Blind', position: 'DEF' },
    { name: 'Miguel Gutierrez', position: 'DEF' },
    { name: 'Arnau Martinez', position: 'DEF' },
    { name: 'Aleix Garcia', position: 'MID' },
    { name: 'Yangel Herrera', position: 'MID' },
    { name: 'Ivan Martin', position: 'MID' },
    { name: 'Portu', position: 'MID' },
    { name: 'Viktor Tsygankov', position: 'MID' },
    { name: 'Artem Dovbyk', position: 'FWD' },
    { name: 'Cristhian Stuani', position: 'FWD' },
    { name: 'Savio', position: 'FWD' },
    { name: 'Yan Couto', position: 'FWD' },
  ],
  lpa: [
    { name: 'Alvaro Valles', position: 'GK' },
    { name: 'Aaron Escandell', position: 'GK' },
    { name: 'Alex Suarez', position: 'DEF' },
    { name: 'Mika Marmol', position: 'DEF' },
    { name: 'Saul Coco', position: 'DEF' },
    { name: 'Sergi Cardona', position: 'DEF' },
    { name: 'Julian Araujo', position: 'DEF' },
    { name: 'Kirian Rodriguez', position: 'MID' },
    { name: 'Maximo Perrone', position: 'MID' },
    { name: 'Javi Munoz', position: 'MID' },
    { name: 'Enzo Loiodice', position: 'MID' },
    { name: 'Alberto Moleiro', position: 'MID' },
    { name: 'Sandro Ramirez', position: 'FWD' },
    { name: 'Munir El Haddadi', position: 'FWD' },
    { name: 'Marc Cardona', position: 'FWD' },
    { name: 'Sory Kaba', position: 'FWD' },
  ],
  mal: [
    { name: 'Predrag Rajkovic', position: 'GK' },
    { name: 'Dominik Greif', position: 'GK' },
    { name: 'Antonio Raillo', position: 'DEF' },
    { name: 'Martin Valjent', position: 'DEF' },
    { name: 'Jose Copete', position: 'DEF' },
    { name: 'Jaume Costa', position: 'DEF' },
    { name: 'Pablo Maffeo', position: 'DEF' },
    { name: 'Samu Costa', position: 'MID' },
    { name: 'Omar Mascarell', position: 'MID' },
    { name: 'Dani Rodriguez', position: 'MID' },
    { name: 'Sergi Darder', position: 'MID' },
    { name: 'Manu Morlanes', position: 'MID' },
    { name: 'Vedat Muriqi', position: 'FWD' },
    { name: 'Cyle Larin', position: 'FWD' },
    { name: 'Abdon Prats', position: 'FWD' },
    { name: 'Antonio Sanchez', position: 'FWD' },
  ],
  osa: [
    { name: 'Sergio Herrera', position: 'GK' },
    { name: 'Aitor Fernandez', position: 'GK' },
    { name: 'David Garcia', position: 'DEF' },
    { name: 'Alejandro Catena', position: 'DEF' },
    { name: 'Juan Cruz', position: 'DEF' },
    { name: 'Nacho Vidal', position: 'DEF' },
    { name: 'Jesus Areso', position: 'DEF' },
    { name: 'Lucas Torro', position: 'MID' },
    { name: 'Jon Moncayola', position: 'MID' },
    { name: 'Aimar Oroz', position: 'MID' },
    { name: 'Moi Gomez', position: 'MID' },
    { name: 'Ruben Garcia', position: 'MID' },
    { name: 'Ante Budimir', position: 'FWD' },
    { name: 'Raul Garcia de Haro', position: 'FWD' },
    { name: 'Jose Arnaiz', position: 'FWD' },
    { name: 'Chimy Avila', position: 'FWD' },
  ],
  ray: [
    { name: 'Stole Dimitrievski', position: 'GK' },
    { name: 'Dani Cardenas', position: 'GK' },
    { name: 'Florian Lejeune', position: 'DEF' },
    { name: 'Abdul Mumin', position: 'DEF' },
    { name: 'Aridane Hernandez', position: 'DEF' },
    { name: 'Pep Chavarria', position: 'DEF' },
    { name: 'Ivan Balliu', position: 'DEF' },
    { name: 'Oscar Valentin', position: 'MID' },
    { name: 'Unai Lopez', position: 'MID' },
    { name: 'Isi Palazon', position: 'MID' },
    { name: 'Oscar Trejo', position: 'MID' },
    { name: 'Jorge de Frutos', position: 'MID' },
    { name: 'Alvaro Garcia', position: 'FWD' },
    { name: 'Sergio Camello', position: 'FWD' },
    { name: 'Raul de Tomas', position: 'FWD' },
    { name: 'Radamel Falcao', position: 'FWD' },
  ],
  rso: [
    { name: 'Alex Remiro', position: 'GK' },
    { name: 'Unai Marrero', position: 'GK' },
    { name: 'Robin Le Normand', position: 'DEF' },
    { name: 'Igor Zubeldia', position: 'DEF' },
    { name: 'Aihen Munoz', position: 'DEF' },
    { name: 'Hamari Traore', position: 'DEF' },
    { name: 'Jon Pacheco', position: 'DEF' },
    { name: 'Martin Zubimendi', position: 'MID' },
    { name: 'Mikel Merino', position: 'MID' },
    { name: 'Brais Mendez', position: 'MID' },
    { name: 'Takefusa Kubo', position: 'MID' },
    { name: 'Ander Barrenetxea', position: 'MID' },
    { name: 'Mikel Oyarzabal', position: 'FWD' },
    { name: 'Umar Sadiq', position: 'FWD' },
    { name: 'Andre Silva', position: 'FWD' },
    { name: 'Carlos Fernandez', position: 'FWD' },
  ],
  sev: [
    { name: 'Orjan Nyland', position: 'GK' },
    { name: 'Marko Dmitrovic', position: 'GK' },
    { name: 'Sergio Ramos', position: 'DEF' },
    { name: 'Loic Bade', position: 'DEF' },
    { name: 'Nemanja Gudelj', position: 'DEF' },
    { name: 'Marcos Acuna', position: 'DEF' },
    { name: 'Jesus Navas', position: 'DEF' },
    { name: 'Ivan Rakitic', position: 'MID' },
    { name: 'Djibril Sow', position: 'MID' },
    { name: 'Boubakary Soumare', position: 'MID' },
    { name: 'Suso', position: 'MID' },
    { name: 'Oliver Torres', position: 'MID' },
    { name: 'Youssef En-Nesyri', position: 'FWD' },
    { name: 'Lucas Ocampos', position: 'FWD' },
    { name: 'Dodi Lukebakio', position: 'FWD' },
    { name: 'Rafa Mir', position: 'FWD' },
  ],
  val: [
    { name: 'Giorgi Mamardashvili', position: 'GK' },
    { name: 'Jaume Domenech', position: 'GK' },
    { name: 'Thierry Correia', position: 'DEF' },
    { name: 'Cristhian Mosquera', position: 'DEF' },
    { name: 'Mouctar Diakhaby', position: 'DEF' },
    { name: 'Jose Gaya', position: 'DEF' },
    { name: 'Dimitri Foulquier', position: 'DEF' },
    { name: 'Pepelu', position: 'MID' },
    { name: 'Javi Guerra', position: 'MID' },
    { name: 'Andre Almeida', position: 'MID' },
    { name: 'Hugo Guillamon', position: 'MID' },
    { name: 'Fran Perez', position: 'MID' },
    { name: 'Hugo Duro', position: 'FWD' },
    { name: 'Diego Lopez', position: 'FWD' },
    { name: 'Sergi Canos', position: 'FWD' },
    { name: 'Roman Yaremchuk', position: 'FWD' },
  ],
  vil: [
    { name: 'Filip Jorgensen', position: 'GK' },
    { name: 'Pepe Reina', position: 'GK' },
    { name: 'Raul Albiol', position: 'DEF' },
    { name: 'Jorge Cuenca', position: 'DEF' },
    { name: 'Juan Foyth', position: 'DEF' },
    { name: 'Alberto Moreno', position: 'DEF' },
    { name: 'Kiko Femenia', position: 'DEF' },
    { name: 'Dani Parejo', position: 'MID' },
    { name: 'Alex Baena', position: 'MID' },
    { name: 'Etienne Capoue', position: 'MID' },
    { name: 'Santi Comesana', position: 'MID' },
    { name: 'Ramon Terrats', position: 'MID' },
    { name: 'Gerard Moreno', position: 'FWD' },
    { name: 'Alexander Sorloth', position: 'FWD' },
    { name: 'Jose Luis Morales', position: 'FWD' },
    { name: 'Yeremy Pino', position: 'FWD' },
  ],
  ala: [
    { name: 'Antonio Sivera', position: 'GK' },
    { name: 'Jesus Owono', position: 'GK' },
    { name: 'Rafa Marin', position: 'DEF' },
    { name: 'Abdel Abqar', position: 'DEF' },
    { name: 'Ruben Duarte', position: 'DEF' },
    { name: 'Javi Lopez', position: 'DEF' },
    { name: 'Nahuel Tenaglia', position: 'DEF' },
    { name: 'Antonio Blanco', position: 'MID' },
    { name: 'Ander Guevara', position: 'MID' },
    { name: 'Jon Guridi', position: 'MID' },
    { name: 'Carlos Vicente', position: 'MID' },
    { name: 'Luis Rioja', position: 'MID' },
    { name: 'Kike Garcia', position: 'FWD' },
    { name: 'Samu Omorodion', position: 'FWD' },
    { name: 'Giuliano Simeone', position: 'FWD' },
    { name: 'Asier Villalibre', position: 'FWD' },
  ],
  cad: [
    { name: 'Conan Ledesma', position: 'GK' },
    { name: 'David Gil', position: 'GK' },
    { name: 'Fali', position: 'DEF' },
    { name: 'Victor Chust', position: 'DEF' },
    { name: 'Luis Hernandez', position: 'DEF' },
    { name: 'Javi Hernandez', position: 'DEF' },
    { name: 'Iza Carcelen', position: 'DEF' },
    { name: 'Ruben Alcaraz', position: 'MID' },
    { name: 'Fede San Emeterio', position: 'MID' },
    { name: 'Alex Fernandez', position: 'MID' },
    { name: 'Ruben Sobrino', position: 'MID' },
    { name: 'Ivan Alejo', position: 'MID' },
    { name: 'Chris Ramos', position: 'FWD' },
    { name: 'Roger Marti', position: 'FWD' },
    { name: 'Darwin Machis', position: 'FWD' },
    { name: 'Maxi Gomez', position: 'FWD' },
  ],
  alm: [
    { name: 'Luis Maximiano', position: 'GK' },
    { name: 'Diego Marino', position: 'GK' },
    { name: 'Chumi', position: 'DEF' },
    { name: 'Edgar Gonzalez', position: 'DEF' },
    { name: 'Aleksandar Radovanovic', position: 'DEF' },
    { name: 'Bruno Langa', position: 'DEF' },
    { name: 'Marc Pubill', position: 'DEF' },
    { name: 'Lucas Robertone', position: 'MID' },
    { name: 'Dion Lopy', position: 'MID' },
    { name: 'Gonzalo Melero', position: 'MID' },
    { name: 'Sergio Arribas', position: 'MID' },
    { name: 'Adri Embarba', position: 'MID' },
    { name: 'Leo Baptistao', position: 'FWD' },
    { name: 'Luis Suarez', position: 'FWD' },
    { name: 'Largie Ramazani', position: 'FWD' },
    { name: 'Marko Milovanovic', position: 'FWD' },
  ],
  gra: [
    { name: 'Augusto Batalla', position: 'GK' },
    { name: 'Raul Fernandez', position: 'GK' },
    { name: 'Ignasi Miquel', position: 'DEF' },
    { name: 'Miguel Rubio', position: 'DEF' },
    { name: 'Bruno Mendez', position: 'DEF' },
    { name: 'Carlos Neva', position: 'DEF' },
    { name: 'Ricard Sanchez', position: 'DEF' },
    { name: 'Gerard Gumbau', position: 'MID' },
    { name: 'Sergio Ruiz', position: 'MID' },
    { name: 'Gonzalo Villar', position: 'MID' },
    { name: 'Antonio Puertas', position: 'MID' },
    { name: 'Facundo Pellistri', position: 'MID' },
    { name: 'Lucas Boye', position: 'FWD' },
    { name: 'Myrto Uzuni', position: 'FWD' },
    { name: 'Shon Weissman', position: 'FWD' },
    { name: 'Matias Arezo', position: 'FWD' },
  ],
}

const youthShape = ['GK', 'DEF', 'MID', 'FWD'] as const

function hashText(text: string): number {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function buildPlayerName(seed: number): string {
  const first = firstNames[seed % firstNames.length]
  const last = lastNames[(seed * 7) % lastNames.length]
  return `${first} ${last}`
}

function buildPlayer(team: TeamSeed, teamIndex: number, playerIndex: number): Player {
  const roster = teamRosters[team.id]?.[playerIndex]
  const position: Position = roster?.position ?? squadShape[playerIndex] ?? 'MID'
  const seed = hashText(`${team.id}-${playerIndex}`)

  const baseByPosition = {
    GK: team.defense,
    DEF: team.defense,
    MID: team.midfield,
    FWD: team.attack,
  }

  const tierOffset =
    playerIndex <= 10
      ? 3
      : playerIndex <= 16
        ? -1
        : -5
  const variance = (seed % 5) - 2
  const fallbackOverall = Math.max(62, Math.min(92, baseByPosition[position] + tierOffset + variance))
  const overall = roster?.name ? playerOverallOverrides[roster.name] ?? fallbackOverall : fallbackOverall

  const playerName = roster?.name ?? buildPlayerName(seed + teamIndex * 10)
  const naturalPositions = inferNaturalPositions(position, playerIndex)

  return {
    id: `${team.id}-p${playerIndex + 1}`,
    name: playerName,
    position,
    naturalPositions,
    overall,
    value: Math.round(overall * overall * 14_500),
    wage: Math.round(overall * 12_000 + (seed % 90_000)),
    stamina: 72 + (seed % 24),
    form: 63 + ((seed >> 3) % 30),
    fatigue: 18 + (seed % 20),
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears: 1 + (seed % 5),
  }
}

function buildYouth(team: TeamSeed, index: number): YouthPlayer {
  const seed = hashText(`y-${team.id}-${index}`)
  const overall = 52 + (seed % 18)

  return {
    id: `${team.id}-y${index + 1}`,
    name: buildPlayerName(seed + 200),
    position: youthShape[index % youthShape.length],
    age: 16 + (seed % 3),
    overall,
    potential: Math.max(overall + 10, 68 + (seed % 16)),
    progress: seed % 55,
  }
}

function toTeam(base: TeamSeed, teamIndex: number): Team {
  const players = squadShape.map((_, idx) => buildPlayer(base, teamIndex, idx))

  return {
    ...base,
    points: 0,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    players,
    youthPlayers: youthShape.map((_, idx) => buildYouth(base, idx)),
    sponsor: {
      name: sponsors[teamIndex % sponsors.length],
      weeklyIncome: 320_000 + teamIndex * 28_000,
      targetRank: Math.min(6, 2 + Math.floor(teamIndex / 2)),
      seasonBonus: 2_800_000 - teamIndex * 180_000,
      seasonBonusPaid: false,
    },
    staff: {
      medicalLevel: 1,
      disciplineLevel: 1,
    },
    tactic: tacticCycle[teamIndex % tacticCycle.length],
    trainingFocus: trainingFocusCycle[teamIndex % trainingFocusCycle.length],
  }
}

function rotate<T>(arr: T[]): T[] {
  if (arr.length <= 2) {
    return arr
  }

  const [fixed, ...others] = arr
  const last = others.pop()
  if (last === undefined) {
    return arr
  }

  return [fixed, last, ...others]
}

function generateRoundRobin(teamIds: string[]): LeagueState['fixtures'] {
  const isOdd = teamIds.length % 2 === 1
  const workingIds = isOdd ? [...teamIds, 'bye'] : [...teamIds]
  const roundsPerLeg = workingIds.length - 1

  let rotation = [...workingIds]
  const firstLeg: LeagueState['fixtures'] = []

  for (let roundIndex = 0; roundIndex < roundsPerLeg; roundIndex += 1) {
    const round = roundIndex + 1

    for (let i = 0; i < workingIds.length / 2; i += 1) {
      const home = rotation[i]
      const away = rotation[workingIds.length - 1 - i]

      if (home !== 'bye' && away !== 'bye') {
        const shouldSwap = roundIndex % 2 === 1
        firstLeg.push({
          id: `r${round}-${home}-${away}`,
          round,
          homeTeamId: shouldSwap ? away : home,
          awayTeamId: shouldSwap ? home : away,
          played: false,
        })
      }
    }

    rotation = rotate(rotation)
  }

  const secondLeg = firstLeg.map((fixture) => ({
    ...fixture,
    id: `r${fixture.round + roundsPerLeg}-${fixture.awayTeamId}-${fixture.homeTeamId}`,
    round: fixture.round + roundsPerLeg,
    homeTeamId: fixture.awayTeamId,
    awayTeamId: fixture.homeTeamId,
    played: false,
  }))

  return [...firstLeg, ...secondLeg]
}

export function createInitialLeagueState(): LeagueState {
  const teams = baseTeams.map(toTeam)
  const fixtures = generateRoundRobin(teams.map((team) => team.id))

  return {
    currentRound: 1,
    totalRounds: teams.length % 2 === 0 ? (teams.length - 1) * 2 : teams.length * 2,
    teams,
    fixtures,
    lastResults: [],
    news: ['Temporada iniciada: la prensa espera una liga muy igualada.'],
  }
}
