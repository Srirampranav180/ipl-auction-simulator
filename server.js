const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const auctionEngine = require("./auction-engine");
const playerPool = require("./player-pool");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Fixed IPL teams with their official colors
const IPL_TEAMS = [
  { code: "CSK", name: "Chennai Super Kings", color: "#FDB913", textColor: "#000000" },
  { code: "MI", name: "Mumbai Indians", color: "#004BA0", textColor: "#FFFFFF" },
  { code: "RCB", name: "Royal Challengers Bangalore", color: "#EC1C24", textColor: "#FFFFFF" },
  { code: "KKR", name: "Kolkata Knight Riders", color: "#3A225D", textColor: "#FFFFFF" },
  { code: "SRH", name: "Sunrisers Hyderabad", color: "#FF822A", textColor: "#000000" },
  { code: "DC", name: "Delhi Capitals", color: "#007A3D", textColor: "#FFFFFF" },
  { code: "RR", name: "Rajasthan Royals", color: "#E4007C", textColor: "#FFFFFF" },
  { code: "PBKS", name: "Punjab Kings", color: "#ED1C24", textColor: "#FFFFFF" },
  { code: "LSG", name: "Lucknow Super Giants", color: "#0057E2", textColor: "#FFFFFF" },
  { code: "GT", name: "Gujarat Titans", color: "#0C2340", textColor: "#FFFFFF" }
];

