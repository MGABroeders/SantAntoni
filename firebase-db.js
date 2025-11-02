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
  
  // Filter test reserveringen eruit
  return reservations.filter(res => !isProefReservation(res));
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

// Helper functie om alle test/proef reserveringen te verwijderen uit Firebase
async function removeProefReservations() {
  if (!isFirebaseReady()) return;
  
  try {
    const snapshot = await firebaseDB.collection('reservations').get();
    const batch = firebaseDB.batch();
    let removed = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      // Verwijder reserveringen met proef IDs of test emails
      if (doc.id.startsWith('proef') || 
          data.email && data.email.includes('example.com') ||
          (data.naam && (data.naam.includes('Jan de Vries') || 
                         data.naam.includes('Maria Jansen') || 
                         data.naam.includes('Piet Bakker') || 
                         data.naam.includes('Lisa Smit')))) {
        batch.delete(doc.ref);
        removed++;
      }
    });
    
    if (removed > 0) {
      await batch.commit();
      console.log(`${removed} test reserveringen verwijderd uit Firebase`);
    }
  } catch (error) {
    console.error('Fout bij verwijderen test reserveringen:', error);
  }
}

// Sla reserveringen op (sync versie)
// WARNING: Deze functie roept syncReservationsToFirebase aan, wat ALLES verwijdert en opnieuw aanmaakt!
// Gebruik deze NIET na directe Firestore updates - gebruik directe Firestore updates in plaats daarvan
function saveReservations(reservations, skipFirebaseSync = false) {
  localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  
  // Sync naar Firebase als beschikbaar (skip als skipFirebaseSync = true)
  // Alleen gebruiken voor nieuwe reserveringen of bulk updates, NIET na directe Firestore updates!
  if (!skipFirebaseSync && isFirebaseReady()) {
    // Add small delay to avoid conflicts with direct updates
    setTimeout(() => {
      syncReservationsToFirebase(reservations).catch(err => console.error('Firebase sync fout:', err));
    }, 100);
  }
}

// Helper om te checken of een reservering een test/proef reservering is
function isProefReservation(reservation) {
  if (!reservation) return false;
  
  // Check ID
  if (reservation.id && reservation.id.toString().startsWith('proef')) {
    return true;
  }
  
  // Check email
  if (reservation.email && reservation.email.includes('example.com')) {
    return true;
  }
  
  // Check naam
  if (reservation.naam && (
      reservation.naam.includes('Jan de Vries') ||
      reservation.naam.includes('Maria Jansen') ||
      reservation.naam.includes('Piet Bakker') ||
      reservation.naam.includes('Lisa Smit')
  )) {
    return true;
  }
  
  return false;
}

// Sync reserveringen naar Firebase
async function syncReservationsToFirebase(reservations) {
  try {
    // Filter test reserveringen eruit
    const realReservations = reservations.filter(res => !isProefReservation(res));
    
    const batch = firebaseDB.batch();
    const snapshot = await firebaseDB.collection('reservations').get();
    snapshot.forEach(doc => batch.delete(doc.ref));
    
    realReservations.forEach(res => {
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
      const reservation = { id: doc.id, ...doc.data() };
      // Filter test reserveringen eruit
      if (!isProefReservation(reservation)) {
        reservations.push(reservation);
      }
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
async function addReservation(reservation) {
  if (!reservation.id) {
    reservation.id = Date.now().toString();
  }
  if (!reservation.created) {
    reservation.created = new Date().toISOString();
  }
  
  // Add directly to Firebase first (source of truth)
  if (isFirebaseReady() && firebaseDB) {
    try {
      const { id, ...data } = reservation;
      await firebaseDB.collection('reservations').doc(id).set(data);
      console.log('Reservering toegevoegd aan Firebase:', id);
    } catch (error) {
      console.error('Fout bij toevoegen reservering aan Firebase:', error);
      // Fallback to old method if Firebase fails
      const reservations = getReservations();
      reservations.push(reservation);
      saveReservations(reservations);
      return reservation;
    }
  }
  
  // Update localStorage after successful Firebase add
  const reservations = getReservations();
  reservations.push(reservation);
  localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  
  return reservation;
}

// Verwijder reservering (sync versie)
async function deleteReservation(id) {
  // Delete from Firebase first (source of truth)
  if (isFirebaseReady() && firebaseDB) {
    try {
      await firebaseDB.collection('reservations').doc(id).delete();
      console.log('Reservering verwijderd uit Firebase:', id);
    } catch (error) {
      console.error('Fout bij verwijderen reservering uit Firebase:', error);
      // Fallback to old method if Firebase fails
      const reservations = getReservations();
      const filtered = reservations.filter(r => r.id !== id);
      saveReservations(filtered);
      return;
    }
  }
  
  // Update localStorage after successful Firebase delete
  const reservations = getReservations();
  const filtered = reservations.filter(r => r.id !== id);
  localStorage.setItem('santantoni_reservations', JSON.stringify(filtered));
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
        const reservation = { id: doc.id, ...doc.data() };
        // Filter test reserveringen eruit
        if (!isProefReservation(reservation)) {
          reservations.push(reservation);
        }
      });
      // Sorteer client-side
      reservations.sort((a, b) => new Date(b.created) - new Date(a.created));
      callback(reservations);
      
      // Automatisch test reserveringen verwijderen uit Firebase (achtergrond)
      removeProefReservations().catch(err => console.error('Fout bij verwijderen test reserveringen:', err));
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
