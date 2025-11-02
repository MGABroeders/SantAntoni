// Firebase Database Layer - Vervangt localStorage met Firestore

// Helper om te checken of Firebase klaar is
function isFirebaseReady() {
  return typeof firebaseDB !== 'undefined' && firebaseDB !== null && typeof firebase !== 'undefined';
}

// Gebruik Firebase als beschikbaar, anders localStorage
function useLocalStorage() {
  return !isFirebaseReady();
}

// ==================== RESERVERINGEN ====================

// Haal alle reserveringen op (sync wrapper voor backwards compatibility)
function getReservations() {
  // Gebruik sync localStorage als Firebase niet klaar is
  const data = localStorage.getItem('santantoni_reservations');
  const reservations = data ? JSON.parse(data) : [];
  
  return reservations;
}

// Async versie voor directe Firebase gebruik
async function getReservationsAsync() {
  if (useLocalStorage()) {
    return getReservations();
  }
  
  try {
    const snapshot = await firebaseDB.collection('reservations').get();
    const reservations = [];
    snapshot.forEach(doc => {
      reservations.push({ id: doc.id, ...doc.data() });
    });
    
    return reservations.sort((a, b) => new Date(a.created) - new Date(b.created));
  } catch (error) {
    console.error('Firebase fout bij ophalen reserveringen:', error);
    // Fallback naar localStorage
    return getReservations();
  }
}

// Initialiseer proef reserveringen (sync versie)
function initProefReserveringenSync() {
  const today = new Date();
  const reservations = [];
  
  // Proef reservering 1: Appartement A - volgende maand, 5 dagen
  const res1Start = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  const res1End = new Date(res1Start);
  res1End.setDate(res1End.getDate() + 5);
  
  reservations.push({
    id: 'proef1',
    appartement: 'A',
    naam: 'Jan de Vries',
    email: 'jan@example.com',
    aankomst: res1Start.toISOString().split('T')[0],
    vertrek: res1End.toISOString().split('T')[0],
    personen: 4,
    opmerking: 'Familie vakantie',
    prijs: 400,
    status: 'goedgekeurd',
    created: new Date().toISOString()
  });
  
  // Proef reservering 2: Appartement B - over 2 maanden, 7 dagen
  const res2Start = new Date(today.getFullYear(), today.getMonth() + 2, 5);
  const res2End = new Date(res2Start);
  res2End.setDate(res2End.getDate() + 7);
  
  reservations.push({
    id: 'proef2',
    appartement: 'B',
    naam: 'Maria Jansen',
    email: 'maria@example.com',
    aankomst: res2Start.toISOString().split('T')[0],
    vertrek: res2End.toISOString().split('T')[0],
    personen: 2,
    opmerking: 'Romantisch weekend',
    prijs: 595,
    status: 'betaald',
    created: new Date().toISOString()
  });
  
  // Proef reservering 3: Appartement A - volgende week, 3 dagen
  const res3Start = new Date(today);
  res3Start.setDate(res3Start.getDate() + 7);
  const res3End = new Date(res3Start);
  res3End.setDate(res3End.getDate() + 3);
  
  reservations.push({
    id: 'proef3',
    appartement: 'A',
    naam: 'Piet Bakker',
    email: 'piet@example.com',
    aankomst: res3Start.toISOString().split('T')[0],
    vertrek: res3End.toISOString().split('T')[0],
    personen: 3,
    opmerking: '',
    prijs: 240,
    status: 'in_afwachting',
    created: new Date().toISOString()
  });
  
  // Proef reservering 4: Appartement B - deze maand, laatste week
  const res4Start = new Date(today.getFullYear(), today.getMonth(), 20);
  if (res4Start < today) {
    res4Start.setMonth(res4Start.getMonth() + 1);
  }
  const res4End = new Date(res4Start);
  res4End.setDate(res4End.getDate() + 4);
  
  reservations.push({
    id: 'proef4',
    appartement: 'B',
    naam: 'Lisa Smit',
    email: 'lisa@example.com',
    aankomst: res4Start.toISOString().split('T')[0],
    vertrek: res4End.toISOString().split('T')[0],
    personen: 2,
    opmerking: 'Verjaardagsweekend',
    prijs: 340,
    status: 'goedgekeurd',
    created: new Date().toISOString()
  });
  
  localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
}

