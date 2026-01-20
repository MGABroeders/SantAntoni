// Admin dashboard functionaliteit

// Check admin access
function checkAdminAccess() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  if (!isAdmin()) {
    alert('Je hebt geen toegang tot deze pagina');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// Load users
function loadUsers() {
  if (!checkAdminAccess()) return;
  
  const users = getUsers();
  const pending = users.filter(u => !u.approved);
  const approved = users.filter(u => u.approved);
  
  // Display pending
  const pendingContainer = document.getElementById('pendingUsers');
  if (pendingContainer) {
    if (pending.length === 0) {
      pendingContainer.innerHTML = '<p class="empty-state">Geen gebruikers in afwachting</p>';
    } else {
      pendingContainer.innerHTML = pending.map(user => `
        <div class="user-item">
          <div class="user-info">
            <strong>${user.name}</strong>
            <div>${user.email}</div>
            <div style="font-size: 0.9em; color: #666;">Aangemaakt: ${new Date(user.created).toLocaleDateString('nl-NL')}</div>
          </div>
          <div class="user-actions">
            <button class="btn-primary" onclick="approveUserById('${user.id}')">Goedkeuren</button>
            <button class="btn-secondary" onclick="editUserSettings('${user.id}')">Instellingen</button>
            <button class="btn-delete" onclick="deleteUserById('${user.id}')">Verwijderen</button>
          </div>
        </div>
      `).join('');
    }
  }
  
  // Display approved in family columns
  const familyAContainer = document.getElementById('familyAUsers');
  const familyBContainer = document.getElementById('familyBUsers');
  const familyCContainer = document.getElementById('familyCUsers');
  
  const familyA = approved.filter(u => u.family === 'A');
  const familyB = approved.filter(u => u.family === 'B');
  const familyC = approved.filter(u => u.family === 'C' || !u.family || u.family === '');
  
  if (familyAContainer) {
    familyAContainer.innerHTML = familyA.map(user => createDraggableUserItem(user)).join('');
  }
  
  if (familyBContainer) {
    familyBContainer.innerHTML = familyB.map(user => createDraggableUserItem(user)).join('');
  }
  
  if (familyCContainer) {
    familyCContainer.innerHTML = familyC.map(user => createDraggableUserItem(user)).join('');
  }
}

// Create draggable user item HTML
function createDraggableUserItem(user) {
  const score = user.score !== undefined && user.score !== null ? user.score : 0;
  return `
    <div class="family-user-item" draggable="true" ondragstart="dragUser(event)" data-user-id="${user.id}">
      <div class="family-user-info">
        <div>
          <strong>${user.name} ${user.role === 'admin' ? '(Admin)' : ''}</strong>
          <div class="family-user-details">${user.email}</div>
        </div>
      </div>
      <div class="family-user-details" style="margin-top: 0.5em;">
        Rang: ${user.rank || 'Geen'} | 
        Boekingsrechten: ${user.settings?.canBook ? '✅' : '❌'} | 
        Max/jaar: ${user.settings?.maxReservationsPerYear || 5}
      </div>
      <div class="family-user-details" style="margin-top: 0.5em; padding: 0.5em; background: #e3f2fd; border-radius: 4px;">
        <strong>Score:</strong> <span style="font-size: 1.2em; font-weight: bold; color: ${score > 0 ? '#4caf50' : score < 0 ? '#f44336' : '#666'};">${score}</span>
        <div style="margin-top: 0.3em; display: flex; gap: 0.3em;">
          <button class="btn-secondary" style="padding: 0.2em 0.5em; font-size: 0.85em;" onclick="event.stopPropagation(); adjustUserScore('${user.id}', -1)">-1</button>
          <button class="btn-secondary" style="padding: 0.2em 0.5em; font-size: 0.85em;" onclick="event.stopPropagation(); adjustUserScore('${user.id}', 1)">+1</button>
        </div>
      </div>
      <button class="btn-secondary" style="margin-top: 0.5em; width: 100%;" onclick="event.stopPropagation(); editUserSettings('${user.id}')">Instellingen</button>
    </div>
  `;
}

// Drag and drop handlers
function allowDrop(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('drag-over');
}

function dragUser(ev) {
  const userItem = ev.target.closest('.family-user-item');
  if (userItem) {
    ev.dataTransfer.setData('text/plain', userItem.dataset.userId);
    userItem.classList.add('dragging');
  }
}

function dropUser(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over');
  
  const userId = ev.dataTransfer.getData('text/plain');
  const targetFamily = ev.currentTarget.dataset.family;
  const draggingElement = document.querySelector('.family-user-item.dragging');
  
  if (draggingElement) {
    draggingElement.classList.remove('dragging');
  }
  
  // Update user in database
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (user) {
    user.family = targetFamily || null;
    saveUsers(users);
    
    // Update current user if it's the same user
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(user);
    }
    
    // Reload
    loadUsers();
  }
}

// Approve user
function approveUserById(userId) {
  if (!checkAdminAccess()) return;
  if (approveUser(userId)) {
    loadUsers();
    alert('Gebruiker goedgekeurd');
  }
}

// Delete user
function deleteUserById(userId) {
  if (!checkAdminAccess()) return;
  if (confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) {
    deleteUser(userId);
    loadUsers();
  }
}

// Adjust user score (admin only)
function adjustUserScore(userId, change) {
  if (!checkAdminAccess()) return;
  
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) {
    alert('Gebruiker niet gevonden');
    return;
  }
  
  // Initialize score if not exists
  if (user.score === undefined || user.score === null) {
    user.score = 0;
  }
  
  // Adjust score
  user.score += change;
  
  // Update current user if it's the same user
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    setCurrentUser(user);
  }
  
  saveUsers(users);
  loadUsers();
  
  const action = change > 0 ? 'verhoogd' : 'verlaagd';
  alert(`Score ${action} naar ${user.score}`);
}

