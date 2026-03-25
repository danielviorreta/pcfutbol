import type {
  CompetitionGroup,
  Division,
  LeagueState,
  Player,
  Position,
  RolePosition,
  Tactic,
  Team,
  TrainingFocus,
  YouthPlayer,
} from '../types/game'
import { estimatePlayerHappiness, estimateReleaseClause } from '../engine/playerMarket'
import { PLAYER_OVERALL_OVERRIDES, PLAYER_REAL_AGES } from './playerRealData'

type TeamSeed = Omit<
  Team,
  | 'division'
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

type TeamSeedWithDivision = TeamSeed & { division: Division; group?: CompetitionGroup }

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

const segundaTeams: TeamSeed[] = [
  { id: 'lev', name: 'Levante UD', crestUrl: 'https://icons.duckduckgo.com/ip3/levanteud.com.ico', stadium: { name: 'Ciutat de Valencia', capacity: 26_354, ticketPrice: 24 }, budget: 24_000_000, morale: 70, attack: 73, midfield: 72, defense: 71 },
  { id: 'eib', name: 'SD Eibar', crestUrl: 'https://icons.duckduckgo.com/ip3/sdeibar.com.ico', stadium: { name: 'Ipurua', capacity: 8_164, ticketPrice: 22 }, budget: 19_000_000, morale: 69, attack: 72, midfield: 71, defense: 72 },
  { id: 'ten', name: 'CD Tenerife', crestUrl: 'https://icons.duckduckgo.com/ip3/cdtenerife.es.ico', stadium: { name: 'Heliodoro Rodriguez Lopez', capacity: 22_824, ticketPrice: 20 }, budget: 18_000_000, morale: 68, attack: 70, midfield: 70, defense: 69 },
  { id: 'zar', name: 'Real Zaragoza', crestUrl: 'https://icons.duckduckgo.com/ip3/realzaragoza.com.ico', stadium: { name: 'La Romareda', capacity: 33_608, ticketPrice: 22 }, budget: 21_000_000, morale: 69, attack: 71, midfield: 71, defense: 70 },
  { id: 'ovi', name: 'Real Oviedo', crestUrl: 'https://icons.duckduckgo.com/ip3/realoviedo.es.ico', stadium: { name: 'Carlos Tartiere', capacity: 30_500, ticketPrice: 22 }, budget: 20_000_000, morale: 69, attack: 71, midfield: 70, defense: 70 },
  { id: 'spo', name: 'Sporting Gijon', crestUrl: 'https://icons.duckduckgo.com/ip3/realsporting.com.ico', stadium: { name: 'El Molinon', capacity: 29_029, ticketPrice: 22 }, budget: 20_000_000, morale: 69, attack: 71, midfield: 70, defense: 70 },
  { id: 'rac', name: 'Racing Santander', crestUrl: 'https://icons.duckduckgo.com/ip3/realracingclub.es.ico', stadium: { name: 'El Sardinero', capacity: 22_271, ticketPrice: 20 }, budget: 17_000_000, morale: 68, attack: 69, midfield: 69, defense: 68 },
  { id: 'alb', name: 'Albacete Balompie', crestUrl: 'https://icons.duckduckgo.com/ip3/albacetebalompie.es.ico', stadium: { name: 'Carlos Belmonte', capacity: 17_524, ticketPrice: 18 }, budget: 16_000_000, morale: 67, attack: 68, midfield: 68, defense: 67 },
  { id: 'bur', name: 'Burgos CF', crestUrl: 'https://icons.duckduckgo.com/ip3/burgoscf.es.ico', stadium: { name: 'El Plantio', capacity: 12_642, ticketPrice: 18 }, budget: 15_000_000, morale: 67, attack: 67, midfield: 67, defense: 68 },
  { id: 'car', name: 'FC Cartagena', crestUrl: 'https://icons.duckduckgo.com/ip3/fccartagena.es.ico', stadium: { name: 'Cartagonova', capacity: 15_105, ticketPrice: 18 }, budget: 14_000_000, morale: 66, attack: 66, midfield: 67, defense: 66 },
  { id: 'mir', name: 'CD Mirandes', crestUrl: 'https://icons.duckduckgo.com/ip3/cdmirandes.com.ico', stadium: { name: 'Anduva', capacity: 5_759, ticketPrice: 16 }, budget: 13_000_000, morale: 66, attack: 66, midfield: 66, defense: 66 },
  { id: 'dep', name: 'Deportivo La Coruna', crestUrl: 'https://icons.duckduckgo.com/ip3/rcdeportivo.es.ico', stadium: { name: 'Riazor', capacity: 32_490, ticketPrice: 21 }, budget: 19_000_000, morale: 68, attack: 69, midfield: 69, defense: 69 },
  { id: 'hue', name: 'SD Huesca', crestUrl: 'https://icons.duckduckgo.com/ip3/sdhuesca.es.ico', stadium: { name: 'El Alcoraz', capacity: 9_100, ticketPrice: 17 }, budget: 14_500_000, morale: 66, attack: 67, midfield: 67, defense: 67 },
  { id: 'and', name: 'FC Andorra', crestUrl: 'https://icons.duckduckgo.com/ip3/fcandorra.com.ico', stadium: { name: 'Estadi Nacional', capacity: 3_306, ticketPrice: 16 }, budget: 13_000_000, morale: 65, attack: 66, midfield: 66, defense: 65 },
  { id: 'pon', name: 'Ponferradina', crestUrl: 'https://icons.duckduckgo.com/ip3/clubdeportivaponferradina.com.ico', stadium: { name: 'El Toralin', capacity: 8_400, ticketPrice: 16 }, budget: 12_500_000, morale: 65, attack: 65, midfield: 65, defense: 65 },
  { id: 'lug', name: 'CD Lugo', crestUrl: 'https://icons.duckduckgo.com/ip3/cdlugo.com.ico', stadium: { name: 'Anxo Carro', capacity: 7_070, ticketPrice: 15 }, budget: 12_000_000, morale: 64, attack: 65, midfield: 64, defense: 65 },
  { id: 'cas', name: 'CD Castellon', crestUrl: 'https://icons.duckduckgo.com/ip3/cdcastellon.com.ico', stadium: { name: 'Castalia', capacity: 14_485, ticketPrice: 16 }, budget: 12_800_000, morale: 65, attack: 65, midfield: 65, defense: 65 },
  { id: 'fer', name: 'Racing Ferrol', crestUrl: 'https://icons.duckduckgo.com/ip3/racingclubferrol.net.ico', stadium: { name: 'A Malata', capacity: 11_669, ticketPrice: 16 }, budget: 12_000_000, morale: 64, attack: 64, midfield: 64, defense: 65 },
  { id: 'eld', name: 'CD Eldense', crestUrl: 'https://icons.duckduckgo.com/ip3/cdeldense.es.ico', stadium: { name: 'Nuevo Pepico Amat', capacity: 5_766, ticketPrice: 15 }, budget: 11_000_000, morale: 63, attack: 64, midfield: 64, defense: 64 },
  { id: 'leg', name: 'CD Leganes', crestUrl: 'https://icons.duckduckgo.com/ip3/cdleganes.com.ico', stadium: { name: 'Butarque', capacity: 12_450, ticketPrice: 18 }, budget: 16_000_000, morale: 67, attack: 68, midfield: 68, defense: 69 },
]