// Initialiseer proef reserveringen (async versie)
async function initProefReserveringen() {
  const today = new Date();
  const reservations = [];
  
  // Proef reservering 1: Appartement A - volgende maand, 5 dagen
  const res1Start = new Date(today.getFullYear(), today.getMonth() + 1, 10);
  const res1End = new Date(res1Start);
  res1End.setDate(res1End.getDate() + 5);
  
  reservations.push({
    id: 'proef1',
    appartement: 'A',
    naam: 'Jan de Vries',
    email: 'jan@example.com',
    aankomst: res1Start.toISOString().split('T')[0],
    vertrek: res1End.toISOString().split('T')[0],
    personen: 4,
    opmerking: 'Familie vakantie',
    prijs: 400,
    status: 'goedgekeurd',
    created: new Date().toISOString()
  });
  
  // Proef reservering 2: Appartement B - over 2 maanden, 7 dagen
  const res2Start = new Date(today.getFullYear(), today.getMonth() + 2, 5);
  const res2End = new Date(res2Start);
  res2End.setDate(res2End.getDate() + 7);
  
  reservations.push({
    id: 'proef2',
    appartement: 'B',
    naam: 'Maria Jansen',
    email: 'maria@example.com',
    aankomst: res2Start.toISOString().split('T')[0],
    vertrek: res2End.toISOString().split('T')[0],
    personen: 2,
    opmerking: 'Romantisch weekend',
    prijs: 595,
    status: 'betaald',
    created: new Date().toISOString()
  });
  
  // Proef reservering 3: Appartement A - volgende week, 3 dagen
  const res3Start = new Date(today);
  res3Start.setDate(res3Start.getDate() + 7);
  const res3End = new Date(res3Start);
  res3End.setDate(res3End.getDate() + 3);
  
  reservations.push({
    id: 'proef3',
    appartement: 'A',
    naam: 'Piet Bakker',
    email: 'piet@example.com',
    aankomst: res3Start.toISOString().split('T')[0],
    vertrek: res3End.toISOString().split('T')[0],
    personen: 3,
    opmerking: '',
    prijs: 240,
    status: 'in_afwachting',
    created: new Date().toISOString()
  });
  
  // Proef reservering 4: Appartement B - deze maand, laatste week
  const res4Start = new Date(today.getFullYear(), today.getMonth(), 20);
  if (res4Start < today) {
    res4Start.setMonth(res4Start.getMonth() + 1);
  }
  const res4End = new Date(res4Start);
  res4End.setDate(res4End.getDate() + 4);
  
  reservations.push({
    id: 'proef4',
    appartement: 'B',
    naam: 'Lisa Smit',
    email: 'lisa@example.com',
    aankomst: res4Start.toISOString().split('T')[0],
    vertrek: res4End.toISOString().split('T')[0],
    personen: 2,
    opmerking: 'Verjaardagsweekend',
    prijs: 340,
    status: 'goedgekeurd',
    created: new Date().toISOString()
  });
  
  await saveReservationsAsync(reservations);
}

// Sla reserveringen op (sync versie)
function saveReservations(reservations) {
  localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  
  // Sync naar Firebase als beschikbaar
  if (isFirebaseReady()) {
    syncReservationsToFirebase(reservations).catch(err => console.error('Firebase sync fout:', err));
  }
}