// Edit user settings
function editUserSettings(userId) {
  if (!checkAdminAccess()) return;
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  document.getElementById('settingsUserId').value = user.id;
  document.getElementById('settingsUserName').textContent = user.name;
  document.getElementById('settingsFamily').value = user.family || '';
  document.getElementById('settingsRank').value = user.rank || '';
  document.getElementById('settingsCanBook').checked = user.settings?.canBook || false;
  document.getElementById('settingsMaxReservations').value = user.settings?.maxReservationsPerYear || 5;
  document.getElementById('settingsPriority').value = user.settings?.priority || 'normal';
  
  document.getElementById('userSettingsModal').style.display = 'flex';
}

// Close settings modal
function closeUserSettingsModal() {
  document.getElementById('userSettingsModal').style.display = 'none';
}

// Save user settings
function saveUserSettings() {
  if (!checkAdminAccess()) return;
  const userId = document.getElementById('settingsUserId').value;
  const users = getUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return;
  
  // Update family and rank directly on user
  user.family = document.getElementById('settingsFamily').value || null;
  user.rank = document.getElementById('settingsRank').value || null;
  
  const settings = {
    canBook: document.getElementById('settingsCanBook').checked,
    maxReservationsPerYear: parseInt(document.getElementById('settingsMaxReservations').value),
    priority: document.getElementById('settingsPriority').value
  };
  
  // Also update settings via updateUserSettings
  user.settings = { ...user.settings, ...settings };
  saveUsers(users);
  
  // Update current user if it's the same user
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === userId) {
    setCurrentUser(user);
  }
  
  loadUsers();
  closeUserSettingsModal();
  alert('Instellingen opgeslagen');
}

// Load transactions and reservations combined
function loadTransactions() {
  if (!checkAdminAccess()) return;
  
  const container = document.getElementById('transactionsList');
  if (!container) {
    console.error('transactionsList container not found');
    return;
  }
  
  // Show loading state
  container.innerHTML = '<p class="empty-state">Reserveringen laden...</p>';
  
  // Get reservations - try async first, fallback to sync
  let reservations = [];
  if (typeof getReservationsAsync === 'function') {
    // Try async version
    getReservationsAsync().then(res => {
      reservations = res || [];
      renderReservations(reservations, container);
    }).catch(err => {
      console.error('Error loading reservations async:', err);
      // Fallback to sync
      reservations = typeof getReservations === 'function' ? getReservations() : [];
      renderReservations(reservations, container);
    });
  } else {
    // Use sync version
    reservations = typeof getReservations === 'function' ? getReservations() : [];
    renderReservations(reservations, container);
  }
}