const rooms = {};
const auctionTimers = {}; // roomId -> timer object

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Create room
  socket.on("create-room", () => {
    const roomId = uuidv4().slice(0, 6);

    rooms[roomId] = {
      id: roomId,
      host: socket.id,  // Track who created the room
      teams: IPL_TEAMS.map(team => ({
        code: team.code,
        name: team.name,
        color: team.color,
        textColor: team.textColor,
        owner: "AI",     // AI by default
        socketId: null
      })),
      teamsLocked: false,  // Teams can be changed until locked
      auctionStarted: false,
      createdAt: new Date().toISOString()
    };

    socket.join(roomId);
    console.log("Room created:", roomId, "by", socket.id);
    socket.emit("room-created", { roomId, isHost: true });
    // Also send teams immediately
    const teamsData = getTeamsForClient(rooms[roomId].teams);
    socket.emit("joined-room", { teams: teamsData, isHost: true, teamsLocked: false });
  });

  // Join room
  socket.on("join-room", (roomId) => {
    if (!rooms[roomId]) {
      socket.emit("error", "Room not found");
      return;
    }
    socket.join(roomId);
    const room = rooms[roomId];
    const isHost = room.host === socket.id;
    console.log("User", socket.id, "joined room:", roomId, "isHost:", isHost);
    const teamsData = getTeamsForClient(room.teams);
    socket.emit("joined-room", { 
      teams: teamsData, 
      isHost: isHost, 
      teamsLocked: room.teamsLocked 
    });
  });

  // Pick team or deselect team
  socket.on("pick-team", ({ roomId, teamCode, playerName }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    // Prevent team changes if teams are locked
    if (room.teamsLocked) {
      socket.emit("error", "Teams are locked. Cannot change selection.");
      return;
    }

    if (!playerName || playerName.trim() === "") {
      socket.emit("error", "Please enter your name");
      return;
    }

    const team = room.teams.find(t => t.code === teamCode);
    if (!team) {
      socket.emit("error", "Team not found");
      return;
    }

    // Check if user already has a team selected
    const userCurrentTeam = room.teams.find(t => t.socketId === socket.id);

    // If clicking on already selected team, deselect it
    if (team.socketId === socket.id) {
      team.owner = "AI";
      team.socketId = null;
      team.playerName = null;
      const teamsData = getTeamsForClient(room.teams);
      io.to(roomId).emit("teams-updated", { teams: teamsData, teamsLocked: room.teamsLocked });
      return;
    }

    // If team is already taken by someone else
    if (team.owner === "HUMAN" && team.socketId !== socket.id) {
      socket.emit("error", "Team already selected by another player");
      return;
    }

    // If user already has a different team selected, prevent multiple selections
    if (userCurrentTeam && userCurrentTeam.code !== teamCode) {
      socket.emit("error", "You can only select one team. Deselect your current team first.");
      return;
    }

    // Select the team
    team.owner = "HUMAN";
    team.socketId = socket.id;
    team.playerName = playerName.trim();

    console.log(`Player ${playerName} selected team ${teamCode} in room ${roomId}`);

    // Broadcast to all users in room with proper team data
    const teamsData = getTeamsForClient(room.teams);
    io.to(roomId).emit("teams-updated", { teams: teamsData, teamsLocked: room.teamsLocked });
  });

  // Lock teams - only host can do this
  socket.on("lock-teams", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    // Only host can lock teams
    if (room.host !== socket.id) {
      socket.emit("error", "Only the room host can lock teams");
      return;
    }

    // Already locked
    if (room.teamsLocked) {
      socket.emit("error", "Teams are already locked");
      return;
    }

    // Lock teams
    room.teamsLocked = true;

    // Auto-assign remaining unselected teams to AI (they're already AI, but ensure consistency)
    room.teams.forEach(team => {
      if (team.owner === "AI") {
        // Ensure AI teams don't have socketId
        team.socketId = null;
      }
    });

    console.log("Teams locked for room:", roomId);
    
    console.log("Teams locked for room:", roomId);
    console.log("Teams:", room.teams.map(t => ({ code: t.code, owner: t.owner, playerName: t.playerName })));
    
    // Notify all users in the room with proper team data
    const teamsData = getTeamsForClient(room.teams);
    io.to(roomId).emit("teams-locked", { teams: teamsData });
    io.to(roomId).emit("teams-updated", { teams: teamsData, teamsLocked: true });
  });

  // Start auction - only host can do this
  socket.on("start-auction", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    // Only host can start auction
    if (room.host !== socket.id) {
      socket.emit("error", "Only the room host can start the auction");
      return;
    }

    // Teams must be locked first
    if (!room.teamsLocked) {
      socket.emit("error", "Teams must be locked before starting auction");
      return;
    }

    // Already started
    if (room.auctionStarted) {
      socket.emit("error", "Auction has already started");
      return;
    }

    // Initialize auction
    initializeAuction(room);
    
    // Start auction
    room.auctionStarted = true;
    console.log("Auction started for room:", roomId);
    
    // Notify all users in the room
    io.to(roomId).emit("auction-started", { 
      message: "Auction has begun!",
      currentPlayer: room.currentPlayer,
      teams: getTeamsForClient(room.teams)
    });

    // Start the first player auction
    startPlayerAuction(roomId);
  });

  // Place bid
  socket.on("place-bid", ({ roomId, bidAmount }) => {
    const room = rooms[roomId];
    if (!room || !room.auctionStarted) {
      socket.emit("error", "Auction not started");
      return;
    }

    if (!room.currentPlayer) {
      socket.emit("error", "No active player");
      return;
    }

    // Find user's team
    const team = room.teams.find(t => t.socketId === socket.id);
    if (!team) {
      socket.emit("error", "You don't have a team selected");
      return;
    }

    // Validate bid - must be at least base price if no current bid
    const minBid = room.currentBid || room.currentPlayer.basePrice;
    const validation = auctionEngine.validateBid(
      team,
      bidAmount,
      minBid,
      room.currentPlayer
    );

    if (!validation.valid) {
      socket.emit("error", validation.error);
      return;
    }

    // Update bid
    room.currentBid = bidAmount;
    room.currentBidder = team.code;
    room.timer = 10; // Reset to 10 seconds after bid

    console.log(`Team ${team.code} bid ₹${bidAmount} Cr for ${room.currentPlayer.name}`);

    // Broadcast update
    io.to(roomId).emit("bid-update", {
      currentPlayer: room.currentPlayer,
      currentBid: room.currentBid,
      currentBidder: room.currentBidder,
      timer: room.timer,
      teams: getTeamsForClient(room.teams)
    });
  });

  // Get current auction state (for rejoin/refresh)
  socket.on("get-auction-state", ({ roomId }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    if (room.auctionStarted) {
      socket.emit("auction-state", {
        currentPlayer: room.currentPlayer,
        currentBid: room.currentBid,
        currentBidder: room.currentBidder,
        timer: room.timer,
        teams: getTeamsForClient(room.teams),
        playerIndex: room.playerIndex,
        totalPlayers: room.totalPlayers
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    // Handle disconnect - team temporarily switches to AI
    // (Can be enhanced later for rejoin)
  });
});

// Initialize auction for a room
function initializeAuction(room) {
  // Generate player pool
  const players = auctionEngine.generatePlayerPool();
  const sets = auctionEngine.organizeIntoSets(players);
  
  // Flatten sets into auction order
  const auctionOrder = [
    ...sets['Top-order Batters'],
    ...sets['All-rounders'],
    ...sets['Wicketkeepers'],
    ...sets['Middle-order Batters'],
    ...sets['Fast Bowlers'],
    ...sets['Spinners'],
    ...sets['Uncapped Players']
  ];

  // Initialize teams with auction data
  room.teams = room.teams.map(team => auctionEngine.initializeTeam(team));
  
  // Store auction state
  room.playerPool = auctionOrder;
  room.playerIndex = 0;
  room.totalPlayers = auctionOrder.length;
  room.currentPlayer = null;
  room.currentBid = null;
  room.currentBidder = null;
  room.timer = null;
}

  // Start auction for current player
function startPlayerAuction(roomId) {
  const room = rooms[roomId];
  if (!room || !room.auctionStarted) return;

  // Check if auction should end
  if (auctionEngine.shouldEndAuction(room.teams) || room.playerIndex >= room.playerPool.length) {
    endAuction(roomId);
    return;
  }

  // Get next player
  room.currentPlayer = room.playerPool[room.playerIndex];
  room.currentBid = null;
  room.currentBidder = null;
  room.timer = 15; // Start with 15 seconds

  console.log(`Auctioning: ${room.currentPlayer.name} (${room.currentPlayer.role}, ${room.currentPlayer.nationality}) - Base Price: ₹${room.currentPlayer.basePrice} Cr`);

  // Broadcast new player with base price as starting bid
  io.to(roomId).emit("new-player", {
    currentPlayer: room.currentPlayer,
    currentBid: null,
    currentBidder: null,
    basePrice: room.currentPlayer.basePrice,
    timer: room.timer,
    teams: getTeamsForClient(room.teams),
    playerIndex: room.playerIndex + 1,
    totalPlayers: room.totalPlayers
  });

  // Start timer
  startTimer(roomId);
  
  // Trigger AI bids after a short delay
  setTimeout(() => {
    processAIBids(roomId);
  }, 2000);
}

// Timer management
function startTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // Clear existing timer
  if (auctionTimers[roomId]) {
    clearInterval(auctionTimers[roomId]);
  }

  auctionTimers[roomId] = setInterval(() => {
    if (!room.currentPlayer) {
      clearInterval(auctionTimers[roomId]);
      return;
    }

    room.timer--;

    // Broadcast timer update every second
    io.to(roomId).emit("timer-update", {
      timer: room.timer,
      currentBid: room.currentBid,
      currentBidder: room.currentBidder
    });

    // Timer expired
    if (room.timer <= 0) {
      clearInterval(auctionTimers[roomId]);
      handlePlayerSold(roomId);
    }
  }, 1000);
}

