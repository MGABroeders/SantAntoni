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

// Run diagnostics when called
if (typeof window !== 'undefined') {
  window.testFirebaseConnection = testFirebaseConnection;
  window.testFirebaseConnectionWithUI = testFirebaseConnectionWithUI;
  console.log('Firebase diagnostiek beschikbaar. Roep testFirebaseConnection() of testFirebaseConnectionWithUI() aan.');
}