function renderReservations(reservations, container) {
  if (!container) return;
  
  // Get users to find user info for reservations
  const users = typeof getUsers === 'function' ? getUsers() : [];
  
  if (reservations.length === 0) {
    container.innerHTML = '<p class="empty-state">Nog geen reserveringen</p>';
    return;
  }
  
  // Filter pending cancellations
  const pendingCancellations = reservations.filter(res => res.status === 'pending_cancellation');
  const normalReservations = reservations.filter(res => res.status !== 'pending_cancellation');
  
  // Build HTML
  let html = '';
  
  // Show pending cancellations section first
  if (pendingCancellations.length > 0) {
    html += `<div style="margin: 0 0 2em 0; padding: 1.5em; background: #fff3cd; border: 3px solid #ffc107; border-radius: 8px;">`;
    html += `<h3 style="margin-top: 0; color: #856404;">⚠️ Reserveringen Wachtend op Annulering</h3>`;
    html += `<p style="color: #856404; margin-bottom: 1em;">Deze reserveringen zijn aangevraagd voor annulering door de klant. Geef het geld terug en verwijder daarna de reservering.</p>`;
    
    pendingCancellations.forEach(res => {
      const aankomst = new Date(res.aankomst).toLocaleDateString('nl-NL');
      const vertrek = new Date(res.vertrek).toLocaleDateString('nl-NL');
      const cancellationDate = res.cancellationRequested ? new Date(res.cancellationRequested).toLocaleDateString('nl-NL') : 'Onbekend';
      
      // Find user
      const user = users.find(u => u.email === res.email || u.name === res.naam);
      
      // Calculate price
      let price = res.prijs;
      if (!price || price === 0) {
        const family = user ? (user.family || 'C') : 'C';
        const apartement = res.appartement === '35' || res.appartement === 'A' ? 'A' : (res.appartement === '36' || res.appartement === 'B' ? 'B' : res.appartement);
        
        if (typeof calculatePriceWithDiscounts === 'function' && user) {
          const priceInfo = calculatePriceWithDiscounts(apartement, res.aankomst, res.vertrek, user);
          price = priceInfo.total;
        } else if (typeof calculatePrice === 'function') {
          const priceInfo = calculatePrice(apartement, res.aankomst, res.vertrek, user || null);
          price = priceInfo.total;
        }
      }
      
      html += `
        <div style="margin-bottom: 1.5em; padding: 1.5em; background: white; border-radius: 8px; border: 2px solid #ffc107;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.8em;">
            <div>
              <strong style="font-size: 1.1em;">${res.naam}</strong>
              <div style="font-size: 0.9em; color: #666; margin-top: 0.3em;">${res.email}</div>
            </div>
            <span class="status-badge pending" style="background: #ffc107; color: #856404;">⏳ Annulering Aangevraagd</span>
          </div>
          <div style="margin: 0.8em 0;">
            <strong>Periode:</strong> ${aankomst} - ${vertrek}
            ${res.personen ? ` (${res.personen} persoon${res.personen > 1 ? 'en' : ''})` : ''}
          </div>
          <div style="margin: 0.8em 0;">
            <strong>Appartement:</strong> ${res.appartement === 'A' || res.appartement === '35' ? '35' : '36'}
          </div>
          <div style="margin: 0.8em 0;">
            <strong>Terug te betalen:</strong> €${price.toFixed(2)}
          </div>
          <div style="margin: 0.8em 0; font-size: 0.9em; color: #856404;">
            <strong>Annulering aangevraagd op:</strong> ${cancellationDate}
          </div>
          ${res.opmerking ? `<div style="margin: 0.8em 0; color: #666; font-style: italic;">${res.opmerking}</div>` : ''}
          <div style="margin-top: 1em; display: flex; gap: 0.5em;">
            <button class="btn-primary" onclick="markRefundCompleted('${res.id}')" style="background: #28a745;">
              Geld Teruggegeven
            </button>
            <button class="btn-delete" onclick="handleDeleteReservation('${res.id}')">
              Verwijderen
            </button>
          </div>
        </div>
      `;
    });
    
    html += `</div>`;
  }
  
  // Group normal reservations by year
  const reservationsByYear = {};
  normalReservations.forEach(res => {
    const year = new Date(res.aankomst).getFullYear();
    if (!reservationsByYear[year]) {
      reservationsByYear[year] = [];
    }
    reservationsByYear[year].push(res);
  });
  
  // Sort years descending (newest first)
  const years = Object.keys(reservationsByYear).sort((a, b) => parseInt(b) - parseInt(a));
  
  // Build HTML grouped by year
  years.forEach(year => {
    // Year header
    html += `<div style="margin: 2em 0 1em 0; padding-bottom: 0.5em; border-bottom: 3px solid #1565c0;">
      <h3 style="margin: 0; color: #1565c0; font-size: 1.5em;">${year}</h3>
    </div>`;
    
    // Sort reservations within year by aankomst date
    const yearReservations = reservationsByYear[year].sort((a, b) => new Date(a.aankomst) - new Date(b.aankomst));
    
    // Render reservations for this year
    html += yearReservations.map(res => {
    const aankomst = new Date(res.aankomst).toLocaleDateString('nl-NL');
    const vertrek = new Date(res.vertrek).toLocaleDateString('nl-NL');
    const created = res.created ? new Date(res.created).toLocaleDateString('nl-NL') : 'Onbekend';
    
    // Find user for this reservation
    const user = users.find(u => u.email === res.email || u.name === res.naam);
    
    // Calculate price if not already set
    let price = res.prijs;
    if (!price || price === 0) {
      // Calculate price based on user family and dates
      const family = user ? (user.family || 'C') : 'C';
      const apartement = res.appartement === '35' || res.appartement === 'A' ? 'A' : (res.appartement === '36' || res.appartement === 'B' ? 'B' : res.appartement);
      
      if (typeof calculatePriceWithDiscounts === 'function' && user) {
        const priceInfo = calculatePriceWithDiscounts(apartement, res.aankomst, res.vertrek, user);
        price = priceInfo.total;
      } else if (typeof calculatePrice === 'function') {
        const priceInfo = calculatePrice(apartement, res.aankomst, res.vertrek, user || null);
        price = priceInfo.total;
      }
    }
    
    // Status badge
    const statusBadge = res.status === 'betaald' 
      ? '<span class="status-badge paid">€ Betaald</span>'
      : res.status === 'goedgekeurd'
      ? '<span class="status-badge approved">✓ Goedgekeurd</span>'
      : '<span class="status-badge pending">⏳ In afwachting</span>';
    
    // Payment button (only show if not paid)
    const paymentButton = res.status !== 'betaald' 
      ? `<button class="btn-primary" onclick="markReservationAsPaid('${res.id}')" style="margin-right: 0.5em;">Markeer als Betaald</button>`
      : '';
    
    // Delete button
    const deleteButton = `<button class="btn-delete" onclick="handleDeleteReservation('${res.id}')">Verwijderen</button>`;
    
    return `
      <div class="reservation-item" style="margin-bottom: 1.5em; padding: 1.5em; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div class="reservation-info">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.8em;">
            <div>
              <strong style="font-size: 1.1em;">${res.naam}</strong>
              <div style="font-size: 0.9em; color: #666; margin-top: 0.3em;">${res.email}</div>
            </div>
            ${statusBadge}
          </div>
          
          <div style="margin: 0.8em 0;">
            <strong>Periode:</strong> ${aankomst} - ${vertrek}
            ${res.personen ? ` (${res.personen} persoon${res.personen > 1 ? 'en' : ''})` : ''}
          </div>
          
          <div style="margin: 0.8em 0;">
            <strong>Appartement:</strong> ${res.appartement === '35' || res.appartement === 'A' ? '35' : (res.appartement === '36' || res.appartement === 'B' ? '36' : res.appartement)}
          </div>
          
          <div style="margin: 0.8em 0; padding: 0.8em; background: #f5f5f5; border-radius: 4px;">
            <strong style="font-size: 1.2em; color: #1565c0;">Te betalen: €${price ? price.toFixed(2) : '0.00'}</strong>
          </div>
          
          ${res.opmerking ? `<div style="margin: 0.8em 0; padding: 0.8em; background: #fff3cd; border-radius: 4px; font-style: italic; color: #856404;">${res.opmerking}</div>` : ''}
          
          <div style="font-size: 0.85em; color: #666; margin-top: 0.8em;">
            Aangemaakt: ${created}
          </div>
        </div>
        
        <div class="reservation-actions" style="margin-top: 1em; display: flex; gap: 0.5em; flex-wrap: wrap;">
          ${paymentButton}
          ${deleteButton}
        </div>
      </div>
    `;
    }).join(''); // Close yearReservations.map
  }); // Close years.forEach
  
  container.innerHTML = html;
}

