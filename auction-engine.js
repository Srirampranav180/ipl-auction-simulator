// Auction Engine - Core Logic
// This module handles all auction-related functionality

const STARTING_PURSE = 100; // ₹100 Crores
const MIN_SQUAD_SIZE = 12;
const MAX_SQUAD_SIZE = 15;
const MAX_OVERSEAS = 6;
const TOTAL_PLAYERS = 165; // Updated to match actual player count

// Player roles
const ROLES = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  WICKETKEEPER: 'Wicketkeeper'
};

// Import real player pool
const playerPool = require('./player-pool');

// Generate player pool using real player list
function generatePlayerPool() {
  return playerPool.generatePlayerPool();
}

// Organize players into auction sets
function organizeIntoSets(players) {
  return playerPool.organizeIntoSets(players);
}

// Calculate minimum bid increment based on current bid
function getMinIncrement(currentBid) {
  if (currentBid < 1) return 0.10;
  if (currentBid < 5) return 0.25;
  if (currentBid < 10) return 0.50;
  if (currentBid < 20) return 1.00;
  return 2.00;
}

// Validate bid
function validateBid(team, bidAmount, currentBid, player) {
  // Check purse
  if (bidAmount > team.purse) {
    return { valid: false, error: 'Insufficient purse' };
  }

  // Check squad size
  if (team.squad.length >= MAX_SQUAD_SIZE) {
    return { valid: false, error: 'Squad is full (15 players)' };
  }

  // Check overseas limit
  if (player.isOverseas && team.overseasCount >= MAX_OVERSEAS) {
    return { valid: false, error: 'Maximum 6 overseas players reached' };
  }

  // Check bid increment
  const minIncrement = getMinIncrement(currentBid);
  if (bidAmount < currentBid + minIncrement) {
    return { valid: false, error: `Minimum bid is ₹${(currentBid + minIncrement).toFixed(2)} Cr` };
  }

  return { valid: true };
}

// Initialize team for auction
function initializeTeam(team) {
  return {
    ...team,
    purse: STARTING_PURSE,
    squad: [],
    overseasCount: 0,
    roleCount: {
      [ROLES.BATTER]: 0,
      [ROLES.BOWLER]: 0,
      [ROLES.ALL_ROUNDER]: 0,
      [ROLES.WICKETKEEPER]: 0
    }
  };
}

// Check if auction should end
function shouldEndAuction(teams) {
  // All teams have at least 12 players
  return teams.every(team => team.squad.length >= MIN_SQUAD_SIZE);
}

// Check if team followed all rules
function checkRuleCompliance(team) {
  const violations = [];
  
  // Check squad size
  if (team.squad.length < MIN_SQUAD_SIZE) {
    violations.push(`Insufficient players: ${team.squad.length}/${MIN_SQUAD_SIZE} minimum`);
  }
  if (team.squad.length > MAX_SQUAD_SIZE) {
    violations.push(`Too many players: ${team.squad.length}/${MAX_SQUAD_SIZE} maximum`);
  }
  
  // Check overseas limit
  if (team.overseasCount > MAX_OVERSEAS) {
    violations.push(`Too many overseas players: ${team.overseasCount}/${MAX_OVERSEAS} maximum`);
  }
  
  // Check if team has at least one wicketkeeper
  const hasWicketkeeper = team.squad.some(player => player.role === ROLES.WICKETKEEPER);
  if (!hasWicketkeeper) {
    violations.push("No wicketkeeper in squad");
  }
  
  // Check minimum role requirements (at least 2 batters, 2 bowlers)
  const batterCount = team.roleCount[ROLES.BATTER] || 0;
  const bowlerCount = team.roleCount[ROLES.BOWLER] || 0;
  
  if (batterCount < 2) {
    violations.push(`Insufficient batters: ${batterCount}/2 minimum`);
  }
  if (bowlerCount < 2) {
    violations.push(`Insufficient bowlers: ${bowlerCount}/2 minimum`);
  }
  
  return {
    compliant: violations.length === 0,
    violations: violations
  };
}

