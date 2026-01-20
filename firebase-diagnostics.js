// Firebase Diagnostics Tool
// Gebruik deze functie om Firebase te testen

async function testFirebaseConnection() {
  console.log('=== Firebase Diagnostiek ===');
  
  // Check Firebase initialization
  console.log('1. Firebase SDK:', typeof firebase !== 'undefined' ? '✓ Geladen' : '✗ Niet geladen');
  console.log('2. Firebase App:', typeof firebaseApp !== 'undefined' && firebaseApp ? '✓ Geïnitialiseerd' : '✗ Niet geïnitialiseerd');
  console.log('3. Firebase DB:', typeof firebaseDB !== 'undefined' && firebaseDB ? '✓ Beschikbaar' : '✗ Niet beschikbaar');
  console.log('4. Firebase Auth:', typeof firebaseAuth !== 'undefined' && firebaseAuth ? '✓ Beschikbaar' : '✗ Niet beschikbaar');
  
  // Test read access
  if (typeof firebaseDB !== 'undefined' && firebaseDB) {
    try {
      console.log('\n5. Test: Ophalen reserveringen...');
      const snapshot = await firebaseDB.collection('reservations').limit(1).get();
      console.log('   ✓ Read access werkt');
      console.log('   Aantal reserveringen in Firebase:', snapshot.size);
    } catch (error) {
      console.error('   ✗ Read access faalt:', error.code, error.message);
    }
    
    // Test write access (create test doc)
    try {
      console.log('\n6. Test: Schrijven naar Firebase...');
      const testId = 'test_' + Date.now();
      const testRef = firebaseDB.collection('reservations').doc(testId);
      await testRef.set({ test: true, timestamp: new Date().toISOString() });
      console.log('   ✓ Write access werkt');
      
      // Clean up test doc
      await testRef.delete();
      console.log('   ✓ Delete access werkt');
    } catch (error) {
      console.error('   ✗ Write/Delete access faalt:', error.code, error.message);
      if (error.code === 'permission-denied') {
        console.error('   ⚠️ OPLOSSING: Check Firebase Firestore Security Rules');
        console.error('   Ga naar: https://console.firebase.google.com/project/familie-sant-antoni/firestore/rules');
        console.error('   Zorg dat delete operaties zijn toegestaan voor authenticated users');
      }
    }
  }
  
  // Check authentication
  if (typeof firebaseAuth !== 'undefined' && firebaseAuth) {
    try {
      const currentUser = firebaseAuth.currentUser;
      console.log('\n7. Authenticatie:', currentUser ? `✓ Ingelogd als ${currentUser.email}` : '✗ Niet ingelogd');
    } catch (error) {
      console.error('   ✗ Auth check faalt:', error);
    }
  }
  
  console.log('\n=== Einde Diagnostiek ===');
}

// Run diagnostics when called (with UI output)
async function testFirebaseConnectionWithUI() {
  const outputDiv = document.getElementById('firebaseDiagnostics');
  const outputPre = document.getElementById('firebaseDiagnosticsOutput');
  
  if (outputDiv && outputPre) {
    outputDiv.style.display = 'block';
    outputPre.textContent = 'Firebase diagnostiek wordt uitgevoerd...\n\n';
  }
  
  let output = '';
  const log = (msg) => {
    console.log(msg);
    output += msg + '\n';
    if (outputPre) {
      outputPre.textContent = output;
    }
  };
  
  log('=== Firebase Diagnostiek ===\n');
  
  // Check Firebase initialization
  log('1. Firebase SDK: ' + (typeof firebase !== 'undefined' ? '✓ Geladen' : '✗ Niet geladen'));
  log('2. Firebase App: ' + (typeof firebaseApp !== 'undefined' && firebaseApp ? '✓ Geïnitialiseerd' : '✗ Niet geïnitialiseerd'));
  log('3. Firebase DB: ' + (typeof firebaseDB !== 'undefined' && firebaseDB ? '✓ Beschikbaar' : '✗ Niet beschikbaar'));
  log('4. Firebase Auth: ' + (typeof firebaseAuth !== 'undefined' && firebaseAuth ? '✓ Beschikbaar' : '✗ Niet beschikbaar'));
  
  // Test read access
  if (typeof firebaseDB !== 'undefined' && firebaseDB) {
    try {
      log('\n5. Test: Ophalen reserveringen...');
      const snapshot = await firebaseDB.collection('reservations').limit(1).get();
      log('   ✓ Read access werkt');
      log('   Aantal reserveringen in Firebase: ' + snapshot.size);
    } catch (error) {
      log('   ✗ Read access faalt: ' + error.code + ' - ' + error.message);
    }
    
    // Test write access (create test doc)
    try {
      log('\n6. Test: Schrijven naar Firebase...');
      const testId = 'test_' + Date.now();
      const testRef = firebaseDB.collection('reservations').doc(testId);
      await testRef.set({ test: true, timestamp: new Date().toISOString() });
      log('   ✓ Write access werkt');
      
      // Clean up test doc
      await testRef.delete();
      log('   ✓ Delete access werkt');
    } catch (error) {
      log('   ✗ Write/Delete access faalt: ' + error.code + ' - ' + error.message);
      if (error.code === 'permission-denied') {
        log('\n   ⚠️ OPLOSSING: Check Firebase Firestore Security Rules');
        log('   Ga naar: https://console.firebase.google.com/project/familie-sant-antoni/firestore/rules');
        log('   Zorg dat delete operaties zijn toegestaan voor authenticated users');
        log('\n   Voorbeeld rules:');
        log('   match /reservations/{reservationId} {');
        log('     allow read: if true;');
        log('     allow write, delete: if request.auth != null;');
        log('   }');
      }
    }
  }
  
  // Check authentication
  if (typeof firebaseAuth !== 'undefined' && firebaseAuth) {
    try {
      const currentUser = firebaseAuth.currentUser;
      log('\n7. Authenticatie: ' + (currentUser ? '✓ Ingelogd als ' + currentUser.email : '✗ Niet ingelogd'));
      
      if (!currentUser) {
        log('\n   ⚠️ BELANGRIJK: Je bent niet ingelogd!');
        log('   Firebase vereist authenticatie voor read/write operaties.');
        log('   Log eerst in via de login pagina voordat je Firebase test.');
        log('   Ga naar: login.html of klik op "Inloggen" in de navigatie.');
      }
    } catch (error) {
      log('   ✗ Auth check faalt: ' + error);
    }
  }
  
  log('\n=== Einde Diagnostiek ===');
  
  if (!firebaseAuth || !firebaseAuth.currentUser) {
    log('\n📋 VOLGENDE STAPPEN:');
    log('1. Log eerst in op de website (login.html)');
    log('2. Ga naar Firebase Console en stel Security Rules in');
    log('3. Zie FIRESTORE_SECURITY_RULES.md voor instructies');
    log('4. Test opnieuw na inloggen');
  }
}

