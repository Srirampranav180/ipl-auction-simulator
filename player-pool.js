// Real IPL Player Pool
// This file contains the actual player list provided by the user

const ROLES = {
  BATTER: 'Batter',
  BOWLER: 'Bowler',
  ALL_ROUNDER: 'All-rounder',
  WICKETKEEPER: 'Wicketkeeper'
};

// Star players - only Virat, Rohit, Dhoni have special prices, rest default to 2 Cr
const STAR_PLAYERS = {
  'MS Dhoni': { rating: 95, basePrice: 10.0 },
  'Virat Kohli': { rating: 95, basePrice: 9.0 },
  'Rohit Sharma': { rating: 93, basePrice: 9.0 }
};

// Generate player pool from the provided list
function generatePlayerPool() {
  const players = [];
  let playerId = 1;

  // BATTERS (INDIAN)
  const indianBatters = [
    'Virat Kohli', 'Rohit Sharma', 'Shikhar Dhawan', 'KL Rahul', 'Ruturaj Gaikwad',
    'Shubman Gill', 'Yashasvi Jaiswal', 'Suryakumar Yadav', 'Ajinkya Rahane', 'Cheteshwar Pujara',
    'Mayank Agarwal', 'Shreyas Iyer', 'Manish Pandey', 'Prithvi Shaw', 'Devdutt Padikkal',
    'Tilak Varma', 'Rinku Singh', 'Abhishek Sharma', 'Ishan Kishan', 'Sarfaraz Khan',
    'Rahul Tripathi', 'Sai Sudharsan', 'Hanuma Vihari', 'Karun Nair'
  ];

  indianBatters.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `IND_${playerId++}`,
      name: name,
      role: ROLES.BATTER,
      nationality: 'Indian',
      isOverseas: false,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.BATTER, false, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.BATTER)
    });
  });

  // BATTERS (OVERSEAS)
  const overseasBatters = [
    'David Warner', 'Steve Smith', 'Kane Williamson', 'Joe Root', 'Babar Azam',
    'Faf du Plessis', 'AB de Villiers', 'Chris Gayle', 'Brendon McCullum', 'Aaron Finch',
    'Jason Roy', 'Travis Head', 'Usman Khawaja', 'Devon Conway', 'Mitchell Marsh',
    'Dawid Malan', 'Jonny Bairstow', 'Ben Duckett', 'Rassie van der Dussen',
    'Pathum Nissanka', 'Alex Hales', 'Finn Allen'
  ];
  // Note: Quinton de Kock is in wicketkeepers list, so removed from here

  overseasBatters.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `OS_${playerId++}`,
      name: name,
      role: ROLES.BATTER,
      nationality: getNationalityForName(name),
      isOverseas: true,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.BATTER, true, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.BATTER)
    });
  });

  // ALL-ROUNDERS (INDIAN)
  const indianAllRounders = [
    'Hardik Pandya', 'Ravindra Jadeja', 'Axar Patel', 'Washington Sundar', 'Shivam Dube',
    'Venkatesh Iyer', 'Nitish Rana', 'Deepak Hooda', 'Krunal Pandya', 'Shahbaz Ahmed',
    'Rahul Tewatia', 'Vijay Shankar', 'Riyan Parag', 'Shams Mulani'
  ];
  // Note: Abhishek Sharma is already in batters list, so removed from here to avoid duplicate

  indianAllRounders.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `IND_${playerId++}`,
      name: name,
      role: ROLES.ALL_ROUNDER,
      nationality: 'Indian',
      isOverseas: false,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.ALL_ROUNDER, false, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.ALL_ROUNDER)
    });
  });

  // ALL-ROUNDERS (OVERSEAS)
  const overseasAllRounders = [
    'Ben Stokes', 'Glenn Maxwell', 'Marcus Stoinis', 'Andre Russell', 'Sunil Narine',
    'Dwayne Bravo', 'Kieron Pollard', 'Moeen Ali', 'Sam Curran', 'Cameron Green',
    'Liam Livingstone', 'Mitchell Santner', 'Rachin Ravindra', 'Wanindu Hasaranga', 'Jason Holder',
    'Shakib Al Hasan', 'Daniel Sams', 'Daryl Mitchell', 'George Linde'
  ];

  overseasAllRounders.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `OS_${playerId++}`,
      name: name,
      role: ROLES.ALL_ROUNDER,
      nationality: getNationalityForName(name),
      isOverseas: true,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.ALL_ROUNDER, true, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.ALL_ROUNDER)
    });
  });

  // WICKETKEEPERS (INDIAN)
  const indianWicketkeepers = [
    'MS Dhoni', 'Rishabh Pant', 'Sanju Samson', 'Wriddhiman Saha', 'KS Bharat',
    'Dinesh Karthik', 'Jitesh Sharma', 'Dhruv Jurel'
  ];

  indianWicketkeepers.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `IND_${playerId++}`,
      name: name,
      role: ROLES.WICKETKEEPER,
      nationality: 'Indian',
      isOverseas: false,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.WICKETKEEPER, false, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.WICKETKEEPER)
    });
  });

  // WICKETKEEPERS (OVERSEAS)
  const overseasWicketkeepers = [
    'Jos Buttler', 'Quinton de Kock', 'Jonny Bairstow', 'Nicholas Pooran', 'Tim Seifert',
    'Heinrich Klaasen', 'Josh Inglis', 'Ben McDermott'
  ];

  overseasWicketkeepers.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `OS_${playerId++}`,
      name: name,
      role: ROLES.WICKETKEEPER,
      nationality: getNationalityForName(name),
      isOverseas: true,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.WICKETKEEPER, true, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.WICKETKEEPER)
    });
  });

  // FAST BOWLERS (INDIAN)
  const indianFastBowlers = [
    'Jasprit Bumrah', 'Mohammed Shami', 'Mohammed Siraj', 'Ishant Sharma', 'Umesh Yadav',
    'Bhuvneshwar Kumar', 'Arshdeep Singh', 'Avesh Khan', 'Prasidh Krishna', 'Shardul Thakur',
    'Deepak Chahar', 'Mukesh Kumar', 'Navdeep Saini', 'Khaleel Ahmed', 'Chetan Sakariya'
  ];

  indianFastBowlers.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `IND_${playerId++}`,
      name: name,
      role: ROLES.BOWLER,
      nationality: 'Indian',
      isOverseas: false,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.BOWLER, false, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.BOWLER)
    });
  });

  // FAST BOWLERS (OVERSEAS)
  const overseasFastBowlers = [
    'Mitchell Starc', 'Pat Cummins', 'Josh Hazlewood', 'Trent Boult', 'Kagiso Rabada',
    'Anrich Nortje', 'Jofra Archer', 'Mark Wood', 'Lockie Ferguson', 'Alzarri Joseph',
    'Gerald Coetzee', 'Shaheen Afridi', 'Mustafizur Rahman', 'Tim Southee', 'Adam Milne',
    'Kyle Jamieson'
  ];

  overseasFastBowlers.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `OS_${playerId++}`,
      name: name,
      role: ROLES.BOWLER,
      nationality: getNationalityForName(name),
      isOverseas: true,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.BOWLER, true, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.BOWLER)
    });
  });

  // SPINNERS (INDIAN)
  const indianSpinners = [
    'Ravichandran Ashwin', 'Yuzvendra Chahal', 'Kuldeep Yadav', 'Ravi Bishnoi', 'Varun Chakravarthy',
    'Piyush Chawla', 'Amit Mishra', 'Rahul Chahar'
  ];
  // Note: Washington Sundar is in all-rounders list, so removed from here

  indianSpinners.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `IND_${playerId++}`,
      name: name,
      role: ROLES.BOWLER,
      nationality: 'Indian',
      isOverseas: false,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.BOWLER, false, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.BOWLER)
    });
  });

  // SPINNERS (OVERSEAS)
  const overseasSpinners = [
    'Rashid Khan', 'Mujeeb Ur Rahman', 'Adam Zampa', 'Tabraiz Shamsi', 'Adil Rashid',
    'Maheesh Theekshana', 'Akeal Hosein'
  ];

  overseasSpinners.forEach(name => {
    const starData = STAR_PLAYERS[name];
    players.push({
      id: `OS_${playerId++}`,
      name: name,
      role: ROLES.BOWLER,
      nationality: getNationalityForName(name),
      isOverseas: true,
      basePrice: starData ? starData.basePrice : getBasePriceForRole(ROLES.BOWLER, true, name),
      rating: starData ? starData.rating : getRatingForPlayer(name, ROLES.BOWLER)
    });
  });

  return players;
}