// Handle player sold/unsold
function handlePlayerSold(roomId) {
  const room = rooms[roomId];
  if (!room || !room.currentPlayer) return;

  if (room.currentBid && room.currentBidder) {
    // SOLD
    const team = room.teams.find(t => t.code === room.currentBidder);
    if (team) {
      team.squad.push({
        ...room.currentPlayer,
        price: room.currentBid
      });
      team.purse -= room.currentBid;
      if (room.currentPlayer.isOverseas) {
        team.overseasCount++;
      }
      team.roleCount[room.currentPlayer.role] = (team.roleCount[room.currentPlayer.role] || 0) + 1;

      console.log(`SOLD: ${room.currentPlayer.name} to ${team.code} for ₹${room.currentBid} Cr`);
      
      io.to(roomId).emit("player-sold", {
        player: room.currentPlayer,
        team: team.code,
        price: room.currentBid,
        teams: getTeamsForClient(room.teams)
      });
    }
  } else {
    // UNSOLD
    console.log(`UNSOLD: ${room.currentPlayer.name}`);
    io.to(roomId).emit("player-unsold", {
      player: room.currentPlayer,
      teams: getTeamsForClient(room.teams)
    });
  }

  // Move to next player
  room.playerIndex++;
  setTimeout(() => {
    startPlayerAuction(roomId);
  }, 2000);
}