// Check wat er in Firebase staat vs localStorage
async function checkFirebaseData() {
  const outputDiv = document.getElementById('firebaseDiagnostics');
  const outputPre = document.getElementById('firebaseDiagnosticsOutput');
  
  if (outputDiv && outputPre) {
    outputDiv.style.display = 'block';
    outputPre.textContent = 'Data wordt gecontroleerd...\n\n';
  }
  
  let output = '';
  const log = (msg) => {
    console.log(msg);
    output += msg + '\n';
    if (outputPre) {
      outputPre.textContent = output;
    }
  };
  
  log('=== Firebase Data Check ===\n');
  
  // Check localStorage
  const localReservations = JSON.parse(localStorage.getItem('santantoni_reservations') || '[]');
  log(`📦 localStorage: ${localReservations.length} reserveringen`);
  if (localReservations.length > 0) {
    log('   Laatste reservering: ' + (localReservations[0].naam || localReservations[0].createdBy || 'Onbekend'));
    log('   Datum: ' + (localReservations[0].aankomst || 'Onbekend'));
  }
  
  // Check Firebase
  if (typeof firebaseDB !== 'undefined' && firebaseDB) {
    try {
      log('\n🔥 Firebase: Ophalen data...');
      const snapshot = await firebaseDB.collection('reservations').get();
      const firebaseReservations = [];
      snapshot.forEach(doc => {
        firebaseReservations.push({ id: doc.id, ...doc.data() });
      });
      
      log(`🔥 Firebase: ${firebaseReservations.length} reserveringen gevonden`);
      
      if (firebaseReservations.length > 0) {
        log('   Laatste reservering: ' + (firebaseReservations[0].naam || firebaseReservations[0].createdBy || 'Onbekend'));
        log('   Datum: ' + (firebaseReservations[0].aankomst || 'Onbekend'));
      }
      
      // Compare
      log('\n📊 Vergelijking:');
      if (firebaseReservations.length === localReservations.length) {
        log('   ✓ Aantal komt overeen');
      } else {
        log('   ⚠️ Aantal komt NIET overeen!');
        log(`   Firebase: ${firebaseReservations.length}, localStorage: ${localReservations.length}`);
      }
      
      // Check if data is synced
      if (firebaseReservations.length === 0 && localReservations.length > 0) {
        log('\n   ⚠️ PROBLEEM: Data staat alleen in localStorage, NIET in Firebase!');
        log('   Dit betekent dat Firebase niet werkt of security rules blokkeren.');
      } else if (firebaseReservations.length > 0 && localReservations.length === 0) {
        log('\n   ⚠️ Data staat in Firebase maar niet in localStorage');
        log('   Klik op "Sync van Firebase" om te synchroniseren');
      } else if (firebaseReservations.length > 0 && localReservations.length > 0) {
        log('\n   ✓ Data staat in beide (mogelijk gesynchroniseerd)');
      }
      
    } catch (error) {
      log('\n   ✗ Firebase fout: ' + error.code + ' - ' + error.message);
      if (error.code === 'permission-denied') {
        log('   ⚠️ Je hebt geen toegang. Log eerst in!');
      }
    }
  } else {
    log('\n   ✗ Firebase DB niet beschikbaar');
  }
  
  log('\n=== Einde Data Check ===');
  log('\n💡 TIP: Ga naar Firebase Console om te zien wat er staat:');
  log('   https://console.firebase.google.com/project/familie-sant-antoni/firestore/data');
}