// Helper functions
function getBasePriceForRole(role, isOverseas, name) {
  // All players default to 2 Cr except Virat, Rohit, Dhoni
  return 2.0;
}

function getRatingForPlayer(name, role) {
  // Well-known players get higher ratings
  const wellKnown = ['Virat Kohli', 'Rohit Sharma', 'MS Dhoni', 'Jasprit Bumrah', 'David Warner',
                     'Ben Stokes', 'Jos Buttler', 'Pat Cummins', 'Rashid Khan', 'Ravindra Jadeja',
                     'Hardik Pandya', 'Shubman Gill', 'Suryakumar Yadav'];
  
  if (wellKnown.some(n => name.includes(n.split(' ')[0]))) {
    return Math.floor(Math.random() * 15) + 80; // 80-95
  }
  
  // Mid-tier: 60-79
  // Value picks: 40-59
  const rand = Math.random();
  if (rand < 0.4) return Math.floor(Math.random() * 20) + 60; // Mid-tier
  return Math.floor(Math.random() * 20) + 40; // Value
}

function getNationalityForName(name) {
  // Map names to nationalities
  const nationalityMap = {
    'David Warner': 'Australian', 'Steve Smith': 'Australian', 'Pat Cummins': 'Australian',
    'Mitchell Starc': 'Australian', 'Josh Hazlewood': 'Australian', 'Glenn Maxwell': 'Australian',
    'Marcus Stoinis': 'Australian', 'Cameron Green': 'Australian', 'Travis Head': 'Australian',
    'Usman Khawaja': 'Australian', 'Devon Conway': 'Australian', 'Mitchell Marsh': 'Australian',
    'Dawid Malan': 'Australian', 'Jonny Bairstow': 'Australian', 'Ben Duckett': 'Australian',
    'Tim Seifert': 'Australian', 'Josh Inglis': 'Australian', 'Ben McDermott': 'Australian',
    'Tim Southee': 'Australian', 'Adam Milne': 'Australian', 'Kyle Jamieson': 'Australian',
    'Mitchell Santner': 'Australian', 'Lockie Ferguson': 'Australian', 'Finn Allen': 'Australian',
    'Daryl Mitchell': 'Australian', 'Rachin Ravindra': 'Australian', 'Glenn Phillips': 'Australian',
    'Ish Sodhi': 'Australian', 'Adam Zampa': 'Australian',
    
    'Ben Stokes': 'English', 'Jos Buttler': 'English', 'Joe Root': 'English',
    'Sam Curran': 'English', 'Liam Livingstone': 'English', 'Moeen Ali': 'English',
    'Mark Wood': 'English', 'Jofra Archer': 'English', 'Jason Roy': 'English',
    'Adil Rashid': 'English', 'Chris Woakes': 'English',
    
    'Kane Williamson': 'New Zealand', 'Trent Boult': 'New Zealand',
    
    'Faf du Plessis': 'South African', 'Quinton de Kock': 'South African', 'Kagiso Rabada': 'South African',
    'Anrich Nortje': 'South African', 'Aiden Markram': 'South African', 'Heinrich Klaasen': 'South African',
    'Rassie van der Dussen': 'South African', 'Gerald Coetzee': 'South African', 'Tabraiz Shamsi': 'South African',
    'AB de Villiers': 'South African',
    
    'Babar Azam': 'Pakistani', 'Shaheen Afridi': 'Pakistani',
    
    'Mustafizur Rahman': 'Bangladeshi', 'Shakib Al Hasan': 'Bangladeshi', 'Litton Das': 'Bangladeshi',
    'Taskin Ahmed': 'Bangladeshi', 'Mehidy Hasan': 'Bangladeshi',
    
    'Rashid Khan': 'Afghan', 'Mujeeb Ur Rahman': 'Afghan', 'Mohammad Nabi': 'Afghan',
    'Rahmanullah Gurbaz': 'Afghan', 'Noor Ahmad': 'Afghan',
    
    'Pathum Nissanka': 'Sri Lankan', 'Maheesh Theekshana': 'Sri Lankan', 'Dushmantha Chameera': 'Sri Lankan',
    'Bhanuka Rajapaksa': 'Sri Lankan', 'Wanindu Hasaranga': 'Sri Lankan',
    
    'Nicholas Pooran': 'West Indian', 'Andre Russell': 'West Indian', 'Sunil Narine': 'West Indian',
    'Dwayne Bravo': 'West Indian', 'Kieron Pollard': 'West Indian', 'Jason Holder': 'West Indian',
    'Alzarri Joseph': 'West Indian', 'Akeal Hosein': 'West Indian', 'George Linde': 'West Indian',
    
    'Brendon McCullum': 'New Zealand', 'Chris Gayle': 'West Indian', 'Aaron Finch': 'Australian'
  };
  
  // Check exact match first
  if (nationalityMap[name]) {
    return nationalityMap[name];
  }
  
  // Check partial match
  for (const [key, nationality] of Object.entries(nationalityMap)) {
    if (name.includes(key.split(' ')[0]) || key.includes(name.split(' ')[0])) {
      return nationality;
    }
  }
  
  // Default based on common patterns
  if (name.includes('Smith') || name.includes('Warner') || name.includes('Starc') || name.includes('Cummins')) {
    return 'Australian';
  }
  if (name.includes('Stokes') || name.includes('Buttler') || name.includes('Root') || name.includes('Curran')) {
    return 'English';
  }
  if (name.includes('Rabada') || name.includes('Nortje') || name.includes('du Plessis')) {
    return 'South African';
  }
  
  return 'Overseas'; // Fallback
}