// Sync reserveringen naar Firebase
async function syncReservationsToFirebase(reservations) {
  try {
    const batch = firebaseDB.batch();
    const snapshot = await firebaseDB.collection('reservations').get();
    snapshot.forEach(doc => batch.delete(doc.ref));
    
    reservations.forEach(res => {
      const docRef = firebaseDB.collection('reservations').doc(res.id || Date.now().toString());
      const { id, ...data } = res;
      batch.set(docRef, data);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Firebase fout bij opslaan reserveringen:', error);
  }
}

// Haal reserveringen op van Firebase en merge met localStorage
async function syncReservationsFromFirebase() {
  if (!isFirebaseReady()) return;
  
  try {
    const snapshot = await firebaseDB.collection('reservations').get();
    const reservations = [];
    snapshot.forEach(doc => {
      reservations.push({ id: doc.id, ...doc.data() });
    });
    
    // Sorteer op created desc (client-side)
    reservations.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  } catch (error) {
    console.error('Firebase ophalen fout voor reserveringen:', error);
  }
}

// Async versie van saveReservations (legacy)
async function saveReservationsAsync(reservations) {
  if (useLocalStorage()) {
    return saveReservations(reservations);
  }
  
  return syncReservationsToFirebase(reservations);
}

// Voeg reservering toe (sync versie)
function addReservation(reservation) {
  if (!reservation.id) {
    reservation.id = Date.now().toString();
  }
  if (!reservation.created) {
    reservation.created = new Date().toISOString();
  }
  
  const reservations = getReservations();
  reservations.push(reservation);
  saveReservations(reservations);
  return reservation;
}

// Verwijder reservering (sync versie)
function deleteReservation(id) {
  const reservations = getReservations();
  const filtered = reservations.filter(r => r.id !== id);
  saveReservations(filtered);
}

// Real-time listener voor reserveringen
function subscribeToReservations(callback) {
  if (useLocalStorage()) {
    // Simuleer real-time met localStorage events
    window.addEventListener('storage', (e) => {
      if (e.key === 'santantoni_reservations') {
        const reservations = JSON.parse(e.newValue || '[]');
        callback(reservations);
      }
    });
    return () => {}; // No cleanup needed for localStorage
  }
  
  return firebaseDB.collection('reservations')
    .onSnapshot((snapshot) => {
      const reservations = [];
      snapshot.forEach(doc => {
        reservations.push({ id: doc.id, ...doc.data() });
      });
      // Sorteer client-side
      reservations.sort((a, b) => new Date(b.created) - new Date(a.created));
      callback(reservations);
    }, (error) => {
      console.error('Firebase snapshot fout:', error);
    });
}

// ==================== BERICHTEN ====================

function getMessages() {
  const data = localStorage.getItem('santantoni_messages');
  return data ? JSON.parse(data) : [];
}

function saveMessages(messages) {
  localStorage.setItem('santantoni_messages', JSON.stringify(messages));
  
  // Sync naar Firebase als beschikbaar
  if (isFirebaseReady()) {
    syncMessagesToFirebase(messages).catch(err => console.error('Firebase sync fout:', err));
  }
}

// Sync berichten naar Firebase
async function syncMessagesToFirebase(messages) {
  try {
    const batch = firebaseDB.batch();
    
    // Verwijder oude berichten
    const snapshot = await firebaseDB.collection('messages').get();
    snapshot.forEach(doc => batch.delete(doc.ref));
    
    // Voeg nieuwe toe
    messages.forEach(msg => {
      const docRef = firebaseDB.collection('messages').doc(msg.id);
      const { id, ...data } = msg;
      batch.set(docRef, data);
    });
    
    await batch.commit();
  } catch (error) {
    console.error('Firebase sync fout voor berichten:', error);
  }
}

// Haal berichten op van Firebase en merge met localStorage
async function syncMessagesFromFirebase() {
  if (!isFirebaseReady()) return;
  
  try {
    const snapshot = await firebaseDB.collection('messages').get();
    const messages = [];
    snapshot.forEach(doc => {
      messages.push({ id: doc.id, ...doc.data() });
    });
    
    // Sorteer op date desc (client-side)
    messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    // Update localStorage
    localStorage.setItem('santantoni_messages', JSON.stringify(messages));
  } catch (error) {
    console.error('Firebase ophalen fout voor berichten:', error);
  }
}

function addMessage(author, text, userId) {
  const message = {
    id: Date.now().toString(),
    author,
    text,
    date: new Date().toISOString(),
    userId: userId || null // Voor het kunnen verwijderen van eigen berichten
  };
  
  const messages = getMessages();
  messages.unshift(message); // Nieuwste eerst
  
  if (messages.length > 100) {
    messages.splice(100); // Beperk tot 100 berichten
  }
  
  saveMessages(messages);
  return message;
}

function deleteMessage(messageId) {
  const messages = getMessages();
  const filtered = messages.filter(m => m.id !== messageId);
  saveMessages(filtered);
}

function subscribeToMessages(callback) {
  if (useLocalStorage()) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'santantoni_messages') {
        const messages = JSON.parse(e.newValue || '[]');
        callback(messages);
      }
    });
    return () => {};
  }
  
  return firebaseDB.collection('messages')
    .onSnapshot((snapshot) => {
      const messages = [];
      snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() });
      });
      // Sorteer client-side
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
      callback(messages);
    }, (error) => {
      console.error('Firebase snapshot fout:', error);
    });
}

// ==================== GEBRUIKERS ====================

function getUsers() {
  const data = localStorage.getItem('santantoni_users');
  return data ? JSON.parse(data) : [];
}

function saveUsers(users) {
  localStorage.setItem('santantoni_users', JSON.stringify(users));
}

// ==================== TRANSACTIES ====================

function getTransactions() {
  const data = localStorage.getItem('santantoni_transactions');
  return data ? JSON.parse(data) : [];
}

function saveTransactions(transactions) {
  localStorage.setItem('santantoni_transactions', JSON.stringify(transactions));
}

function addTransaction(transaction) {
  if (!transaction.id) {
    transaction.id = Date.now().toString();
  }
  if (!transaction.date) {
    transaction.date = new Date().toISOString();
  }
  
  const transactions = getTransactions();
  transactions.unshift(transaction);
  saveTransactions(transactions);
  return transaction;
}