const primeraFederacionGroupOneTeams: TeamSeed[] = [
  { id: 'cul', name: 'Cultural Leonesa', crestUrl: 'https://icons.duckduckgo.com/ip3/cydleonesa.com.ico', stadium: { name: 'Reino de Leon', capacity: 13_451, ticketPrice: 14 }, budget: 9_000_000, morale: 64, attack: 64, midfield: 64, defense: 64 },
  { id: 'mur', name: 'Real Murcia', crestUrl: 'https://icons.duckduckgo.com/ip3/realmurcia.es.ico', stadium: { name: 'Nueva Condomina', capacity: 31_179, ticketPrice: 15 }, budget: 10_500_000, morale: 65, attack: 65, midfield: 65, defense: 65 },
  { id: 'nat', name: 'Nastic de Tarragona', crestUrl: 'https://icons.duckduckgo.com/ip3/gimnasticdetarragona.cat.ico', stadium: { name: 'Nou Estadi Costa Daurada', capacity: 14_591, ticketPrice: 14 }, budget: 9_500_000, morale: 64, attack: 64, midfield: 64, defense: 64 },
  { id: 'ceu', name: 'AD Ceuta FC', crestUrl: 'https://icons.duckduckgo.com/ip3/adceutafc.com.ico', stadium: { name: 'Alfonso Murube', capacity: 6_500, ticketPrice: 13 }, budget: 8_000_000, morale: 63, attack: 63, midfield: 63, defense: 63 },
  { id: 'ibi', name: 'UD Ibiza', crestUrl: 'https://icons.duckduckgo.com/ip3/udibiza.com.ico', stadium: { name: 'Can Misses', capacity: 6_445, ticketPrice: 13 }, budget: 8_500_000, morale: 63, attack: 63, midfield: 64, defense: 63 },
  { id: 'rec', name: 'Recreativo Huelva', crestUrl: 'https://icons.duckduckgo.com/ip3/recreativohuelva.com.ico', stadium: { name: 'Nuevo Colombino', capacity: 21_670, ticketPrice: 14 }, budget: 9_000_000, morale: 64, attack: 64, midfield: 64, defense: 64 },
  { id: 'log', name: 'SD Logrones', crestUrl: 'https://icons.duckduckgo.com/ip3/sdlogrones.com.ico', stadium: { name: 'Las Gaunas', capacity: 16_000, ticketPrice: 13 }, budget: 8_500_000, morale: 63, attack: 63, midfield: 63, defense: 63 },
  { id: 'uni', name: 'Unionistas de Salamanca', crestUrl: 'https://icons.duckduckgo.com/ip3/unionistascf.com.ico', stadium: { name: 'Reina Sofia', capacity: 4_895, ticketPrice: 12 }, budget: 8_000_000, morale: 63, attack: 63, midfield: 62, defense: 63 },
  { id: 'alc', name: 'CD Alcoyano', crestUrl: 'https://icons.duckduckgo.com/ip3/cdalcoyano.com.ico', stadium: { name: 'El Collao', capacity: 4_850, ticketPrice: 12 }, budget: 7_500_000, morale: 62, attack: 62, midfield: 62, defense: 62 },
  { id: 'fue', name: 'CF Fuenlabrada', crestUrl: 'https://icons.duckduckgo.com/ip3/cffuenlabrada.es.ico', stadium: { name: 'Fernando Torres', capacity: 5_400, ticketPrice: 12 }, budget: 7_500_000, morale: 62, attack: 62, midfield: 62, defense: 62 },
  { id: 'rmc', name: 'Real Madrid Castilla', crestUrl: 'https://icons.duckduckgo.com/ip3/realmadrid.com.ico', stadium: { name: 'Alfredo Di Stefano', capacity: 6_000, ticketPrice: 12 }, budget: 8_000_000, morale: 64, attack: 64, midfield: 63, defense: 63 },
  { id: 'sva', name: 'Sevilla Atletico', crestUrl: 'https://icons.duckduckgo.com/ip3/sevillafc.es.ico', stadium: { name: 'Jesus Navas', capacity: 7_500, ticketPrice: 12 }, budget: 8_000_000, morale: 63, attack: 63, midfield: 63, defense: 63 },
  { id: 'celb', name: 'Celta Fortuna', crestUrl: 'https://icons.duckduckgo.com/ip3/rccelta.es.ico', stadium: { name: 'Balaidos Anexo', capacity: 3_000, ticketPrice: 11 }, budget: 7_000_000, morale: 62, attack: 62, midfield: 62, defense: 62 },
  { id: 'rsob', name: 'Real Sociedad B', crestUrl: 'https://icons.duckduckgo.com/ip3/realsociedad.eus.ico', stadium: { name: 'Zubieta', capacity: 2_500, ticketPrice: 11 }, budget: 7_000_000, morale: 62, attack: 62, midfield: 62, defense: 62 },
  { id: 'bab', name: 'Barcelona Atletic', crestUrl: 'https://icons.duckduckgo.com/ip3/fcbarcelona.com.ico', stadium: { name: 'Johan Cruyff', capacity: 6_000, ticketPrice: 12 }, budget: 7_500_000, morale: 63, attack: 63, midfield: 63, defense: 62 },
  { id: 'atb', name: 'Atletico Baleares', crestUrl: 'https://icons.duckduckgo.com/ip3/atleticobaleares.com.ico', stadium: { name: 'Estadi Balear', capacity: 6_000, ticketPrice: 11 }, budget: 7_000_000, morale: 62, attack: 62, midfield: 62, defense: 62 },
  { id: 'zam', name: 'Zamora CF', crestUrl: 'https://icons.duckduckgo.com/ip3/zamoracf.es.ico', stadium: { name: 'Ruta de la Plata', capacity: 7_813, ticketPrice: 11 }, budget: 7_000_000, morale: 61, attack: 61, midfield: 61, defense: 62 },
  { id: 'arr', name: 'CD Arenteiro', crestUrl: 'https://icons.duckduckgo.com/ip3/cdarenteiro.es.ico', stadium: { name: 'Espinedo', capacity: 4_000, ticketPrice: 10 }, budget: 6_500_000, morale: 61, attack: 61, midfield: 61, defense: 61 },
  { id: 'lin', name: 'Linares Deportivo', crestUrl: 'https://icons.duckduckgo.com/ip3/linaresdeportivo.es.ico', stadium: { name: 'Linarejos', capacity: 10_000, ticketPrice: 11 }, budget: 6_800_000, morale: 61, attack: 61, midfield: 61, defense: 61 },
  { id: 'anc', name: 'Antequera CF', crestUrl: 'https://icons.duckduckgo.com/ip3/antequeracf.es.ico', stadium: { name: 'El Mauli', capacity: 4_500, ticketPrice: 10 }, budget: 6_500_000, morale: 61, attack: 61, midfield: 61, defense: 61 },
]

