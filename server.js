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

// Explicit root route handler
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

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
const processingPlayers = {}; // roomId -> boolean (prevents duplicate processing)
const lastPlayerUpdate = {}; // roomId -> timestamp (for watchdog)
const watchdogs = {}; // roomId -> watchdog timer

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

    // Check if team has skipped this player
    if (room.skippedTeams && room.skippedTeams.includes(team.code)) {
      socket.emit("error", "You have skipped this player. Cannot bid.");
      return;
    }

    // Validate bid - pass null if no current bid, so validation knows it's the first bid
    const validation = auctionEngine.validateBid(
      team,
      bidAmount,
      room.currentBid, // null if no bids yet
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

    // Restart timer to ensure it's properly reset
    if (auctionTimers[roomId]) {
      clearInterval(auctionTimers[roomId]);
      delete auctionTimers[roomId];
    }
    startTimer(roomId);

    // Broadcast update
    io.to(roomId).emit("bid-update", {
      currentPlayer: room.currentPlayer,
      currentBid: room.currentBid,
      currentBidder: room.currentBidder,
      timer: room.timer,
      teams: getTeamsForClient(room.teams),
      skippedTeams: room.skippedTeams || []
    });
  });

  // Skip player
  socket.on("skip-player", ({ roomId }) => {
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

    // Initialize skippedTeams array if it doesn't exist
    if (!room.skippedTeams) {
      room.skippedTeams = [];
    }

    // Check if already skipped
    if (room.skippedTeams.includes(team.code)) {
      socket.emit("error", "You have already skipped this player");
      return;
    }

    // Add team to skipped list
    room.skippedTeams.push(team.code);
    console.log(`Team ${team.code} skipped ${room.currentPlayer.name}`);

    // Broadcast skip update
    io.to(roomId).emit("player-skipped", {
      teamCode: team.code,
      teamName: team.name,
      playerName: room.currentPlayer.name,
      skippedTeams: room.skippedTeams,
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
        totalPlayers: room.totalPlayers,
        skippedTeams: room.skippedTeams || []
      });
    }
  });

  // Leave room
  socket.on("leave-room", ({ roomId }) => {
    socket.leave(roomId);
    console.log("User", socket.id, "left room:", roomId);
    socket.emit("left-room");
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
  room.skippedTeams = []; // Track teams that skipped current player
}

  // Start auction for current player
function startPlayerAuction(roomId) {
  try {
    const room = rooms[roomId];
    if (!room) {
      console.log(`[${roomId}] ERROR: Room not found in startPlayerAuction`);
      if (auctionTimers[roomId]) {
        clearInterval(auctionTimers[roomId]);
        delete auctionTimers[roomId];
      }
      delete processingPlayers[roomId];
      return;
    }

    if (!room.auctionStarted) {
      console.log(`[${roomId}] ERROR: Auction not started in startPlayerAuction`);
      if (auctionTimers[roomId]) {
        clearInterval(auctionTimers[roomId]);
        delete auctionTimers[roomId];
      }
      delete processingPlayers[roomId];
      return;
    }

    // Ensure no processing flag is set
    delete processingPlayers[roomId];

    // Check if auction should end
    const shouldEnd = auctionEngine.shouldEndAuction(room.teams);
    const outOfPlayers = room.playerIndex >= room.playerPool.length;
    
    if (shouldEnd || outOfPlayers) {
      console.log(`[${roomId}] Ending auction: shouldEnd=${shouldEnd}, outOfPlayers=${outOfPlayers}, index=${room.playerIndex}, poolLength=${room.playerPool.length}`);
      endAuction(roomId);
      return;
    }

    // Ensure we have a valid player index
    if (room.playerIndex >= room.playerPool.length) {
      console.log(`[${roomId}] ERROR: Invalid player index ${room.playerIndex} >= ${room.playerPool.length}`);
      endAuction(roomId);
      return;
    }

    if (!room.playerPool || !room.playerPool[room.playerIndex]) {
      console.log(`[${roomId}] ERROR: No player at index ${room.playerIndex}`);
      endAuction(roomId);
      return;
    }

    // Get next player
    room.currentPlayer = room.playerPool[room.playerIndex];
    room.currentBid = null;
    room.currentBidder = null;
    room.timer = 15; // Start with 15 seconds
    room.skippedTeams = []; // Reset skipped teams for new player

    console.log(`[${roomId}] Auctioning player ${room.playerIndex + 1}/${room.totalPlayers}: ${room.currentPlayer.name} (${room.currentPlayer.role}, ${room.currentPlayer.nationality}) - Base Price: ₹${room.currentPlayer.basePrice} Cr`);

    // Broadcast new player with base price as starting bid
    io.to(roomId).emit("new-player", {
      currentPlayer: room.currentPlayer,
      currentBid: null,
      currentBidder: null,
      basePrice: room.currentPlayer.basePrice,
      timer: room.timer,
      teams: getTeamsForClient(room.teams),
      playerIndex: room.playerIndex + 1,
      totalPlayers: room.totalPlayers,
      skippedTeams: room.skippedTeams
    });

    // Update last player update timestamp for watchdog
    lastPlayerUpdate[roomId] = Date.now();

    // Start timer
    startTimer(roomId);
    
    // Trigger AI bids after a short delay
    setTimeout(() => {
      processAIBids(roomId);
    }, 2000);
    
    // Start watchdog for this player (safety mechanism)
    startWatchdog(roomId);
  } catch (error) {
    console.error(`[${roomId}] CRITICAL ERROR in startPlayerAuction:`, error);
    console.error(error.stack);
    delete processingPlayers[roomId];
    // Try to continue
    const room = rooms[roomId];
    if (room && room.auctionStarted) {
      room.playerIndex++;
      if (room.playerIndex < room.playerPool.length) {
        setTimeout(() => {
          try {
            startPlayerAuction(roomId);
          } catch (e) {
            console.error(`[${roomId}] Failed to recover:`, e);
          }
        }, 2000);
      } else {
        endAuction(roomId);
      }
    }
  }
}

// Timer management
function startTimer(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // Clear existing timer
  if (auctionTimers[roomId]) {
    clearInterval(auctionTimers[roomId]);
    delete auctionTimers[roomId];
  }

  auctionTimers[roomId] = setInterval(() => {
    const currentRoom = rooms[roomId];
    if (!currentRoom || !currentRoom.currentPlayer) {
      clearInterval(auctionTimers[roomId]);
      delete auctionTimers[roomId];
      return;
    }

    currentRoom.timer--;

    // Broadcast timer update every second
    io.to(roomId).emit("timer-update", {
      timer: currentRoom.timer,
      currentBid: currentRoom.currentBid,
      currentBidder: currentRoom.currentBidder,
      skippedTeams: currentRoom.skippedTeams || []
    });

    // Timer expired
    if (currentRoom.timer <= 0) {
      console.log(`[${roomId}] Timer expired for player ${currentRoom.playerIndex + 1}: ${currentRoom.currentPlayer?.name || 'Unknown'}`);
      clearInterval(auctionTimers[roomId]);
      delete auctionTimers[roomId];
      // Clear watchdog since we're processing
      if (watchdogs[roomId]) {
        clearTimeout(watchdogs[roomId]);
        delete watchdogs[roomId];
      }
      // Use setTimeout to ensure timer is fully cleared before processing
      setTimeout(() => {
        handlePlayerSold(roomId);
      }, 100);
    }
  }, 1000);
}

// Handle player sold/unsold
function handlePlayerSold(roomId) {
  try {
    // Prevent duplicate processing
    if (processingPlayers[roomId]) {
      console.log(`[${roomId}] Already processing player, skipping...`);
      return;
    }

    const room = rooms[roomId];
    if (!room) {
      console.log(`[${roomId}] Room not found in handlePlayerSold`);
      delete processingPlayers[roomId];
      return;
    }

    if (!room.currentPlayer) {
      console.log(`[${roomId}] No current player in handlePlayerSold`);
      if (auctionTimers[roomId]) {
        clearInterval(auctionTimers[roomId]);
        delete auctionTimers[roomId];
      }
      delete processingPlayers[roomId];
      return;
    }

    if (!room.auctionStarted) {
      console.log(`[${roomId}] Auction not started in handlePlayerSold`);
      if (auctionTimers[roomId]) {
        clearInterval(auctionTimers[roomId]);
        delete auctionTimers[roomId];
      }
      delete processingPlayers[roomId];
      return;
    }

    // Mark as processing
    processingPlayers[roomId] = true;

    // Store current player data before clearing
    const currentPlayer = room.currentPlayer;
    const currentBid = room.currentBid;
    const currentBidder = room.currentBidder;
    const currentIndex = room.playerIndex;

    console.log(`[${roomId}] Processing player ${currentIndex + 1}/${room.totalPlayers}: ${currentPlayer.name}, Bid: ${currentBid || 'None'}, Bidder: ${currentBidder || 'None'}`);

    // Clear timer if still running
    if (auctionTimers[roomId]) {
      clearInterval(auctionTimers[roomId]);
      delete auctionTimers[roomId];
    }

    if (currentBid && currentBidder) {
      // SOLD
      const team = room.teams.find(t => t.code === currentBidder);
      if (team) {
        team.squad.push({
          ...currentPlayer,
          price: currentBid
        });
        team.purse -= currentBid;
        if (currentPlayer.isOverseas) {
          team.overseasCount++;
        }
        team.roleCount[currentPlayer.role] = (team.roleCount[currentPlayer.role] || 0) + 1;

        console.log(`[${roomId}] SOLD: ${currentPlayer.name} to ${team.code} for ₹${currentBid} Cr`);
        
        io.to(roomId).emit("player-sold", {
          player: currentPlayer,
          team: team.code,
          price: currentBid,
          teams: getTeamsForClient(room.teams)
        });
      } else {
        console.log(`[${roomId}] ERROR: Team ${currentBidder} not found for SOLD player`);
      }
    } else {
      // UNSOLD
      console.log(`[${roomId}] UNSOLD: ${currentPlayer.name}`);
      io.to(roomId).emit("player-unsold", {
        player: currentPlayer,
        teams: getTeamsForClient(room.teams)
      });
    }

    // Clear current player state
    room.currentPlayer = null;
    room.currentBid = null;
    room.currentBidder = null;
    room.skippedTeams = [];

    // Move to next player
    room.playerIndex++;
    
    console.log(`[${roomId}] Moved to player index ${room.playerIndex}/${room.totalPlayers}`);
    
    // Clear processing flag BEFORE async operations
    delete processingPlayers[roomId];
    
    // Check if we should end before starting next player
    const shouldEnd = auctionEngine.shouldEndAuction(room.teams);
    const outOfPlayers = room.playerIndex >= room.playerPool.length;
    
    console.log(`[${roomId}] Should end? ${shouldEnd}, Out of players? ${outOfPlayers}`);
    
    if (shouldEnd || outOfPlayers) {
      console.log(`[${roomId}] Ending auction...`);
      setTimeout(() => {
        endAuction(roomId);
      }, 2000);
      return;
    }

    // Start next player auction with error handling
    console.log(`[${roomId}] Scheduling next player auction in 2 seconds...`);
    setTimeout(() => {
      try {
        const nextRoom = rooms[roomId];
        if (!nextRoom) {
          console.log(`[${roomId}] ERROR: Room not found when starting next player`);
          return;
        }
        if (!nextRoom.auctionStarted) {
          console.log(`[${roomId}] ERROR: Auction not started when starting next player`);
          return;
        }
        console.log(`[${roomId}] Starting next player auction (index ${nextRoom.playerIndex})...`);
        startPlayerAuction(roomId);
      } catch (error) {
        console.error(`[${roomId}] ERROR in setTimeout for next player:`, error);
        // Retry once after 1 second
        setTimeout(() => {
          try {
            startPlayerAuction(roomId);
          } catch (retryError) {
            console.error(`[${roomId}] ERROR in retry:`, retryError);
          }
        }, 1000);
      }
    }, 2000);
  } catch (error) {
    console.error(`[${roomId}] CRITICAL ERROR in handlePlayerSold:`, error);
    console.error(error.stack);
    // Cleanup and try to continue
    delete processingPlayers[roomId];
    if (auctionTimers[roomId]) {
      clearInterval(auctionTimers[roomId]);
      delete auctionTimers[roomId];
    }
    // Try to continue to next player
    const room = rooms[roomId];
    if (room && room.auctionStarted) {
      room.playerIndex++;
      setTimeout(() => {
        try {
          startPlayerAuction(roomId);
        } catch (e) {
          console.error(`[${roomId}] Failed to recover:`, e);
        }
      }, 2000);
    }
  }
}

// Process AI bids
function processAIBids(roomId) {
  const room = rooms[roomId];
  if (!room || !room.currentPlayer || !room.auctionStarted) return;

  // Don't process if we're already processing a player sale
  if (processingPlayers[roomId]) return;

  // Only process if no human has bid yet, or periodically
  const shouldBid = !room.currentBid || Math.random() < 0.3;

  if (shouldBid) {
    room.teams.forEach(team => {
      if (team.owner === "AI" && team.socketId === null) {
        // Check if team has skipped this player
        if (room.skippedTeams && room.skippedTeams.includes(team.code)) {
          return; // Skip this team
        }

        const aiBid = calculateAIBid(team, room.currentPlayer, room.currentBid);
        if (aiBid) {
          // Simulate AI bid
          const currentPlayerId = room.currentPlayer.id;
          setTimeout(() => {
            const currentRoom = rooms[roomId];
            if (currentRoom && currentRoom.currentPlayer && currentRoom.currentPlayer.id === currentPlayerId && currentRoom.auctionStarted && !processingPlayers[roomId]) {
              const validation = auctionEngine.validateBid(team, aiBid, currentRoom.currentBid, currentRoom.currentPlayer);
              if (validation.valid) {
                currentRoom.currentBid = aiBid;
                currentRoom.currentBidder = team.code;
                currentRoom.timer = 10;

                console.log(`AI Team ${team.code} bid ₹${aiBid} Cr for ${currentRoom.currentPlayer.name}`);

                // Restart timer to ensure it's properly reset
                if (auctionTimers[roomId]) {
                  clearInterval(auctionTimers[roomId]);
                  delete auctionTimers[roomId];
                }
                startTimer(roomId);

                io.to(roomId).emit("bid-update", {
                  currentPlayer: currentRoom.currentPlayer,
                  currentBid: currentRoom.currentBid,
                  currentBidder: currentRoom.currentBidder,
                  timer: currentRoom.timer,
                  teams: getTeamsForClient(currentRoom.teams),
                  skippedTeams: currentRoom.skippedTeams || []
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
  // Check if team needs this player
  const needsPlayer = shouldAIBid(team, player);
  if (!needsPlayer) return null;

  // If no current bid, AI can bid at base price or slightly above
  if (currentBid === null || currentBid === undefined) {
    const needFactor = getNeedFactor(team, player);
    // Sometimes bid exactly base price, sometimes slightly above
    const bidAmount = player.basePrice + (needFactor > 0.5 ? auctionEngine.getMinIncrement(player.basePrice) : 0);
    
    if (bidAmount <= team.purse) {
      return Math.round(bidAmount * 100) / 100;
    }
    return null;
  }

  // If there's already a bid, calculate increment
  const minIncrement = auctionEngine.getMinIncrement(currentBid);
  const maxBid = Math.min(team.purse, currentBid + (minIncrement * 5)); // AI won't overbid too much

  // Calculate bid based on rating and need
  const needFactor = getNeedFactor(team, player);
  const bidAmount = currentBid + (minIncrement * (1 + needFactor * 2));
  
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

// Watchdog function to detect stuck auctions
function startWatchdog(roomId) {
  // Clear existing watchdog
  if (watchdogs[roomId]) {
    clearTimeout(watchdogs[roomId]);
  }
  
  // Set watchdog to check after 20 seconds (timer is 15s, so 20s should be safe)
  watchdogs[roomId] = setTimeout(() => {
    const room = rooms[roomId];
    if (!room || !room.auctionStarted) {
      delete watchdogs[roomId];
      return;
    }
    
    // Check if timer is at 0 and player hasn't been processed
    if (room.timer !== undefined && room.timer <= 0 && room.currentPlayer && !processingPlayers[roomId]) {
      console.log(`[${roomId}] WATCHDOG: Timer at 0 but player not processed. Forcing handlePlayerSold...`);
      // Force process the player
      handlePlayerSold(roomId);
    } else if (room.currentPlayer && lastPlayerUpdate[roomId]) {
      // Check if player has been stuck for more than 25 seconds
      const timeSinceUpdate = Date.now() - lastPlayerUpdate[roomId];
      if (timeSinceUpdate > 25000 && !processingPlayers[roomId]) {
        console.log(`[${roomId}] WATCHDOG: Player stuck for ${timeSinceUpdate}ms. Forcing next player...`);
        handlePlayerSold(roomId);
      } else {
        // Continue watching
        startWatchdog(roomId);
      }
    } else {
      // Continue watching
      startWatchdog(roomId);
    }
  }, 5000); // Check every 5 seconds
}

// End auction
function endAuction(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  // Stop auction
  room.auctionStarted = false;
  room.currentPlayer = null;
  room.currentBid = null;
  room.currentBidder = null;

  // Clear timer
  if (auctionTimers[roomId]) {
    clearInterval(auctionTimers[roomId]);
    delete auctionTimers[roomId];
  }

  // Clear watchdog
  if (watchdogs[roomId]) {
    clearTimeout(watchdogs[roomId]);
    delete watchdogs[roomId];
  }

  // Clear processing flag
  delete processingPlayers[roomId];
  delete lastPlayerUpdate[roomId];

  // Calculate final statistics and determine winner
  const teamScores = auctionEngine.calculateTeamScores(room.teams);
  
  const finalStats = {
    totalPlayersAuctioned: room.playerIndex,
    totalPlayersSold: room.teams.reduce((sum, team) => sum + team.squad.length, 0),
    teams: getTeamsForClient(room.teams).map(team => {
      const scoredTeam = teamScores.teams.find(t => t.code === team.code);
      return {
        ...team,
        totalSpent: auctionEngine.STARTING_PURSE - team.purse,
        playersBought: team.squad.length,
        averagePrice: team.squad.length > 0 
          ? (auctionEngine.STARTING_PURSE - team.purse) / team.squad.length 
          : 0,
        score: scoredTeam ? scoredTeam.score : 0,
        ratingScore: scoredTeam ? scoredTeam.ratingScore : 0,
        balanceScore: scoredTeam ? scoredTeam.balanceScore : 0,
        valueScore: scoredTeam ? scoredTeam.valueScore : 0,
        disqualified: scoredTeam ? scoredTeam.disqualified : true,
        compliance: scoredTeam ? scoredTeam.compliance : { compliant: false, violations: ["Team data not found"] }
      };
    }),
    winner: teamScores.winner ? {
      code: teamScores.winner.code,
      name: teamScores.winner.name,
      playerName: teamScores.winner.playerName,
      score: teamScores.winner.score
    } : null,
    rankings: teamScores.rankings
  };

  console.log(`Auction ended for room: ${roomId}`);
  console.log(`Final stats: ${finalStats.totalPlayersSold} players sold across ${finalStats.teams.length} teams`);
  if (finalStats.winner) {
    console.log(`Winner: ${finalStats.winner.name} (${finalStats.winner.code}) with score ${finalStats.winner.score}`);
  } else {
    console.log(`No winner: All teams disqualified`);
  }
  
  io.to(roomId).emit("auction-ended", {
    teams: finalStats.teams,
    stats: finalStats,
    winner: finalStats.winner,
    rankings: finalStats.rankings,
    message: finalStats.winner 
      ? `Auction Complete! Winner: ${finalStats.winner.name}` 
      : "Auction Complete! (No winner - all teams disqualified)"
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