// Process AI bids
function processAIBids(roomId) {
  const room = rooms[roomId];
  if (!room || !room.currentPlayer) return;

  // Only process if no human has bid yet, or periodically
  const shouldBid = !room.currentBid || Math.random() < 0.3;

  if (shouldBid) {
    room.teams.forEach(team => {
      if (team.owner === "AI" && team.socketId === null) {
        const aiBid = calculateAIBid(team, room.currentPlayer, room.currentBid || room.currentPlayer.basePrice);
        if (aiBid) {
          // Simulate AI bid
          const currentPlayerId = room.currentPlayer.id;
          setTimeout(() => {
            if (room.currentPlayer && room.currentPlayer.id === currentPlayerId) {
              const validation = auctionEngine.validateBid(team, aiBid, room.currentBid || room.currentPlayer.basePrice, room.currentPlayer);
              if (validation.valid) {
                room.currentBid = aiBid;
                room.currentBidder = team.code;
                room.timer = 10;

                console.log(`AI Team ${team.code} bid ₹${aiBid} Cr for ${room.currentPlayer.name}`);

                io.to(roomId).emit("bid-update", {
                  currentPlayer: room.currentPlayer,
                  currentBid: room.currentBid,
                  currentBidder: room.currentBidder,
                  timer: room.timer,
                  teams: getTeamsForClient(room.teams)
                });

                // Continue AI bidding
                setTimeout(() => processAIBids(roomId), 3000);
              }
            }
          }, Math.random() * 2000);
        }
      }
    });
  }
}

// Calculate AI bid
function calculateAIBid(team, player, currentBid) {
  // AI bidding logic
  const basePrice = currentBid || player.basePrice;
  const minIncrement = auctionEngine.getMinIncrement(basePrice);
  const maxBid = Math.min(team.purse, basePrice + (minIncrement * 5)); // AI won't overbid too much

  // Check if team needs this player
  const needsPlayer = shouldAIBid(team, player);
  if (!needsPlayer) return null;

  // Calculate bid based on rating and need
  const needFactor = getNeedFactor(team, player);
  const bidAmount = basePrice + (minIncrement * (1 + needFactor * 2));
  
  if (bidAmount <= maxBid && bidAmount <= team.purse) {
    return Math.round(bidAmount * 100) / 100;
  }
  
  return null;
}

// Should AI bid on this player?
function shouldAIBid(team, player) {
  // Check squad size
  if (team.squad.length >= auctionEngine.MAX_SQUAD_SIZE) return false;
  
  // Check overseas limit
  if (player.isOverseas && team.overseasCount >= auctionEngine.MAX_OVERSEAS) return false;
  
  // Check purse
  if (team.purse < player.basePrice) return false;
  
  // Check if team needs this role
  const roleCount = team.roleCount[player.role] || 0;
  const minRequired = player.role === auctionEngine.ROLES.WICKETKEEPER ? 1 : 2;
  
  return roleCount < minRequired || (team.squad.length < auctionEngine.MIN_SQUAD_SIZE);
}

// Get need factor for AI bidding (0-1)
function getNeedFactor(team, player) {
  let factor = 0.5; // Base factor
  
  // Role need
  const roleCount = team.roleCount[player.role] || 0;
  if (roleCount === 0) factor += 0.3;
  if (team.squad.length < auctionEngine.MIN_SQUAD_SIZE) factor += 0.2;
  
  // Rating factor
  if (player.rating >= 80) factor += 0.2;
  else if (player.rating >= 60) factor += 0.1;
  
  return Math.min(factor, 1.0);
}

// End auction
function endAuction(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  if (auctionTimers[roomId]) {
    clearInterval(auctionTimers[roomId]);
    delete auctionTimers[roomId];
  }

  console.log(`Auction ended for room: ${roomId}`);
  io.to(roomId).emit("auction-ended", {
    teams: getTeamsForClient(room.teams),
    message: "Auction has ended!"
  });
}

// Get teams data for client (sanitize sensitive data)
function getTeamsForClient(teams) {
  return teams.map(team => ({
    code: team.code,
    name: team.name,
    color: team.color,
    textColor: team.textColor,
    owner: team.owner,
    socketId: team.socketId,
    playerName: team.playerName || null,
    purse: team.purse !== undefined ? team.purse : 100, // Default to 100 if not initialized
    squadSize: team.squad ? team.squad.length : 0,
    overseasCount: team.overseasCount !== undefined ? team.overseasCount : 0,
    roleCount: team.roleCount || {},
    squad: team.squad || [] // Include squad for display
  }));
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`Access from other devices: http://${getLocalIP()}:${PORT}`);
});

// Helper function to get local IP address
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