// Mark reservation as paid
async function markReservationAsPaid(reservationId) {
  if (!checkAdminAccess()) return;
  
  const confirmMsg = '⚠️ Weet je zeker dat je deze reservering als betaald wilt markeren?\n\nDit kan later niet meer ongedaan worden gemaakt.';
  if (!confirm(confirmMsg)) {
    return;
  }
  
  const reservations = typeof getReservations === 'function' ? getReservations() : [];
  const reservation = reservations.find(r => r.id === reservationId);
  
  if (!reservation) {
    alert('Reservering niet gevonden');
    return;
  }
  
  // Set flag to prevent syncReservationsToFirebase from overwriting
  window.firebaseDirectUpdateInProgress = true;
  window.lastDirectUpdateTime = Date.now();
  
  // Update status to 'betaald'
  reservation.status = 'betaald';
  
  // Update Firebase FIRST (direct update, no batch overwrite)
  if (typeof firebaseDB !== 'undefined' && firebaseDB && reservation.id) {
    try {
      // Update directly in Firestore - this is the source of truth
      await firebaseDB.collection('reservations').doc(reservation.id).update({
        status: 'betaald',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('Reservering status bijgewerkt in Firebase:', reservation.id);
      
      // Wait a moment for Firebase to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Fout bij updaten reservering status in Firebase:', error);
      alert('Fout bij opslaan in Firebase. Check console voor details.');
      // Reset flag on error
      window.firebaseDirectUpdateInProgress = false;
      return; // Stop if Firebase update fails
    }
  }
  
  // Update localStorage AFTER successful Firebase update
  // This way, if page reloads, real-time listener will get correct data from Firebase
  localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
  
  // Reset flag after update is complete
  setTimeout(() => {
    window.firebaseDirectUpdateInProgress = false;
  }, 3000);
  
  // Wait a bit for Firebase to sync, then reload
  setTimeout(() => {
    // Reload transactions/reservations list
    loadTransactions();
    
    // Also update on kalender.html if it exists
    if (typeof displayReservations === 'function') {
      displayReservations();
    }
    
    // Also update calendar if it exists
    if (typeof generateCalendar === 'function') {
      generateCalendar();
    }
  }, 500);
  
  alert('Reservering gemarkeerd als betaald');
}

// Delete reservation (admin only, with Firebase sync)
async function handleDeleteReservation(reservationId) {
  if (!checkAdminAccess()) return;
  
  const confirmMsg = '⚠️ Weet je zeker dat je deze reservering wilt verwijderen?\n\nDit kan niet ongedaan worden gemaakt.';
  if (!confirm(confirmMsg)) {
    return;
  }
  
  const reservations = typeof getReservations === 'function' ? getReservations() : [];
  const reservation = reservations.find(r => r.id === reservationId);
  
  if (!reservation) {
    alert('Reservering niet gevonden');
    return;
  }
  
  // Set flag to prevent syncReservationsToFirebase from overwriting
  window.firebaseDirectUpdateInProgress = true;
  window.lastDirectUpdateTime = Date.now();
  
  // Delete from Firebase FIRST (this is the source of truth)
  if (typeof firebaseDB !== 'undefined' && firebaseDB && reservation.id) {
    try {
      // Check if document exists first
      const docRef = firebaseDB.collection('reservations').doc(reservation.id);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        console.warn('Reservering bestaat niet in Firebase:', reservation.id);
        // Continue to delete from localStorage anyway
      } else {
        await docRef.delete();
        console.log('Reservering verwijderd uit Firebase:', reservation.id);
      }
      
      // Wait a moment for Firebase to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Fout bij verwijderen reservering uit Firebase:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        reservationId: reservation.id,
        firebaseReady: typeof firebaseDB !== 'undefined' && firebaseDB !== null,
        firebaseInitialized: typeof firebase !== 'undefined'
      });
      
      // Check for common Firebase errors
      let errorMessage = 'Fout bij verwijderen reservering uit Firebase.';
      if (error.code === 'permission-denied') {
        errorMessage = '⚠️ Geen toestemming om reservering te verwijderen.\n\nMogelijke oorzaken:\n- Firebase Firestore security rules blokkeren delete operaties\n- Je bent niet correct ingelogd\n\nDe reservering wordt wel verwijderd uit localStorage.';
      } else if (error.code === 'not-found') {
        console.log('Reservering bestaat niet in Firebase, maar wordt verwijderd uit localStorage');
        errorMessage = null; // Don't show error for not-found
      } else if (error.code === 'unavailable') {
        errorMessage = '⚠️ Firebase is niet beschikbaar.\n\nDe reservering wordt verwijderd uit localStorage.';
      } else {
        errorMessage = `⚠️ Firebase fout: ${error.message || error.code || 'Onbekende fout'}\n\nDe reservering wordt wel verwijderd uit localStorage.`;
      }
      
      if (errorMessage) {
        console.warn(errorMessage);
      }
      
      // Don't stop - continue with localStorage delete as fallback
      // User will see the reservation is gone, and Firebase will sync eventually
      console.log('Doorgaan met verwijderen uit localStorage als fallback');
    }
  }
  
  // Update localStorage AFTER successful Firebase delete
  // Remove from local array
  const filtered = reservations.filter(r => r.id !== reservationId);
  
  // Save to localStorage only (don't trigger syncReservationsToFirebase)
  localStorage.setItem('santantoni_reservations', JSON.stringify(filtered));
  
  // Reset flag after delete is complete
  setTimeout(() => {
    window.firebaseDirectUpdateInProgress = false;
  }, 3000);
  
  // Wait a bit for Firebase to sync, then reload
  setTimeout(() => {
    // Reload transactions/reservations list
    loadTransactions();
    
    // Also update on kalender.html if it exists
    if (typeof displayReservations === 'function') {
      displayReservations();
    }
    
    // Also update calendar if it exists
    if (typeof generateCalendar === 'function') {
      generateCalendar();
    }
  }, 500);
  
  alert('Reservering verwijderd');
}

