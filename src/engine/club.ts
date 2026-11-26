/**
 * Club management engine. Split by concern:
 * - weekly: weekly club management and season rollover
 * - training: player and youth development
 * - promotion: standings, play-offs, promotion and relegation
 * - settings: staff, tactic, training focus, ticket price and stadium
 * - renewals: contract renewals
 * - youth: youth academy promotions
 */
export { applyWeeklyClubManagement } from './club/weekly'
export {
  setStadiumTicketPrice,
  setTeamTactic,
  setTeamTrainingFocus,
  upgradeDisciplineStaff,
  upgradeMedicalStaff,
  upgradeStadium,
} from './club/settings'
export { resolveRenewalOffers, submitRenewalOffer } from './club/renewals'
export { promoteYouthPlayer } from './club/youth'