// Organize players into auction sets
function organizeIntoSets(players) {
  const sets = {
    'Top-order Batters': [],
    'Middle-order Batters': [],
    'All-rounders': [],
    'Wicketkeepers': [],
    'Fast Bowlers': [],
    'Spinners': [],
    'Uncapped Players': []
  };

  players.forEach(player => {
    if (player.role === ROLES.BATTER) {
      if (player.rating >= 75) {
        sets['Top-order Batters'].push(player);
      } else {
        sets['Middle-order Batters'].push(player);
      }
    } else if (player.role === ROLES.ALL_ROUNDER) {
      sets['All-rounders'].push(player);
    } else if (player.role === ROLES.WICKETKEEPER) {
      sets['Wicketkeepers'].push(player);
    } else if (player.role === ROLES.BOWLER) {
      // Determine if fast or spin based on name (simplified)
      const fastBowlers = ['Bumrah', 'Shami', 'Siraj', 'Starc', 'Cummins', 'Rabada', 'Boult', 'Archer'];
      const isFast = fastBowlers.some(b => player.name.includes(b));
      
      if (isFast) {
        sets['Fast Bowlers'].push(player);
      } else {
        sets['Spinners'].push(player);
      }
    }
    
    // Some lower-rated players can be in uncapped set
    if (player.rating < 55 && Math.random() < 0.3) {
      sets['Uncapped Players'].push(player);
    }
  });

  // Shuffle each set
  Object.keys(sets).forEach(key => {
    sets[key] = shuffleArray(sets[key]);
  });

  return sets;
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

module.exports = {
  generatePlayerPool,
  organizeIntoSets,
  ROLES
};