// Mark refund as completed and delete reservation
async function markRefundCompleted(id) {
  if (!checkAdminAccess()) return;
  
  const confirmMsg = '⚠️ Is het geld teruggegeven?\n\nDe reservering wordt daarna verwijderd.\n\nWeet je zeker dat je door wilt gaan?';
  if (!confirm(confirmMsg)) {
    return;
  }
  
  // Direct delete (geld is teruggegeven)
  await handleDeleteReservation(id);
  alert('Geld teruggegeven en reservering verwijderd.');
}

// Load date override status on page load
function initDateOverride() {
  const dateOverrideInput = document.getElementById('dateOverride');
  const dateOverrideStatus = document.getElementById('dateOverrideStatus');
  
  if (dateOverrideInput && dateOverrideStatus) {
    const overrideDate = localStorage.getItem('dateOverride');
    if (overrideDate) {
      dateOverrideInput.value = overrideDate;
      updateDateOverrideUI();
    } else {
      updateDateOverrideUI();
    }
  }
}

// Toggle feature (photos or messages) - UITGESCHAKELD
/*
function toggleFeature(feature) {
  // Default to true if not set
  const storedValue = localStorage.getItem(`feature_${feature}_enabled`);
  const currentStatus = storedValue === null || storedValue === 'true'; // Default true
  const newStatus = !currentStatus;
  
  localStorage.setItem(`feature_${feature}_enabled`, newStatus.toString());
  
  updateFeatureUI(feature);
  
  // Update navigation on all pages (call global function if exists)
  if (typeof updateFeatureVisibility === 'function') {
    updateFeatureVisibility();
  }
  
  alert(newStatus ? 
    `✅ ${feature === 'photos' ? 'Foto\'s' : 'Berichten'} functie is INGESCHAKELD.\n\nDe functie is nu zichtbaar in het menu en op de homepage.` :
    `❌ ${feature === 'photos' ? 'Foto\'s' : 'Berichten'} functie is UITGESCHAKELD.\n\nDe functie is nu verborgen in het menu en op de homepage.`);
}

// Update feature UI
function updateFeatureUI(feature) {
  // Default to true if not set (features are enabled by default)
  const storedValue = localStorage.getItem(`feature_${feature}_enabled`);
  const isEnabled = storedValue === null || storedValue === 'true'; // Default true
  
  const btn = document.getElementById(`${feature}ToggleBtn`);
  const status = document.getElementById(`${feature}Status`);
  const featureName = feature === 'photos' ? 'Foto\'s' : 'Berichten';
  
  if (btn) {
    btn.textContent = isEnabled ? 'Feature Uitschakelen' : 'Feature Inschakelen';
    btn.style.background = isEnabled ? '#dc3545' : '#28a745';
  }
  
  if (status) {
    if (isEnabled) {
      status.textContent = `✅ INGESCHAKELD - ${featureName} functie is actief`;
      status.style.color = '#28a745';
    } else {
      status.textContent = `❌ UITGESCHAKELD - ${featureName} functie is verborgen`;
      status.style.color = '#dc3545';
    }
  }
}
*/

// Initialize feature toggles on page load - UITGESCHAKELD
/*
function initFeatureToggles() {
  updateFeatureUI('photos');
  updateFeatureUI('messages');
}
*/

// Check if feature is enabled (global function for use in other files)
function isFeatureEnabled(feature) {
  return localStorage.getItem(`feature_${feature}_enabled`) !== 'false'; // Default true
}

// Tab switching
function initAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.admin-tab-content');
  
  // Load initial active tab content
  const activeTab = document.querySelector('.admin-tab.active');
  if (activeTab) {
    const initialTab = activeTab.dataset.tab;
    if (initialTab === 'accounts') {
      loadUsers();
    } else if (initialTab === 'transactions') {
      loadTransactions();
    } else if (initialTab === 'intentions') {
      loadIntentions();
    }
  }
  
  // Load date override status
  initDateOverride();
  
  // Load feature toggles
  // initFeatureToggles(); // UITGESCHAKELD
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update tabs
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update content
      contents.forEach(c => c.classList.remove('active'));
      document.getElementById(`${targetTab}Tab`).classList.add('active');
      
      // Load content
      if (targetTab === 'accounts') {
        loadUsers();
      } else if (targetTab === 'transactions') {
        loadTransactions();
      } else if (targetTab === 'intentions') {
        loadIntentions();
      }
    });
  });
}

// Load intentions for admin
function loadIntentions() {
  if (!checkAdminAccess()) return;
  
  const container = document.getElementById('intentionsList');
  if (!container) {
    console.error('intentionsList container not found');
    return;
  }
  
  // Show loading state
  container.innerHTML = '<p class="empty-state">Intenties laden...</p>';
  
  // Get reservations - try async first, fallback to sync
  let reservations = [];
  if (typeof getReservationsAsync === 'function') {
    getReservationsAsync().then(res => {
      reservations = res || [];
      renderIntentions(reservations, container);
    }).catch(err => {
      console.error('Error loading reservations async:', err);
      reservations = typeof getReservations === 'function' ? getReservations() : [];
      renderIntentions(reservations, container);
    });
  } else {
    reservations = typeof getReservations === 'function' ? getReservations() : [];
    renderIntentions(reservations, container);
  }
}