// Calculate team balance score (0-100)
function calculateBalanceScore(team) {
  const squadSize = team.squad.length;
  if (squadSize === 0) return 0;
  
  const idealDistribution = {
    [ROLES.BATTER]: Math.max(2, Math.round(squadSize * 0.35)), // ~35% batters
    [ROLES.BOWLER]: Math.max(2, Math.round(squadSize * 0.30)), // ~30% bowlers
    [ROLES.ALL_ROUNDER]: Math.max(1, Math.round(squadSize * 0.25)), // ~25% all-rounders
    [ROLES.WICKETKEEPER]: Math.max(1, Math.round(squadSize * 0.10)) // ~10% wicketkeepers
  };
  
  let balanceScore = 100;
  
  // Penalize for deviation from ideal distribution
  Object.keys(ROLES).forEach(roleKey => {
    const role = ROLES[roleKey];
    const actual = team.roleCount[role] || 0;
    const ideal = idealDistribution[role] || 0;
    const deviation = Math.abs(actual - ideal);
    const maxDeviation = Math.max(ideal, 2);
    const penalty = (deviation / maxDeviation) * 20; // Max 20 points penalty per role
    balanceScore -= Math.min(penalty, 20);
  });
  
  return Math.max(0, balanceScore);
}

// Calculate total rating score
function calculateRatingScore(team) {
  if (team.squad.length === 0) return 0;
  
  const totalRating = team.squad.reduce((sum, player) => sum + (player.rating || 0), 0);
  const averageRating = totalRating / team.squad.length;
  
  // Bonus for having high-rated players
  const starPlayers = team.squad.filter(p => p.rating >= 85).length;
  const starBonus = starPlayers * 5;
  
  return averageRating + starBonus;
}

// Calculate value efficiency score (rating per crore spent)
function calculateValueScore(team) {
  if (team.squad.length === 0) return 0;
  
  const totalSpent = STARTING_PURSE - team.purse;
  if (totalSpent === 0) return 0;
  
  const totalRating = team.squad.reduce((sum, player) => sum + (player.rating || 0), 0);
  const ratingPerCrore = totalRating / totalSpent;
  
  return ratingPerCrore * 10; // Scale for scoring
}

// Calculate comprehensive team score and determine winner
function calculateTeamScores(teams) {
  const scoredTeams = teams.map(team => {
    const compliance = checkRuleCompliance(team);
    
    // Teams that didn't follow rules get 0 score
    if (!compliance.compliant) {
      return {
        ...team,
        score: 0,
        ratingScore: 0,
        balanceScore: 0,
        valueScore: 0,
        compliance: compliance,
        disqualified: true
      };
    }
    
    // Calculate scores for compliant teams
    const ratingScore = calculateRatingScore(team);
    const balanceScore = calculateBalanceScore(team);
    const valueScore = calculateValueScore(team);
    
    // Weighted final score
    // Rating: 50%, Balance: 30%, Value: 20%
    const finalScore = (ratingScore * 0.5) + (balanceScore * 0.3) + (valueScore * 0.2);
    
    return {
      ...team,
      score: Math.round(finalScore * 100) / 100,
      ratingScore: Math.round(ratingScore * 100) / 100,
      balanceScore: Math.round(balanceScore * 100) / 100,
      valueScore: Math.round(valueScore * 100) / 100,
      compliance: compliance,
      disqualified: false
    };
  });
  
  // Sort by score (highest first)
  scoredTeams.sort((a, b) => b.score - a.score);
  
  // Determine winner (highest scoring compliant team)
  const winner = scoredTeams.find(team => !team.disqualified) || null;
  
  return {
    teams: scoredTeams,
    winner: winner,
    rankings: scoredTeams.map((team, index) => ({
      rank: index + 1,
      teamCode: team.code,
      teamName: team.name,
      score: team.score,
      disqualified: team.disqualified
    }))
  };
}

module.exports = {
  generatePlayerPool,
  organizeIntoSets,
  getMinIncrement,
  validateBid,
  initializeTeam,
  shouldEndAuction,
  calculateTeamScores,
  checkRuleCompliance,
  STARTING_PURSE,
  MIN_SQUAD_SIZE,
  MAX_SQUAD_SIZE,
  MAX_OVERSEAS,
  TOTAL_PLAYERS,
  ROLES
};