const primeraFederacionGroupTwoTeams: TeamSeed[] = [
  { id: 'alg', name: 'Algeciras CF', crestUrl: 'https://icons.duckduckgo.com/ip3/algecirascf.eu.ico', stadium: { name: 'Nuevo Mirador', capacity: 7_800, ticketPrice: 11 }, budget: 6_800_000, morale: 61, attack: 61, midfield: 61, defense: 61 },
  { id: 'san', name: 'Atletico Sanluqueno', crestUrl: 'https://icons.duckduckgo.com/ip3/atleticosanluqueno.com.ico', stadium: { name: 'El Palmar', capacity: 5_000, ticketPrice: 10 }, budget: 6_400_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'betb', name: 'Betis Deportivo', crestUrl: 'https://icons.duckduckgo.com/ip3/realbetisbalompie.es.ico', stadium: { name: 'Luis del Sol', capacity: 3_500, ticketPrice: 10 }, budget: 6_900_000, morale: 61, attack: 61, midfield: 61, defense: 60 },
  { id: 'her', name: 'Hercules CF', crestUrl: 'https://icons.duckduckgo.com/ip3/herculesdealicantecf.net.ico', stadium: { name: 'Jose Rico Perez', capacity: 29_500, ticketPrice: 12 }, budget: 7_500_000, morale: 62, attack: 62, midfield: 62, defense: 62 },
  { id: 'int', name: 'CF Intercity', crestUrl: 'https://icons.duckduckgo.com/ip3/cfintercity.com.ico', stadium: { name: 'Antonio Solana', capacity: 4_000, ticketPrice: 10 }, budget: 6_500_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'mer', name: 'Merida AD', crestUrl: 'https://icons.duckduckgo.com/ip3/meridaad.com.ico', stadium: { name: 'Romano', capacity: 14_600, ticketPrice: 11 }, budget: 6_900_000, morale: 61, attack: 61, midfield: 61, defense: 61 },
  { id: 'osab', name: 'Osasuna Promesas', crestUrl: 'https://icons.duckduckgo.com/ip3/osasuna.es.ico', stadium: { name: 'Tajonar', capacity: 4_000, ticketPrice: 10 }, budget: 6_700_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'our', name: 'Ourense CF', crestUrl: 'https://icons.duckduckgo.com/ip3/ourensecf.es.ico', stadium: { name: 'O Couto', capacity: 5_659, ticketPrice: 10 }, budget: 6_300_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'tar', name: 'SD Tarazona', crestUrl: 'https://icons.duckduckgo.com/ip3/sdtarazona.com.ico', stadium: { name: 'Municipal de Tarazona', capacity: 2_500, ticketPrice: 9 }, budget: 6_000_000, morale: 59, attack: 59, midfield: 59, defense: 59 },
  { id: 'seg', name: 'Gimnastica Segoviana', crestUrl: 'https://icons.duckduckgo.com/ip3/gimnasticasegoviana.es.ico', stadium: { name: 'La Albuera', capacity: 6_000, ticketPrice: 9 }, budget: 6_000_000, morale: 59, attack: 59, midfield: 59, defense: 59 },
  { id: 'ses', name: 'Sestao River', crestUrl: 'https://icons.duckduckgo.com/ip3/sestaoriverclub.com.ico', stadium: { name: 'Las Llanas', capacity: 8_900, ticketPrice: 10 }, budget: 6_200_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'bark', name: 'Barakaldo CF', crestUrl: 'https://icons.duckduckgo.com/ip3/barakaldocf.com.ico', stadium: { name: 'Lasesarre', capacity: 7_960, ticketPrice: 10 }, budget: 6_200_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'bilb', name: 'Bilbao Athletic', crestUrl: 'https://icons.duckduckgo.com/ip3/athletic-club.eus.ico', stadium: { name: 'Lezama', capacity: 3_250, ticketPrice: 10 }, budget: 6_800_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'vilb', name: 'Villarreal B', crestUrl: 'https://icons.duckduckgo.com/ip3/villarrealcf.es.ico', stadium: { name: 'Ciudad Deportiva Villarreal', capacity: 3_000, ticketPrice: 10 }, budget: 6_800_000, morale: 60, attack: 61, midfield: 60, defense: 60 },
  { id: 'mar', name: 'Marbella FC', crestUrl: 'https://icons.duckduckgo.com/ip3/marbellafc.es.ico', stadium: { name: 'Dama de Noche', capacity: 7_300, ticketPrice: 10 }, budget: 6_300_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'ponb', name: 'Pontevedra CF', crestUrl: 'https://icons.duckduckgo.com/ip3/pontevedracf.com.ico', stadium: { name: 'Pasaron', capacity: 10_500, ticketPrice: 10 }, budget: 6_400_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'cor', name: 'Cordoba CF', crestUrl: 'https://icons.duckduckgo.com/ip3/cordobacf.com.ico', stadium: { name: 'Nuevo Arcangel', capacity: 21_822, ticketPrice: 12 }, budget: 7_500_000, morale: 62, attack: 62, midfield: 62, defense: 61 },
  { id: 'casc', name: 'Cacereno', crestUrl: 'https://icons.duckduckgo.com/ip3/cpcacereno.com.ico', stadium: { name: 'Principe Felipe', capacity: 7_000, ticketPrice: 10 }, budget: 6_000_000, morale: 59, attack: 59, midfield: 59, defense: 59 },
  { id: 'sabd', name: 'CE Sabadell', crestUrl: 'https://icons.duckduckgo.com/ip3/cesabadell.cat.ico', stadium: { name: 'Nova Creu Alta', capacity: 11_908, ticketPrice: 10 }, budget: 6_700_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
  { id: 'num', name: 'CD Numancia', crestUrl: 'https://icons.duckduckgo.com/ip3/cdnumancia.com.ico', stadium: { name: 'Los Pajaritos', capacity: 8_261, ticketPrice: 10 }, budget: 6_800_000, morale: 60, attack: 60, midfield: 60, defense: 60 },
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

const lowerDivisionFallbackRealNames = [
  'Sergio Asenjo', 'Alvaro Fernandez', 'Ruben Yanez', 'Diego Altube', 'Luca Romero', 'Javi Puado',
  'Sergio Camello', 'Miguel de la Fuente', 'Juan Villar', 'Juan Narvaez', 'Ivan Jaime', 'Jorge de Frutos',
  'Manu Morlanes', 'Victor Mollejo', 'Borja Garces', 'Mamadou Sylla', 'Cristo Gonzalez', 'Marc Gual',
  'Jon Bautista', 'Jose Corpas', 'Rober Pier', 'Eneko Jauregi', 'Aitor Ruibal', 'Alex Fores',
  'Ruben Pardo', 'Oscar Plano', 'Alexandru Pascanu', 'Josep Sene', 'Sergio Ruiz Alonso', 'Dani Escriche',
  'Pablo Martinez', 'Miguel Atienza', 'Aleix Febas', 'Joni Montiel', 'Aitor Sanz', 'Cris Montes',
  'Lander Olaetxea', 'Fran Sol', 'Juan Carlos Arana', 'Sergio Carreira', 'Carlos Isaac', 'Miguel Baeza',
  'Yanis Rahmani', 'Jonathan Dubasin', 'Jose Carlos Lazo', 'Edu Exposito', 'Riki Rodriguez', 'Nico Serrano',
  'Ilyas Chaira', 'Kevin Medina', 'Naim Garcia', 'Alberto Quiles', 'Borja Valle', 'Mikel Rico',
  'Salva Ruiz', 'Carlos Pomares', 'Carlos Doncel', 'Javi Lara', 'Samu Saiz', 'Javi Munoz',
  'Alberto Escassi', 'Fede Vico', 'Rafa Mir', 'Juanmi Callejon', 'Sergio Bermejo', 'Sebas Moyano',
  'Moi Delgado', 'Toni Moya', 'Mikel Iribas', 'Borja Sanchez', 'Alvaro Pena', 'Xabi Irureta',
  'Jose Naranjo', 'Javier Aviles', 'David Costas', 'Diego Gonzalez', 'Alex Petxa', 'Andoni Lopez',
  'Unai Medina', 'Saul Garcia', 'Victor Campuzano', 'Pablo Claveria', 'Jorge Pombo', 'Dani Romera',
  'Jordi Mboula', 'Sergio Castel', 'Sergi Guardiola', 'Carlos Cordero', 'Jose Gragera', 'Javi Ros',
  'Mikel Balenziaga', 'Luis Rioja', 'Kike Perez', 'Fran Villalba', 'Miki Munoz', 'Cristian Herrera',
  'David Rodriguez', 'Jose Arnaiz', 'Lluis Lopez', 'Marc Cardona', 'Jaume Grau', 'Pablo Hervias',
  'Alvaro Jimenez', 'Javi Martos', 'Miguel Loureiro', 'Ander Cantero', 'Alex Martin',
  'Joaquin Munoz', 'Gaizka Larrazabal', 'Iker Undabarrena',
]

const segundaRegionalGroups: Record<string, CompetitionGroup> = {
  lev: 'Grupo 2',
  eib: 'Grupo 1',
  ten: 'Grupo 2',
  zar: 'Grupo 1',
  ovi: 'Grupo 1',
  spo: 'Grupo 1',
  rac: 'Grupo 1',
  alb: 'Grupo 2',
  bur: 'Grupo 1',
  car: 'Grupo 2',
  mir: 'Grupo 1',
  dep: 'Grupo 1',
  hue: 'Grupo 1',
  and: 'Grupo 2',
  pon: 'Grupo 1',
  lug: 'Grupo 1',
  cas: 'Grupo 2',
  fer: 'Grupo 1',
  eld: 'Grupo 2',
  leg: 'Grupo 2',
}

const primeraFederacionRegionalGroups: Record<string, CompetitionGroup> = {
  cul: 'Grupo 1',
  mur: 'Grupo 1',
  nat: 'Grupo 1',
  ceu: 'Grupo 1',
  ibi: 'Grupo 1',
  rec: 'Grupo 1',
  log: 'Grupo 1',
  uni: 'Grupo 1',
  alc: 'Grupo 1',
  fue: 'Grupo 1',
  rmc: 'Grupo 1',
  sva: 'Grupo 1',
  celb: 'Grupo 1',
  rsob: 'Grupo 1',
  bab: 'Grupo 1',
  atb: 'Grupo 1',
  zam: 'Grupo 1',
  arr: 'Grupo 1',
  lin: 'Grupo 1',
  anc: 'Grupo 1',
  alg: 'Grupo 2',
  san: 'Grupo 2',
  betb: 'Grupo 2',
  her: 'Grupo 2',
  int: 'Grupo 2',
  mer: 'Grupo 2',
  osab: 'Grupo 2',
  our: 'Grupo 2',
  tar: 'Grupo 2',
  seg: 'Grupo 2',
  ses: 'Grupo 2',
  bark: 'Grupo 2',
  bilb: 'Grupo 2',
  vilb: 'Grupo 2',
  mar: 'Grupo 2',
  ponb: 'Grupo 2',
  cor: 'Grupo 2',
  casc: 'Grupo 2',
  sabd: 'Grupo 2',
  num: 'Grupo 2',
}

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
  lev: [
    { name: 'Andres Fernandez', position: 'GK' },
    { name: 'Ruben Vezo', position: 'DEF' },
    { name: 'Sergio Postigo', position: 'DEF' },
    { name: 'Alex Valle', position: 'DEF' },
    { name: 'Oriol Rey', position: 'MID' },
    { name: 'Giorgi Kochorashvili', position: 'MID' },
    { name: 'Carlos Alvarez', position: 'MID' },
    { name: 'Mohamed Bouldini', position: 'FWD' },
  ],
  eib: [
    { name: 'Luca Zidane', position: 'GK' },
    { name: 'Anaitz Arbilla', position: 'DEF' },
    { name: 'Alvaro Tejero', position: 'DEF' },
    { name: 'Frederico Venancio', position: 'DEF' },
    { name: 'Peru Nolaskoain', position: 'MID' },
    { name: 'Ager Aketxe', position: 'MID' },
    { name: 'Matheus Pereira', position: 'MID' },
    { name: 'Stoichkov', position: 'FWD' },
  ],
  ten: [
    { name: 'Juan Soriano', position: 'GK' },
    { name: 'Jose Leon', position: 'DEF' },
    { name: 'Nacho Martinez', position: 'DEF' },
    { name: 'Aitor Bunuel', position: 'DEF' },
    { name: 'Aitor Sanz', position: 'MID' },
    { name: 'Roberto Lopez', position: 'MID' },
    { name: 'Waldo Rubio', position: 'MID' },
    { name: 'Enric Gallego', position: 'FWD' },
  ],
  zar: [
    { name: 'Cristian Alvarez', position: 'GK' },
    { name: 'Jair Amador', position: 'DEF' },
    { name: 'Alejandro Frances', position: 'DEF' },
    { name: 'Carlos Nieto', position: 'DEF' },
    { name: 'Francho Serrano', position: 'MID' },
    { name: 'Maikel Mesa', position: 'MID' },
    { name: 'German Valera', position: 'MID' },
    { name: 'Ivan Azon', position: 'FWD' },
  ],
  ovi: [
    { name: 'Leo Roman', position: 'GK' },
    { name: 'Dani Calvo', position: 'DEF' },
    { name: 'Oier Luengo', position: 'DEF' },
    { name: 'Abel Bretones', position: 'DEF' },
    { name: 'Santi Cazorla', position: 'MID' },
    { name: 'Santiago Colombatto', position: 'MID' },
    { name: 'Luismi', position: 'MID' },
    { name: 'Borja Baston', position: 'FWD' },
  ],
  spo: [
    { name: 'Diego Marino', position: 'GK' },
    { name: 'Pablo Insua', position: 'DEF' },
    { name: 'Cote', position: 'DEF' },
    { name: 'Guille Rosas', position: 'DEF' },
    { name: 'Nacho Mendez', position: 'MID' },
    { name: 'Roque Mesa', position: 'MID' },
    { name: 'Gaspar Campos', position: 'MID' },
    { name: 'Uros Djurdjevic', position: 'FWD' },
  ],
  rac: [
    { name: 'Jokin Ezkieta', position: 'GK' },
    { name: 'German Sanchez', position: 'DEF' },
    { name: 'Ruben Alves', position: 'DEF' },
    { name: 'Dani Fernandez', position: 'DEF' },
    { name: 'Inigo Vicente', position: 'MID' },
    { name: 'Aritz Aldasoro', position: 'MID' },
    { name: 'Vicente', position: 'MID' },
    { name: 'Peque', position: 'FWD' },
  ],
  alb: [
    { name: 'Bernabe Barragan', position: 'GK' },
    { name: 'Djetei', position: 'DEF' },
    { name: 'Lalo Aguilar', position: 'DEF' },
    { name: 'Julio Alonso', position: 'DEF' },
    { name: 'Riki Rodriguez', position: 'MID' },
    { name: 'Manu Fuster', position: 'MID' },
    { name: 'Fidel Chaves', position: 'MID' },
    { name: 'Higinio Marin', position: 'FWD' },
  ],
  bur: [
    { name: 'Jose Antonio Caro', position: 'GK' },
    { name: 'Aitor Cordoba', position: 'DEF' },
    { name: 'Grego Sierra', position: 'DEF' },
    { name: 'Matos', position: 'DEF' },
    { name: 'Mumo', position: 'MID' },
    { name: 'Curro Sanchez', position: 'MID' },
    { name: 'Alex Bermejo', position: 'MID' },
    { name: 'Edu Espiau', position: 'FWD' },
  ],
  car: [
    { name: 'Marc Martinez', position: 'GK' },
    { name: 'Pedro Alcala', position: 'DEF' },
    { name: 'Kiko Olivas', position: 'DEF' },
    { name: 'Ivan Calero', position: 'DEF' },
    { name: 'Luis Munoz', position: 'MID' },
    { name: 'Andy Rodriguez', position: 'MID' },
    { name: 'Jony Alamo', position: 'MID' },
    { name: 'Alfredo Ortuno', position: 'FWD' },
  ],
  mir: [
    { name: 'Ramon Juan', position: 'GK' },
    { name: 'Sergio Barcia', position: 'DEF' },
    { name: 'Juan Gutierrez', position: 'DEF' },
    { name: 'Pablo Tomeo', position: 'DEF' },
    { name: 'Alvaro Sanz', position: 'MID' },
    { name: 'Alberto Reina', position: 'MID' },
    { name: 'Carlos Martin', position: 'MID' },
    { name: 'Javier Marton', position: 'FWD' },
  ],
  dep: [
    { name: 'German Parreno', position: 'GK' },
    { name: 'Pablo Vazquez', position: 'DEF' },
    { name: 'Jaime Sanchez', position: 'DEF' },
    { name: 'Ximo Navarro', position: 'DEF' },
    { name: 'Jose Angel Jurado', position: 'MID' },
    { name: 'David Mella', position: 'MID' },
    { name: 'Yeremay Hernandez', position: 'MID' },
    { name: 'Lucas Perez', position: 'FWD' },
  ],
  hue: [
    { name: 'Alvaro Fernandez', position: 'GK' },
    { name: 'Jorge Pulido', position: 'DEF' },
    { name: 'Jeremy Blasco', position: 'DEF' },
    { name: 'Miguel Loureiro', position: 'DEF' },
    { name: 'Javi Martinez', position: 'MID' },
    { name: 'Kento Hashimoto', position: 'MID' },
    { name: 'Sergi Enrich', position: 'FWD' },
    { name: 'Joaquin Munoz', position: 'FWD' },
  ],
  and: [
    { name: 'Nicolas Ratti', position: 'GK' },
    { name: 'Alex Pastor', position: 'DEF' },
    { name: 'Diego Alende', position: 'DEF' },
    { name: 'Marti Vila', position: 'DEF' },
    { name: 'Sergi Samper', position: 'MID' },
    { name: 'Ivan Gil', position: 'MID' },
    { name: 'Julen Lobete', position: 'FWD' },
    { name: 'Manu Nieto', position: 'FWD' },
  ],
  pon: [
    { name: 'Andres Prieto', position: 'GK' },
    { name: 'Jose Amo', position: 'DEF' },
    { name: 'Alex Costa', position: 'DEF' },
    { name: 'Sibille', position: 'DEF' },
    { name: 'Naim Garcia', position: 'MID' },
    { name: 'Moises Delgado', position: 'MID' },
    { name: 'Yeray Cabanzon', position: 'MID' },
    { name: 'Eneko Jauregi', position: 'FWD' },
  ],
  lug: [
    { name: 'Oscar Whalley', position: 'GK' },
    { name: 'Miguel Loureiro', position: 'DEF' },
    { name: 'Alberto Rodriguez', position: 'DEF' },
    { name: 'Zé Ricardo', position: 'DEF' },
    { name: 'Juanpe', position: 'MID' },
    { name: 'Claveria', position: 'MID' },
    { name: 'Chris Ramos', position: 'FWD' },
    { name: 'Manu Barreiro', position: 'FWD' },
  ],
  cas: [
    { name: 'Gonzalo Crettaz', position: 'GK' },
    { name: 'Alberto Jimenez', position: 'DEF' },
    { name: 'Jetro Willems', position: 'DEF' },
    { name: 'Sergio Moyita', position: 'MID' },
    { name: 'Calavera', position: 'MID' },
    { name: 'Israel Suero', position: 'MID' },
    { name: 'Raul Sanchez', position: 'FWD' },
    { name: 'De Miguel', position: 'FWD' },
  ],
  fer: [
    { name: 'Jesus Ruiz', position: 'GK' },
    { name: 'David Castro', position: 'DEF' },
    { name: 'Jon Garcia', position: 'DEF' },
    { name: 'Brais Martinez', position: 'DEF' },
    { name: 'Josep Sene', position: 'MID' },
    { name: 'Heber Pena', position: 'MID' },
    { name: 'Carlos Vicente', position: 'MID' },
    { name: 'Manu Justo', position: 'FWD' },
  ],
  eld: [
    { name: 'Marc Mateu', position: 'DEF' },
    { name: 'Ian Mackay', position: 'GK' },
    { name: 'Dario Dumic', position: 'DEF' },
    { name: 'Toni Abad', position: 'DEF' },
    { name: 'Sergio Ortuno', position: 'MID' },
    { name: 'David Timor', position: 'MID' },
    { name: 'Juanto Ortuno', position: 'FWD' },
    { name: 'Mario Soberon', position: 'FWD' },
  ],
  leg: [
    { name: 'Diego Conde', position: 'GK' },
    { name: 'Sergio Gonzalez', position: 'DEF' },
    { name: 'Jorge Saenz', position: 'DEF' },
    { name: 'Enric Franquesa', position: 'DEF' },
    { name: 'Undabarrena', position: 'MID' },
    { name: 'Portillo', position: 'MID' },
    { name: 'Naim Garcia', position: 'MID' },
    { name: 'Miguel de la Fuente', position: 'FWD' },
  ],
  cul: [
    { name: 'Miguel Banez', position: 'GK' },
    { name: 'Victor Garcia', position: 'DEF' },
    { name: 'Rodolfo Bodipo', position: 'DEF' },
    { name: 'Kevin Presa', position: 'MID' },
    { name: 'Jesus Alvarez', position: 'MID' },
    { name: 'Alvaro Martinez', position: 'MID' },
    { name: 'Guillermo Fernandez', position: 'FWD' },
    { name: 'Dani Vidal', position: 'FWD' },
  ],
  mur: [
    { name: 'Gazzaniga', position: 'GK' },
    { name: 'Alberto Gonzalez', position: 'DEF' },
    { name: 'Jose Ruiz', position: 'DEF' },
    { name: 'Isi Ros', position: 'MID' },
    { name: 'Pedro Leon', position: 'MID' },
    { name: 'Dani Vega', position: 'MID' },
    { name: 'Carrillo', position: 'FWD' },
    { name: 'Javier Rueda', position: 'FWD' },
  ],
  nat: [
    { name: 'Dani Parra', position: 'GK' },
    { name: 'Nacho Gonzalez', position: 'DEF' },
    { name: 'Pablo Trigueros', position: 'DEF' },
    { name: 'Joan Oriol', position: 'DEF' },
    { name: 'Marc Montalvo', position: 'MID' },
    { name: 'Borja Martinez', position: 'MID' },
    { name: 'Pol Domingo', position: 'MID' },
    { name: 'Pablo Fernandez', position: 'FWD' },
  ],
  ceu: [
    { name: 'Pedro Lopez', position: 'GK' },
    { name: 'Capa', position: 'DEF' },
    { name: 'Carlos Redru', position: 'DEF' },
    { name: 'Aisar Ahmed', position: 'DEF' },
    { name: 'Rodri Rios', position: 'MID' },
    { name: 'Jota', position: 'MID' },
    { name: 'Alain Oyarzun', position: 'MID' },
    { name: 'Youness Lachhab', position: 'FWD' },
  ],
  ibi: [
    { name: 'German', position: 'GK' },
    { name: 'Molina', position: 'DEF' },
    { name: 'Escassi', position: 'DEF' },
    { name: 'Javi Vazquez', position: 'DEF' },
    { name: 'Javi Perez', position: 'MID' },
    { name: 'Miki Villar', position: 'MID' },
    { name: 'Nolito', position: 'MID' },
    { name: 'Sergi Enrich', position: 'FWD' },
  ],
  rec: [
    { name: 'Ruben Galvez', position: 'GK' },
    { name: 'Carlos Beitia', position: 'DEF' },
    { name: 'Juanjo Mateo', position: 'DEF' },
    { name: 'Pablo Caballero', position: 'DEF' },
    { name: 'Sergio Jimenez', position: 'MID' },
    { name: 'De la Rosa', position: 'MID' },
    { name: 'David del Pozo', position: 'MID' },
    { name: 'Caye Quintana', position: 'FWD' },
  ],
  log: [
    { name: 'Pichu Atienza', position: 'GK' },
    { name: 'Aridane', position: 'DEF' },
    { name: 'Iago Lopez', position: 'DEF' },
    { name: 'Markel Lozano', position: 'MID' },
    { name: 'Sergio Benito', position: 'MID' },
    { name: 'Dioni', position: 'MID' },
    { name: 'Clau Mendes', position: 'FWD' },
    { name: 'Jony Niguez', position: 'FWD' },
  ],
  uni: [
    { name: 'Ivan Martinez', position: 'GK' },
    { name: 'Rastrojo', position: 'DEF' },
    { name: 'Ramiro Mayor', position: 'DEF' },
    { name: 'Mikel Serrano', position: 'MID' },
    { name: 'Aitor Pascual', position: 'MID' },
    { name: 'Pablo Espina', position: 'MID' },
    { name: 'Alfred Planas', position: 'FWD' },
    { name: 'Diego Garcia', position: 'FWD' },
  ],
  alc: [
    { name: 'Miguel Bañuz', position: 'GK' },
    { name: 'Primi', position: 'DEF' },
    { name: 'Mario Fuentes', position: 'DEF' },
    { name: 'Imanol Garcia', position: 'MID' },
    { name: 'Lobato', position: 'MID' },
    { name: 'Agus Medina', position: 'MID' },
    { name: 'Raul Alcaina', position: 'FWD' },
    { name: 'Juanan Casanova', position: 'FWD' },
  ],
  fue: [
    { name: 'Belman', position: 'GK' },
    { name: 'Sotillos', position: 'DEF' },
    { name: 'Pol Valentín', position: 'DEF' },
    { name: 'Cristo Diaz', position: 'MID' },
    { name: 'Fer Ruiz', position: 'MID' },
    { name: 'Kevin Bua', position: 'MID' },
    { name: 'Cedric Omoigui', position: 'FWD' },
    { name: 'Juanma Marrero', position: 'FWD' },
  ],
  rmc: [
    { name: 'Lucas Canizares', position: 'GK' },
    { name: 'Marvel', position: 'DEF' },
    { name: 'Edgar Pujol', position: 'DEF' },
    { name: 'Rafael Obrador', position: 'DEF' },
    { name: 'Theo Zidane', position: 'MID' },
    { name: 'Nico Paz', position: 'MID' },
    { name: 'Cesar Palacios', position: 'MID' },
    { name: 'Alvaro Rodriguez', position: 'FWD' },
  ],
  sva: [
    { name: 'Alberto Flores', position: 'GK' },
    { name: 'Kike Salas', position: 'DEF' },
    { name: 'Darío Benavides', position: 'DEF' },
    { name: 'Juanlu Sanchez', position: 'DEF' },
    { name: 'Lulo Dasilva', position: 'MID' },
    { name: 'Manu Bueno', position: 'MID' },
    { name: 'Diego Hormigo', position: 'MID' },
    { name: 'Isaac Romero', position: 'FWD' },
  ],
  alg: [
    { name: 'Lucho Garcia', position: 'GK' },
    { name: 'Tomás Sanchez', position: 'DEF' },
    { name: 'Mario Gomez', position: 'DEF' },
    { name: 'Javier Aviles', position: 'MID' },
    { name: 'Marino Illescas', position: 'MID' },
    { name: 'Ivan Turrillo', position: 'MID' },
    { name: 'Ruben Serrano', position: 'DEF' },
    { name: 'Roko Baturina', position: 'FWD' },
  ],
  san: [
    { name: 'Samu Casado', position: 'GK' },
    { name: 'Antonito', position: 'DEF' },
    { name: 'Fran Gongora', position: 'DEF' },
    { name: 'Sergio Noche', position: 'MID' },
    { name: 'Alex Gorrin', position: 'MID' },
    { name: 'Mawi', position: 'MID' },
    { name: 'Juanmi Carrión', position: 'DEF' },
    { name: 'Airam Cabrera', position: 'FWD' },
  ],
  betb: [
    { name: 'Guilherme Fernandes', position: 'GK' },
    { name: 'Sergi Altimira', position: 'MID' },
    { name: 'Assane Diao', position: 'FWD' },
    { name: 'Pablo Busto', position: 'DEF' },
    { name: 'Xavi Pleguezuelo', position: 'DEF' },
    { name: 'Marchena', position: 'MID' },
    { name: 'Félix Garreta', position: 'DEF' },
    { name: 'Marcos Fernández', position: 'FWD' },
  ],
  her: [
    { name: 'Carlos Abad', position: 'GK' },
    { name: 'Josema Gomez', position: 'DEF' },
    { name: 'Samu Vázquez', position: 'DEF' },
    { name: 'Míchel Herrero', position: 'MID' },
    { name: 'Nico Espinosa', position: 'MID' },
    { name: 'Alvarito', position: 'MID' },
    { name: 'Jean Paul', position: 'DEF' },
    { name: 'Coscia', position: 'FWD' },
  ],
  int: [
    { name: 'Gaizka Campos', position: 'GK' },
    { name: 'Emilio Nsue', position: 'DEF' },
    { name: 'Ander Vitoria', position: 'FWD' },
    { name: 'Cristo Romero', position: 'DEF' },
    { name: 'Julio Gracia', position: 'MID' },
    { name: 'Pol Roige', position: 'MID' },
    { name: 'Miki Muñoz', position: 'MID' },
    { name: 'Locadia', position: 'FWD' },
  ],
  mer: [
    { name: 'Juanpa', position: 'GK' },
    { name: 'Bonaque', position: 'DEF' },
    { name: 'Eslava', position: 'DEF' },
    { name: 'Carlos Doncel', position: 'MID' },
    { name: 'Álvaro Ramón', position: 'MID' },
    { name: 'David Rocha', position: 'MID' },
    { name: 'Pipe', position: 'DEF' },
    { name: 'Chuma', position: 'FWD' },
  ],
  osab: [
    { name: 'Stamatakis', position: 'GK' },
    { name: 'Jorge Herrando', position: 'DEF' },
    { name: 'Sixtus Ogbuehi', position: 'FWD' },
    { name: 'Diego Moreno', position: 'DEF' },
    { name: 'Iker Benito', position: 'MID' },
    { name: 'Mauro Echegoyen', position: 'MID' },
    { name: 'Aimar Oroz', position: 'MID' },
    { name: 'Asier Osambela', position: 'MID' },
  ],
  our: [
    { name: 'Marqueta', position: 'GK' },
    { name: 'Jairo Noriega', position: 'DEF' },
    { name: 'Álex Fernández', position: 'DEF' },
    { name: 'Luismi', position: 'MID' },
    { name: 'Jorge Álvarez', position: 'MID' },
    { name: 'Ángel Sánchez', position: 'MID' },
    { name: 'Aarón Rey', position: 'MID' },
    { name: 'Jerin Ramos', position: 'FWD' },
  ],
  tar: [
    { name: 'Fuoli', position: 'GK' },
    { name: 'David Cubillas', position: 'FWD' },
    { name: 'Mendoza', position: 'DEF' },
    { name: 'Álex Gil', position: 'MID' },
    { name: 'Adrián Fuentes', position: 'MID' },
    { name: 'Toni Gabarre', position: 'FWD' },
    { name: 'Chechu Martínez', position: 'DEF' },
    { name: 'Dani González', position: 'MID' },
  ],
  seg: [
    { name: 'Carmona', position: 'GK' },
    { name: 'Mansour', position: 'DEF' },
    { name: 'Pascu', position: 'DEF' },
    { name: 'Diego Gómez', position: 'MID' },
    { name: 'Javi Borrego', position: 'MID' },
    { name: 'Llorente', position: 'MID' },
    { name: 'Farru', position: 'DEF' },
    { name: 'Dani Plomer', position: 'FWD' },
  ],
  ses: [
    { name: 'Aitor Arregi', position: 'DEF' },
    { name: 'Gaizka Martinez', position: 'MID' },
    { name: 'Leandro Martinez', position: 'GK' },
    { name: 'Jon Cabo', position: 'MID' },
    { name: 'Unai Rementeria', position: 'DEF' },
    { name: 'Diego Garai', position: 'MID' },
    { name: 'Markel Etxeberria', position: 'DEF' },
    { name: 'Raúl Hernández', position: 'FWD' },
  ],
  bark: [
    { name: 'Unai Marino', position: 'GK' },
    { name: 'Markel Lozano', position: 'MID' },
    { name: 'Pablo Santiago', position: 'MID' },
    { name: 'Aymane Jelbat', position: 'DEF' },
    { name: 'Eneko Undabarrena', position: 'MID' },
    { name: 'Iker Bilbao', position: 'DEF' },
    { name: 'Neskes', position: 'MID' },
    { name: 'Julen Huidobro', position: 'FWD' },
  ],
  bilb: [
    { name: 'Mikel Santos', position: 'GK' },
    { name: 'Aingeru Olabarrieta', position: 'MID' },
    { name: 'Adu Ares', position: 'MID' },
    { name: 'Hugo Rincon', position: 'DEF' },
    { name: 'Unai Gomez', position: 'MID' },
    { name: 'Ibon Sanchez', position: 'DEF' },
    { name: 'Asier Hierro', position: 'DEF' },
    { name: 'Izeta', position: 'FWD' },
  ],
  vilb: [
    { name: 'Iker Alvarez', position: 'GK' },
    { name: 'Mamadou Fall', position: 'DEF' },
    { name: 'Pau Navarro', position: 'DEF' },
    { name: 'Dani Tasende', position: 'DEF' },
    { name: 'Carlo Adriano', position: 'MID' },
    { name: 'Rodri Alonso', position: 'MID' },
    { name: 'Jorge Pascual', position: 'FWD' },
    { name: 'Alex Forés', position: 'FWD' },
  ],
  mar: [
    { name: 'Dani Martín', position: 'GK' },
    { name: 'Javi Duarte', position: 'DEF' },
    { name: 'Marcos Olguin', position: 'DEF' },
    { name: 'Dioni Villalba', position: 'FWD' },
    { name: 'Aitor Puñal', position: 'MID' },
    { name: 'Javier Añón', position: 'MID' },
    { name: 'Genar Fornes', position: 'MID' },
    { name: 'Yac Diori', position: 'FWD' },
  ],
  ponb: [
    { name: 'Edu Sousa', position: 'GK' },
    { name: 'Héctor Hernández', position: 'DEF' },
    { name: 'Álex González', position: 'DEF' },
    { name: 'Miguel Román', position: 'MID' },
    { name: 'Charles Dias', position: 'FWD' },
    { name: 'Rufo', position: 'FWD' },
    { name: 'Samu Mayo', position: 'MID' },
    { name: 'Yelko Pino', position: 'MID' },
  ],
  cor: [
    { name: 'Carlos Marin', position: 'GK' },
    { name: 'Jose Calderon', position: 'DEF' },
    { name: 'Adrián Lapena', position: 'DEF' },
    { name: 'Isma Ruiz', position: 'MID' },
    { name: 'Theo Zidane', position: 'MID' },
    { name: 'Kuki Zalazar', position: 'MID' },
    { name: 'Antonio Casas', position: 'FWD' },
    { name: 'Cristian Carracedo', position: 'FWD' },
  ],
  casc: [
    { name: 'Bernabé', position: 'GK' },
    { name: 'Álvaro Clausí', position: 'DEF' },
    { name: 'Mansilla', position: 'MID' },
    { name: 'Álex Jiménez', position: 'DEF' },
    { name: 'David Grande', position: 'FWD' },
    { name: 'Solano', position: 'FWD' },
    { name: 'Rubén Solano', position: 'MID' },
    { name: 'José Ramón', position: 'DEF' },
  ],
  sabd: [
    { name: 'Mackay', position: 'GK' },
    { name: 'Rubén Martínez', position: 'DEF' },
    { name: 'Iago Indias', position: 'DEF' },
    { name: 'Carles Salvador', position: 'MID' },
    { name: 'Miguelete', position: 'MID' },
    { name: 'David Astals', position: 'MID' },
    { name: 'Pau Víctor', position: 'FWD' },
    { name: 'Alfredo Pedraza', position: 'FWD' },
  ],
  num: [
    { name: 'Gaizka Ayesa', position: 'GK' },
    { name: 'Carlos González', position: 'DEF' },
    { name: 'Míchel Zabaco', position: 'DEF' },
    { name: 'Cotán', position: 'MID' },
    { name: 'Jordi Tur', position: 'MID' },
    { name: 'Javi Bonilla', position: 'DEF' },
    { name: 'Rubén Mesa', position: 'FWD' },
    { name: 'Dani Fernández', position: 'FWD' },
  ],
}

const primeraFederacionRosterIds = new Set([
  'cul', 'mur', 'nat', 'ceu', 'ibi', 'rec', 'log', 'uni', 'alc', 'fue',
  'rmc', 'sva', 'celb', 'rsob', 'bab', 'atb', 'zam', 'arr', 'lin', 'anc',
  'alg', 'san', 'betb', 'her', 'int', 'mer', 'osab', 'our', 'tar', 'seg',
  'ses', 'bark', 'bilb', 'vilb', 'mar', 'ponb', 'cor', 'casc', 'sabd', 'num',
])

const federacionRosterExtensionShape: Position[] = ['GK', 'DEF', 'DEF', 'DEF', 'MID', 'MID', 'MID', 'FWD']
const federacionTargetRosterSize = 20

function getRosterEntries(team: TeamSeedWithDivision): RosterEntry[] {
  const baseRoster = teamRosters[team.id] ?? []

  if (!primeraFederacionRosterIds.has(team.id) || baseRoster.length >= federacionTargetRosterSize) {
    return baseRoster
  }

  const needed = federacionTargetRosterSize - baseRoster.length
  const offset = hashText(`fed-extra-${team.id}`) % lowerDivisionFallbackRealNames.length
  const usedNames = new Set(baseRoster.map((entry) => entry.name))
  const extras: RosterEntry[] = []

  for (let index = 0; extras.length < needed && index < lowerDivisionFallbackRealNames.length * 2; index += 1) {
    const candidateName = lowerDivisionFallbackRealNames[(offset + index * 7) % lowerDivisionFallbackRealNames.length]
    if (usedNames.has(candidateName)) {
      continue
    }

    extras.push({
      name: candidateName,
      position: federacionRosterExtensionShape[extras.length % federacionRosterExtensionShape.length],
    })
    usedNames.add(candidateName)
  }

  return [...baseRoster, ...extras]
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

function buildRealisticPlayerAge(
  seed: number,
  position: Position,
  overall: number,
  playerIndex: number,
  division: Division,
  playerName?: string,
): number {
  const realAge = playerName ? PLAYER_REAL_AGES[playerName] : undefined
  if (typeof realAge === 'number') {
    return Math.max(16, Math.min(40, realAge))
  }

  const positionBase =
    position === 'GK'
      ? 29
      : position === 'DEF'
        ? 27
        : position === 'MID'
          ? 26
          : 25

  const divisionBias = division === 'Primera' ? 1 : division === 'Segunda' ? 0 : -1
  const qualityBias = overall >= 88 ? 2 : overall >= 82 ? 1 : overall <= 70 ? -2 : 0
  const roleBias = playerIndex <= 10 ? 1 : playerIndex <= 16 ? 0 : -2
  const variance = (seed % 7) - 3

  return Math.max(17, Math.min(38, positionBase + divisionBias + qualityBias + roleBias + variance))
}

function buildPlayer(team: TeamSeedWithDivision, teamIndex: number, playerIndex: number): Player {
  const roster = getRosterEntries(team)[playerIndex]
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
  const overall = roster?.name ? PLAYER_OVERALL_OVERRIDES[roster.name] ?? fallbackOverall : fallbackOverall

  const fallbackName = team.division === 'Primera'
    ? buildPlayerName(seed + teamIndex * 10)
    : lowerDivisionFallbackRealNames[(seed + teamIndex * 17 + playerIndex * 13) % lowerDivisionFallbackRealNames.length]
  const playerName = roster?.name ?? fallbackName
  const naturalPositions = inferNaturalPositions(position, playerIndex)
  const value = Math.round(overall * overall * 14_500)
  const wage = Math.round(overall * 12_000 + (seed % 90_000))
  const contractYears = 1 + (seed % 5)
  const happiness = estimatePlayerHappiness(team, contractYears, ((seed % 11) - 5) * 2)
  const releaseClause = estimateReleaseClause({ value, wage, overall, contractYears }, team, happiness)
  const transferListed = playerIndex >= 13 && ((seed + teamIndex) % 4 === 0 || happiness <= 58 || contractYears <= 1)
  const askingPrice = transferListed
    ? Math.max(300_000, Math.round(releaseClause * (0.72 + (seed % 16) / 100)))
    : releaseClause

  return {
    id: `${team.id}-p${playerIndex + 1}`,
    name: playerName,
    age: buildRealisticPlayerAge(seed, position, overall, playerIndex, team.division, playerName),
    position,
    naturalPositions,
    overall,
    value,
    wage,
    releaseClause,
    transferListed,
    askingPrice,
    happiness,
    stamina: 72 + (seed % 24),
    form: 63 + ((seed >> 3) % 30),
    fatigue: 18 + (seed % 20),
    injuryWeeks: 0,
    suspensionWeeks: 0,
    yellowCards: 0,
    contractYears,
    recentMinutes: [],
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

function toTeam(base: TeamSeedWithDivision, teamIndex: number): Team {
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
  const divisionSeeds: TeamSeedWithDivision[] = [
    ...baseTeams.map((team) => ({ ...team, division: 'Primera' as const })),
    ...segundaTeams.map((team) => ({ ...team, division: 'Segunda' as const, regionalGroup: segundaRegionalGroups[team.id] })),
    ...primeraFederacionGroupOneTeams.map((team) => ({ ...team, division: 'Primera Federacion' as const, group: 'Grupo 1' as const, regionalGroup: primeraFederacionRegionalGroups[team.id] ?? 'Grupo 1' })),
    ...primeraFederacionGroupTwoTeams.map((team) => ({ ...team, division: 'Primera Federacion' as const, group: 'Grupo 2' as const, regionalGroup: primeraFederacionRegionalGroups[team.id] ?? 'Grupo 2' })),
  ]

  const teams = divisionSeeds.map(toTeam)
  const { fixtures, totalRounds } = buildSeasonFixtures(teams)

  return {
    currentRound: 1,
    totalRounds,
    teams,
    fixtures,
    lastResults: [],
    news: ['Temporada iniciada: la prensa espera una liga muy igualada.'],
    promotionSummary: [],
    promotionBracket: null,
  }
}

function roundCountForTeamCount(teamCount: number): number {
  return teamCount % 2 === 0 ? (teamCount - 1) * 2 : teamCount * 2
}

export function buildSeasonFixtures(teams: Team[]): { fixtures: LeagueState['fixtures']; totalRounds: number } {
  const competitions = [
    teams.filter((team) => team.division === 'Primera').map((team) => team.id),
    teams.filter((team) => team.division === 'Segunda').map((team) => team.id),
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 1').map((team) => team.id),
    teams.filter((team) => team.division === 'Primera Federacion' && team.group === 'Grupo 2').map((team) => team.id),
  ].filter((teamIds) => teamIds.length > 0)

  const fixtures = competitions.flatMap((teamIds) => generateRoundRobin(teamIds))

  const totalRounds = Math.max(
    ...competitions.map((teamIds) => roundCountForTeamCount(teamIds.length)),
  )

  return {
    fixtures,
    totalRounds,
  }
}