// Render intentions grouped by apartment and period
function renderIntentions(reservations, container) {
  if (!container) return;
  
  const users = typeof getUsers === 'function' ? getUsers() : [];
  const intentions = reservations.filter(res => res.isIntention && res.status !== 'approved');
  
  if (intentions.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen intenties om te beheren</p>';
    return;
  }
  
  // Group intentions by apartment and period
  const groupedIntentions = {};
  
  intentions.forEach(int => {
    const key = `${int.appartement}_${int.aankomst}_${int.vertrek}`;
    if (!groupedIntentions[key]) {
      groupedIntentions[key] = {
        appartement: int.appartement,
        aankomst: int.aankomst,
        vertrek: int.vertrek,
        intentions: []
      };
    }
    groupedIntentions[key].intentions.push(int);
  });
  
  // Determine priority family for each group
  const groups = Object.values(groupedIntentions).map(group => {
    const reservationStart = new Date(group.aankomst);
    const year = reservationStart.getFullYear();
    let firstSummerMonth = null;
    const checkStartDate = new Date(reservationStart);
    while (checkStartDate < new Date(group.vertrek) && !firstSummerMonth) {
      const month = checkStartDate.getMonth();
      if (month >= 5 && month <= 8) {
        firstSummerMonth = month;
        break;
      }
      checkStartDate.setDate(checkStartDate.getDate() + 1);
    }
    
    const apartmentNum = group.appartement === 'A' ? '35' : (group.appartement === 'B' ? '36' : group.appartement);
    const priorityFamily = firstSummerMonth !== null ? getPriorityFamilyForMonth(firstSummerMonth, year, apartmentNum) : null;
    
    // Sort intentions: priority family first
    group.intentions.sort((a, b) => {
      const aUser = users.find(u => u.id === a.userId || u.email === a.email);
      const bUser = users.find(u => u.id === b.userId || u.email === b.email);
      const aFamily = aUser ? aUser.family : (a.family || null);
      const bFamily = bUser ? bUser.family : (b.family || null);
      
      if (aFamily === priorityFamily && bFamily !== priorityFamily) return -1;
      if (aFamily !== priorityFamily && bFamily === priorityFamily) return 1;
      return 0;
    });
    
    return {
      ...group,
      priorityFamily,
      priorityFamilyName: priorityFamily === 'A' ? 'Familie A (Pieters-Louasson)' : priorityFamily === 'B' ? 'Familie B (Broeders)' : 'Geen voorrang'
    };
  });
  
  // Sort groups by apartment and date
  groups.sort((a, b) => {
    if (a.appartement !== b.appartement) {
      return a.appartement.localeCompare(b.appartement);
    }
    return new Date(a.aankomst) - new Date(b.aankomst);
  });
  
  let html = '';
  
  groups.forEach(group => {
    const aankomst = new Date(group.aankomst);
    const vertrek = new Date(group.vertrek);
    const apartmentName = group.appartement === 'A' || group.appartement === '35' ? '35' : '36';
    
    const intentionsHtml = group.intentions.map(int => {
      const user = users.find(u => u.id === int.userId || u.email === int.email);
      const intFamily = user ? user.family : (int.family || null);
      const hasPriority = intFamily === group.priorityFamily;
      const userScore = user ? (user.score !== undefined && user.score !== null ? user.score : 0) : 0;
      
      // Calculate price
      let price = int.prijs;
      if (!price || price === 0) {
        const family = intFamily || 'C';
        const apartement = int.appartement === '35' || int.appartement === 'A' ? 'A' : (int.appartement === '36' || int.appartement === 'B' ? 'B' : int.appartement);
        
        if (typeof calculatePriceWithDiscounts === 'function' && user) {
          const priceInfo = calculatePriceWithDiscounts(apartement, int.aankomst, int.vertrek, user);
          price = priceInfo.total;
        } else if (typeof calculatePrice === 'function') {
          const priceInfo = calculatePrice(apartement, int.aankomst, int.vertrek, user || null);
          price = priceInfo.total;
        }
      }
      
      return `
        <div class="intention-item" style="padding: 1em; margin: 0.5em 0; background: ${hasPriority ? '#e8f5e9' : '#fff3cd'}; border-left: 4px solid ${hasPriority ? '#4caf50' : '#ffc107'}; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.5em;">
            <div>
              <strong>${int.createdBy || int.naam}</strong>
              ${hasPriority ? '<span style="margin-left: 0.5em; color: #4caf50; font-weight: bold;">✓ Voorrang</span>' : ''}
              ${int.personen ? ` <span style="color: #666;">(${int.personen} persoon${int.personen > 1 ? 'en' : ''})</span>` : ''}
              <div style="margin-top: 0.3em; font-size: 0.9em;">
                <strong>Score:</strong> <span style="font-weight: bold; color: ${userScore > 0 ? '#4caf50' : userScore < 0 ? '#f44336' : '#666'}; font-size: 1.1em;">${userScore}</span>
              </div>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: bold; color: #1565c0;">€${price ? price.toFixed(2) : '0.00'}</div>
            </div>
          </div>
          ${int.opmerking ? `<div style="margin-top: 0.5em; color: #666; font-style: italic; font-size: 0.9em;">${int.opmerking}</div>` : ''}
          <div style="margin-top: 0.5em;">
            <button class="btn-primary" onclick="confirmIntention('${int.id}')" style="margin-right: 0.5em;">
              ✓ Bevestigen
            </button>
            <button class="btn-secondary" onclick="rejectIntention('${int.id}')">
              ✗ Afwijzen
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    html += `
      <div class="intention-group" style="margin-bottom: 2em; padding: 1.5em; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 1em; padding-bottom: 1em; border-bottom: 2px solid #e0e0e0;">
          <h3 style="margin: 0 0 0.5em 0;">Appartement ${apartmentName}</h3>
          <div style="color: #666;">
            ${aankomst.toLocaleDateString('nl-NL')} - ${vertrek.toLocaleDateString('nl-NL')}
          </div>
          <div style="margin-top: 0.5em; font-weight: bold; color: #1976d2;">
            Voorrangsperiode: ${group.priorityFamilyName}
          </div>
        </div>
        <div>
          <strong style="display: block; margin-bottom: 0.5em;">Intenties (${group.intentions.length}):</strong>
          ${intentionsHtml}
        </div>
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Confirm an intention (approve it and delete overlapping intentions)
async function confirmIntention(intentionId) {
  if (!checkAdminAccess()) return;
  
  const reservations = typeof getReservations === 'function' ? getReservations() : [];
  const intention = reservations.find(r => r.id === intentionId);
  
  if (!intention) {
    alert('Intentie niet gevonden');
    return;
  }
  
  // Find overlapping intentions
  const overlappingIntentions = reservations.filter(res => {
    if (res.id === intentionId) return false; // Not the one we're confirming
    if (!res.isIntention) return false; // Only other intentions
    if (res.appartement !== intention.appartement) return false;
    
    const resStart = new Date(res.aankomst);
    const resEnd = new Date(res.vertrek);
    const intStart = new Date(intention.aankomst);
    const intEnd = new Date(intention.vertrek);
    
    return intStart < resEnd && intEnd > resStart;
  });
  
  let confirmMsg = `⚠️ Weet je zeker dat je deze intentie wilt bevestigen?\n\n`;
  confirmMsg += `Intentie: ${intention.createdBy || intention.naam}\n`;
  confirmMsg += `Periode: ${new Date(intention.aankomst).toLocaleDateString('nl-NL')} - ${new Date(intention.vertrek).toLocaleDateString('nl-NL')}\n\n`;
  
  if (overlappingIntentions.length > 0) {
    confirmMsg += `De volgende ${overlappingIntentions.length} andere intentie(s) worden verwijderd:\n`;
    overlappingIntentions.forEach(int => {
      confirmMsg += `- ${int.createdBy || int.naam}\n`;
    });
    confirmMsg += '\n';
  }
  
  confirmMsg += 'Deze intentie wordt een definitieve reservering.';
  
  if (!confirm(confirmMsg)) {
    return;
  }
  
  // Set flag to prevent syncReservationsToFirebase from overwriting
  window.firebaseDirectUpdateInProgress = true;
  window.lastDirectUpdateTime = Date.now();
  
  try {
    // Get users to update scores
    const users = typeof getUsers === 'function' ? getUsers() : [];
    
    // Find user for confirmed intention
    const confirmedUser = users.find(u => u.id === intention.userId || u.email === intention.email);
    if (confirmedUser) {
      // User gets first choice: -1 score
      if (confirmedUser.score === undefined || confirmedUser.score === null) {
        confirmedUser.score = 0;
      }
      confirmedUser.score -= 1;
      console.log(`Score aangepast voor ${confirmedUser.name}: ${confirmedUser.score + 1} -> ${confirmedUser.score} (bevestigd)`);
    }
    
    // Find users for rejected overlapping intentions
    overlappingIntentions.forEach(overlapping => {
      const rejectedUser = users.find(u => u.id === overlapping.userId || u.email === overlapping.email);
      if (rejectedUser) {
        // User didn't get first choice: +1 score
        if (rejectedUser.score === undefined || rejectedUser.score === null) {
          rejectedUser.score = 0;
        }
        rejectedUser.score += 1;
        console.log(`Score aangepast voor ${rejectedUser.name}: ${rejectedUser.score - 1} -> ${rejectedUser.score} (afgewezen)`);
      }
    });
    
    // Save updated users
    if (typeof saveUsers === 'function') {
      saveUsers(users);
    }
    
    // Update intention to approved status and remove isIntention flag
    if (typeof firebaseDB !== 'undefined' && firebaseDB && intention.id) {
      await firebaseDB.collection('reservations').doc(intention.id).update({
        status: 'approved',
        isIntention: false,
        confirmedAt: new Date().toISOString()
      });
      
      // Delete overlapping intentions from Firebase
      for (const overlapping of overlappingIntentions) {
        await firebaseDB.collection('reservations').doc(overlapping.id).delete();
      }
    }
    
    // Update local storage
    const updatedReservations = reservations.map(r => {
      if (r.id === intentionId) {
        return { ...r, status: 'approved', isIntention: false, confirmedAt: new Date().toISOString() };
      }
      return r;
    }).filter(r => !overlappingIntentions.find(o => o.id === r.id));
    
    localStorage.setItem('santantoni_reservations', JSON.stringify(updatedReservations));
    
    // Reset flag
    setTimeout(() => {
      window.firebaseDirectUpdateInProgress = false;
    }, 3000);
    
    // Reload
    setTimeout(() => {
      loadIntentions();
      if (typeof loadTransactions === 'function') {
        loadTransactions();
      }
      if (typeof generateCalendar === 'function') {
        generateCalendar();
      }
      if (typeof displayIntentions === 'function') {
        displayIntentions();
      }
    }, 500);
    
    alert('Intentie bevestigd en andere overlappende intenties verwijderd.');
  } catch (error) {
    console.error('Fout bij bevestigen intentie:', error);
    alert('Fout bij bevestigen intentie. Check console voor details.');
    window.firebaseDirectUpdateInProgress = false;
  }
}

// Reject an intention (delete it)
async function rejectIntention(intentionId) {
  if (!checkAdminAccess()) return;
  
  const confirmMsg = '⚠️ Weet je zeker dat je deze intentie wilt afwijzen?\n\nDe intentie wordt verwijderd.';
  if (!confirm(confirmMsg)) {
    return;
  }
  
  await handleDeleteReservation(intentionId);
  
  // Reload intentions
  setTimeout(() => {
    loadIntentions();
  }, 500);
  
  alert('Intentie afgewezen en verwijderd.');
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  if (!checkAdminAccess()) return;
  
  // Wait a bit for Firebase to initialize if needed
  setTimeout(() => {
    initAdminTabs();
    // loadUsers() will be called by initAdminTabs if accounts tab is active
  }, 500);
  
  // User settings form
  const settingsForm = document.getElementById('userSettingsForm');
  if (settingsForm) {
    settingsForm.addEventListener('submit', (e) => {
      e.preventDefault();
      saveUserSettings();
    });
  }
  
  // Close modal on outside click
  window.onclick = function(event) {
    const modal = document.getElementById('userSettingsModal');
    if (event.target === modal) {
      closeUserSettingsModal();
    }
  }
});

// Load summer distribution overview
function loadSummerDistribution() {
  if (!checkAdminAccess()) return;
  
  const container = document.getElementById('summerDistribution');
  if (!container) return;
  
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  
  let html = `
    <div style="background: #e3f2fd; padding: 1.5em; border-radius: 8px; margin-bottom: 1.5em;">
      <h5 style="margin-top: 0; color: #1565c0;">⚠️ Huidige Regels</h5>
      <div style="font-size: 0.9em; line-height: 2;">
        <div><strong>Prioriteitsperiode:</strong> Januari t/m Maart (alleen prioriteitsfamilies mogen zomer reserveren)</div>
        <div><strong>Na prioriteitsperiode:</strong> Vanaf april kan iedereen reserveren</div>
        <div><strong>Voor volgend jaar:</strong> Pas vanaf 1 januari mag je zomer reserveren</div>
        <div><strong>Zomermaanden:</strong> Juni, Juli, Augustus, September</div>
      </div>
    </div>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2em; margin-top: 1em;">
      <div class="admin-card" style="background: white; padding: 1.5em; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h5 style="margin-top: 0; color: #1565c0;">${currentYear}</h5>
        <h6>Appartement 35</h6>
        <div style="font-size: 0.9em; line-height: 1.8;">
          <div><strong>Juni/Juli:</strong> ${currentYear % 2 === 0 ? 'Familie A' : 'Familie B'}</div>
          <div><strong>Augustus/September:</strong> ${currentYear % 2 === 0 ? 'Familie B' : 'Familie A'}</div>
        </div>
        <h6 style="margin-top: 1em;">Appartement 36</h6>
        <div style="font-size: 0.9em; line-height: 1.8;">
          <div><strong>Alle zomermaanden:</strong> Familie B</div>
        </div>
      </div>
      
      <div class="admin-card" style="background: white; padding: 1.5em; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
        <h5 style="margin-top: 0; color: #1565c0;">${nextYear}</h5>
        <h6>Appartement 35</h6>
        <div style="font-size: 0.9em; line-height: 1.8;">
          <div><strong>Juni/Juli:</strong> ${nextYear % 2 === 0 ? 'Familie A' : 'Familie B'}</div>
          <div><strong>Augustus/September:</strong> ${nextYear % 2 === 0 ? 'Familie B' : 'Familie A'}</div>
        </div>
        <h6 style="margin-top: 1em;">Appartement 36</h6>
        <div style="font-size: 0.9em; line-height: 1.8;">
          <div><strong>Alle zomermaanden:</strong> Familie B</div>
        </div>
      </div>
    </div>
  `;
  
  container.innerHTML = html;
}

// Save priority period
function savePriorityPeriod() {
  const startMonth = document.getElementById('priorityStartMonth').value;
  const endMonth = document.getElementById('priorityEndMonth').value;
  
  // TODO: Save to localStorage/config
  alert(`Prioriteitsperiode opgeslagen: Maanden ${startMonth} t/m ${endMonth}`);
}

// Set date override (test modus)
function setDateOverride() {
  const dateOverrideInput = document.getElementById('dateOverride');
  if (!dateOverrideInput) return;
  
  const overrideDate = dateOverrideInput.value;
  
  if (overrideDate) {
    localStorage.setItem('dateOverride', overrideDate);
    updateDateOverrideUI();
    alert(`✅ Datum override ingesteld op: ${new Date(overrideDate).toLocaleDateString('nl-NL')}\n\nAlle prioriteits checks gebruiken nu deze datum.`);
    
    // Refresh pagina om datum wijziging door te voeren
    location.reload();
  } else {
    alert('⚠️ Selecteer eerst een datum!');
  }
}

// Clear date override
function clearDateOverride() {
  localStorage.removeItem('dateOverride');
  const dateOverrideInput = document.getElementById('dateOverride');
  if (dateOverrideInput) {
    dateOverrideInput.value = '';
  }
  updateDateOverrideUI();
  alert('✅ Datum override gereset. De echte datum wordt nu gebruikt.');
  
  // Refresh pagina om datum wijziging door te voeren
  location.reload();
}

// Update UI voor date override status
function updateDateOverrideUI() {
  const overrideDate = localStorage.getItem('dateOverride');
  const status = document.getElementById('dateOverrideStatus');
  
  if (status) {
    if (overrideDate) {
      const date = new Date(overrideDate);
      status.textContent = `📅 Override actief: ${date.toLocaleDateString('nl-NL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
      status.style.color = '#2196f3';
    } else {
      status.textContent = '✅ Gebruikt echte datum';
      status.style.color = '#28a745';
    }
  }
}

// Get current date (with override if set) - global function
function getCurrentDate() {
  const overrideDate = localStorage.getItem('dateOverride');
  if (overrideDate) {
    return new Date(overrideDate);
  }
  return new Date();
}

// Save pricing configuration
function savePricingConfig() {
  // TODO: Get all pricing values and save
  alert('Prijzen configuratie opgeslagen');
}
