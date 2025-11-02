// Authenticatie systeem voor Familie Sant Antoni

const USERS_KEY = 'santantoni_users';
const CURRENT_USER_KEY = 'santantoni_current_user';
const TRANSACTIONS_KEY = 'santantoni_transactions';

// Functies voor gebruikersbeheer
function getUsers() {
  const data = localStorage.getItem(USERS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getCurrentUser() {
  const data = localStorage.getItem(CURRENT_USER_KEY);
  return data ? JSON.parse(data) : null;
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(CURRENT_USER_KEY);
  }
}

function logout() {
  setCurrentUser(null);
  window.location.href = 'index.html';
}

// Initialiseer test accounts
function initTestUsers() {
  const users = getUsers();
  
  // Admin account
  if (!users.find(u => u.id === 'admin')) {
    users.push({
      id: 'admin',
      name: 'admin',
      email: 'admin@santantoni.nl',
      password: '123',
      role: 'admin',
      approved: true,
      family: null,
      rank: null,
      settings: {
        canBook: true,
        maxReservationsPerYear: 10,
        priority: 'high'
      },
      created: new Date().toISOString()
    });
  }
  
  // Test1 account - Familie B
  if (!users.find(u => u.id === 'test1')) {
    users.push({
      id: 'test1',
      name: 'test1',
      email: 'test1@santantoni.nl',
      password: '123',
      role: 'user',
      approved: true,
      family: 'B',
      rank: 'ouder',
      settings: {
        canBook: true,
        maxReservationsPerYear: 5,
        priority: 'normal'
      },
      created: new Date().toISOString()
    });
  }
  
  // Test2 account - Familie A
  if (!users.find(u => u.id === 'test2')) {
    users.push({
      id: 'test2',
      name: 'test2',
      email: 'test2@santantoni.nl',
      password: '123',
      role: 'user',
      approved: true,
      family: 'A',
      rank: 'ouder',
      settings: {
        canBook: true,
        maxReservationsPerYear: 5,
        priority: 'normal'
      },
      created: new Date().toISOString()
    });
  }
  
  // Update bestaande test accounts om family en rank te hebben
  users.forEach(u => {
    if (u.id === 'test1' && !u.family) {
      u.family = 'B';
      u.rank = 'ouder';
    }
    if (u.id === 'test2' && !u.family) {
      u.family = 'A';
      u.rank = 'ouder';
    }
  });
  
  if (users.length > 0) {
    saveUsers(users);
    console.log('Test accounts aangemaakt: admin / test1 / test2 (allemaal wachtwoord: 123)');
  }
}

// Registratie
function register(name, email, password) {
  const users = getUsers();
  
  // Check of email al bestaat
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'Dit e-mailadres is al geregistreerd' };
  }
  
  const newUser = {
    id: Date.now().toString(),
    name,
    email: email.toLowerCase(),
    password, // In productie: hash dit!
    role: 'user',
    approved: false, // Moet goedgekeurd worden door admin
    family: null, // 'A' of 'B' - wordt ingesteld door admin
    rank: null, // 'ouder' of 'kind' - wordt ingesteld door admin
    settings: {
      canBook: false, // Standaard geen boekingsrechten tot goedgekeurd
      maxReservationsPerYear: 5,
      priority: 'normal'
    },
    created: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers(users);
  
  return { success: true, message: 'Account aangemaakt. Wacht op goedkeuring.' };
}

// Login - ondersteunt zowel email als account naam
function login(emailOrName, password) {
  const users = getUsers();
  const user = users.find(u => {
    const emailMatch = u.email.toLowerCase() === emailOrName.toLowerCase();
    const nameMatch = u.name.toLowerCase() === emailOrName.toLowerCase();
    const passwordMatch = u.password === password;
    return (emailMatch || nameMatch) && passwordMatch;
  });
  
  if (!user) {
    return { success: false, message: 'Ongeldig e-mailadres/naam of wachtwoord' };
  }
  
  if (!user.approved) {
    return { success: false, message: 'Je account is nog niet goedgekeurd door een beheerder' };
  }
  
  setCurrentUser(user);
  return { success: true, user };
}

// Check of gebruiker is ingelogd
function isLoggedIn() {
  return getCurrentUser() !== null;
}

// Check of gebruiker admin is
function isAdmin() {
  const user = getCurrentUser();
  return user && user.role === 'admin';
}

// Check of gebruiker kan reserveren
function canBook() {
  const user = getCurrentUser();
  if (!user) return false;
  return user.settings && user.settings.canBook;
}

// Gebruiker goedkeuren
function approveUser(userId) {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.approved = true;
    if (!user.settings) {
      user.settings = {
        canBook: true,
        maxReservationsPerYear: 5,
        priority: 'normal'
      };
    } else {
      user.settings.canBook = true;
    }
    saveUsers(users);
    return true;
  }
  return false;
}

// Gebruiker verwijderen
function deleteUser(userId) {
  const users = getUsers();
  const filtered = users.filter(u => u.id !== userId);
  saveUsers(filtered);
  return true;
}

// Gebruiker instellingen bijwerken
function updateUserSettings(userId, settings) {
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.settings = { ...user.settings, ...settings };
    saveUsers(users);
    
    // Update ook current user als het dezelfde is
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(user);
    }
    return true;
  }
  return false;
}

// Transacties beheer
function getTransactions() {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  return data ? JSON.parse(data) : [];
}

function saveTransactions(transactions) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

function addTransaction(transaction) {
  const transactions = getTransactions();
  transaction.id = Date.now().toString();
  transaction.date = new Date().toISOString();
  transactions.unshift(transaction);
  saveTransactions(transactions);
  return transaction;
}

// Reservering koppelen aan transactie
function linkReservationToTransaction(reservationId, transactionId) {
  const reservations = JSON.parse(localStorage.getItem('santantoni_reservations') || '[]');
  const reservation = reservations.find(r => r.id === reservationId);
  if (reservation) {
    reservation.transactionId = transactionId;
    localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  }
}

// Init test users bij laden
if (typeof window !== 'undefined') {
  initTestUsers();
}