// Sync data from Firebase to localStorage
async function syncFromFirebase() {
  const outputDiv = document.getElementById('firebaseDiagnostics');
  const outputPre = document.getElementById('firebaseDiagnosticsOutput');
  
  if (outputDiv && outputPre) {
    outputDiv.style.display = 'block';
    outputPre.textContent = 'Synchroniseren van Firebase...\n\n';
  }
  
  let output = '';
  const log = (msg) => {
    console.log(msg);
    output += msg + '\n';
    if (outputPre) {
      outputPre.textContent = output;
    }
  };
  
  log('=== Sync van Firebase ===\n');
  
  if (typeof syncReservationsFromFirebase === 'function') {
    try {
      await syncReservationsFromFirebase();
      log('✓ Reserveringen gesynchroniseerd');
      
      // Reload data
      if (typeof loadTransactions === 'function') {
        loadTransactions();
        log('✓ Admin lijst bijgewerkt');
      }
      if (typeof displayReservations === 'function') {
        displayReservations();
        log('✓ Reserveringen lijst bijgewerkt');
      }
      if (typeof generateCalendar === 'function') {
        generateCalendar();
        log('✓ Kalender bijgewerkt');
      }
      
      log('\n✓ Synchronisatie voltooid!');
    } catch (error) {
      log('✗ Fout bij synchroniseren: ' + error.message);
    }
  } else {
    log('✗ syncReservationsFromFirebase functie niet gevonden');
  }
  
  log('\n=== Einde Sync ===');
}

// Sync ALL localStorage data naar Firebase (eenmalig)
async function syncAllToFirebase() {
  const outputDiv = document.getElementById('firebaseDiagnostics');
  const outputPre = document.getElementById('firebaseDiagnosticsOutput');
  
  if (outputDiv && outputPre) {
    outputDiv.style.display = 'block';
    outputPre.textContent = 'Alle data wordt gesynchroniseerd naar Firebase...\n\n';
  }
  
  let output = '';
  const log = (msg) => {
    console.log(msg);
    output += msg + '\n';
    if (outputPre) {
      outputPre.textContent = output;
    }
  };
  
  log('=== Sync ALL naar Firebase ===\n');
  
  if (!isFirebaseReady() || !firebaseDB) {
    log('✗ Firebase is niet klaar');
    return;
  }
  
  // Get all reservations from localStorage
  const localReservations = JSON.parse(localStorage.getItem('santantoni_reservations') || '[]');
  log(`📦 Gevonden in localStorage: ${localReservations.length} reserveringen`);
  
  if (localReservations.length === 0) {
    log('⚠️ Geen data om te syncen');
    return;
  }
  
  // Filter test reservations
  const realReservations = localReservations.filter(res => {
    if (!res) return false;
    if (res.id && res.id.toString().startsWith('proef')) return false;
    if (res.email && res.email.includes('example.com')) return false;
    return true;
  });
  
  log(`✓ Na filteren: ${realReservations.length} echte reserveringen`);
  
  // Sync to Firebase
  try {
    log('\n🔥 Synchroniseren naar Firebase...');
    
    const batch = firebaseDB.batch();
    let count = 0;
    
    realReservations.forEach(res => {
      if (!res.id) {
        res.id = Date.now().toString() + '_' + count;
      }
      const docRef = firebaseDB.collection('reservations').doc(res.id);
      const { id, ...data } = res;
      batch.set(docRef, data);
      count++;
    });
    
    await batch.commit();
    log(`✓ ${count} reserveringen succesvol gesynchroniseerd naar Firebase!`);
    log('\n✓ Synchronisatie voltooid!');
    log('   Herlaad de pagina of klik op "Check Data" om te verifiëren.');
    
  } catch (error) {
    log('\n✗ Fout bij synchroniseren: ' + error.code + ' - ' + error.message);
    if (error.code === 'permission-denied') {
      log('\n⚠️ OPLOSSING:');
      log('1. Log eerst in op de website');
      log('2. Of pas de security rules aan in Firebase Console');
      log('3. Zie FIRESTORE_SECURITY_RULES.md voor instructies');
    }
  }
  
  log('\n=== Einde Sync ===');
}

// Run diagnostics when called
if (typeof window !== 'undefined') {
  window.testFirebaseConnection = testFirebaseConnection;
  window.testFirebaseConnectionWithUI = testFirebaseConnectionWithUI;
  window.checkFirebaseData = checkFirebaseData;
  window.syncFromFirebase = syncFromFirebase;
  window.syncAllToFirebase = syncAllToFirebase;
  console.log('Firebase diagnostiek beschikbaar. Roep testFirebaseConnection(), checkFirebaseData(), syncFromFirebase() of syncAllToFirebase() aan.');
}

