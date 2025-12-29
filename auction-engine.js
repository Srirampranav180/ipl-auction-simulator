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

module.exports = {
  generatePlayerPool,
  organizeIntoSets,
  getMinIncrement,
  validateBid,
  initializeTeam,
  shouldEndAuction,
  STARTING_PURSE,
  MIN_SQUAD_SIZE,
  MAX_SQUAD_SIZE,
  MAX_OVERSEAS,
  TOTAL_PLAYERS,
  ROLES
};

