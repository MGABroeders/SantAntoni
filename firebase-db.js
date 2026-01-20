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

// Flag om te voorkomen dat syncReservationsToFirebase wordt aangeroepen na directe updates
// Deze moeten globaal zijn zodat alle scripts ze kunnen gebruiken
window.firebaseDirectUpdateInProgress = window.firebaseDirectUpdateInProgress || false;
window.lastDirectUpdateTime = window.lastDirectUpdateTime || 0;

// Sla reserveringen op (sync versie)
function saveReservations(reservations, skipFirebaseSync = false) {
  localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  
  // Sync naar Firebase als beschikbaar (skip als skipFirebaseSync = true)
  // WARNING: syncReservationsToFirebase verwijdert ALLES en maakt opnieuw aan, wat directe updates kan overschrijven!
  // Gebruik skipFirebaseSync=true als je directe Firestore updates gebruikt
  // Of als er recent een directe update is gedaan (binnen 5 seconden)
  const timeSinceLastDirectUpdate = Date.now() - (window.lastDirectUpdateTime || 0);
  const isUpdateInProgress = window.firebaseDirectUpdateInProgress || false;
  if (!skipFirebaseSync && !isUpdateInProgress && timeSinceLastDirectUpdate > 5000 && isFirebaseReady()) {
    syncReservationsToFirebase(reservations).catch(err => console.error('Firebase sync fout:', err));
  } else if (skipFirebaseSync || isUpdateInProgress || timeSinceLastDirectUpdate <= 5000) {
    console.log('Skipping syncReservationsToFirebase - direct update in progress or recent');
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
  if (!id) {
    console.error('deleteReservation: Geen ID opgegeven');
    return;
  }
  
  // Delete from Firebase first (source of truth)
  if (isFirebaseReady() && firebaseDB) {
    try {
      // Check if document exists first
      const docRef = firebaseDB.collection('reservations').doc(id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.warn('Reservering bestaat niet in Firebase:', id);
        // Continue to delete from localStorage anyway
      } else {
        await docRef.delete();
        console.log('Reservering verwijderd uit Firebase:', id);
      }
    } catch (error) {
      console.error('Fout bij verwijderen reservering uit Firebase:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        reservationId: id,
        firebaseReady: isFirebaseReady(),
        firebaseDB: typeof firebaseDB !== 'undefined'
      });
      
      // Don't throw - continue with localStorage delete as fallback
      // Fallback to old method if Firebase fails
      const reservations = getReservations();
      const filtered = reservations.filter(r => r.id !== id);
      saveReservations(filtered, true); // Skip Firebase sync to avoid loop
      return;
    }
  }
  
  // Update localStorage after successful Firebase delete (or if Firebase not ready)
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


// ==================== HOMEPAGE BERICHT ====================

// Haal homepage bericht op
function getHomepageMessage() {
  const data = localStorage.getItem('santantoni_homepage_message');
  return data ? JSON.parse(data) : null;
}

// Sla homepage bericht op
function saveHomepageMessage(message) {
  if (message && message.text && message.text.trim()) {
    localStorage.setItem('santantoni_homepage_message', JSON.stringify(message));
  } else {
    localStorage.removeItem('santantoni_homepage_message');
  }
  
  // Sync naar Firebase als beschikbaar
  if (isFirebaseReady()) {
    syncHomepageMessageToFirebase(message).catch(err => console.error('Firebase sync fout:', err));
  }
}

// Sync homepage bericht naar Firebase
async function syncHomepageMessageToFirebase(message) {
  try {
    if (message && message.text && message.text.trim()) {
      await firebaseDB.collection('settings').doc('homepage_message').set({
        text: message.text,
        updated: new Date().toISOString(),
        updatedBy: message.updatedBy || null
      });
    } else {
      // Verwijder bericht als het leeg is
      await firebaseDB.collection('settings').doc('homepage_message').delete();
    }
  } catch (error) {
    console.error('Firebase sync fout voor homepage bericht:', error);
  }
}

// Haal homepage bericht op van Firebase
async function syncHomepageMessageFromFirebase() {
  if (!isFirebaseReady()) return;
  
  try {
    const doc = await firebaseDB.collection('settings').doc('homepage_message').get();
    if (doc.exists) {
      const data = doc.data();
      const message = {
        text: data.text,
        updated: data.updated,
        updatedBy: data.updatedBy
      };
      localStorage.setItem('santantoni_homepage_message', JSON.stringify(message));
    } else {
      localStorage.removeItem('santantoni_homepage_message');
    }
  } catch (error) {
    console.error('Firebase ophalen fout voor homepage bericht:', error);
  }
}

// Real-time listener voor homepage bericht
function subscribeToHomepageMessage(callback) {
  if (useLocalStorage()) {
    window.addEventListener('storage', (e) => {
      if (e.key === 'santantoni_homepage_message') {
        const message = e.newValue ? JSON.parse(e.newValue) : null;
        callback(message);
      }
    });
    return () => {};
  }
  
  return firebaseDB.collection('settings').doc('homepage_message')
    .onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        const message = {
          text: data.text,
          updated: data.updated,
          updatedBy: data.updatedBy
        };
        localStorage.setItem('santantoni_homepage_message', JSON.stringify(message));
        callback(message);
      } else {
        localStorage.removeItem('santantoni_homepage_message');
        callback(null);
      }
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
