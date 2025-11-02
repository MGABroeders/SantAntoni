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
  
  // Group reservations by year (based on arrival date)
  const reservationsByYear = {};
  reservations.forEach(res => {
    const year = new Date(res.aankomst).getFullYear();
    if (!reservationsByYear[year]) {
      reservationsByYear[year] = [];
    }
    reservationsByYear[year].push(res);
  });
  
  // Sort years descending (newest first)
  const years = Object.keys(reservationsByYear).sort((a, b) => parseInt(b) - parseInt(a));
  
  // Build HTML grouped by year
  let html = '';
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
      const appartement = res.appartement === '35' || res.appartement === 'A' ? 'A' : (res.appartement === '36' || res.appartement === 'B' ? 'B' : res.appartement);
      
      if (typeof calculatePriceWithDiscounts === 'function' && user) {
        const priceInfo = calculatePriceWithDiscounts(appartement, res.aankomst, res.vertrek, user);
        price = priceInfo.total;
      } else if (typeof calculatePrice === 'function') {
        const priceInfo = calculatePrice(appartement, res.aankomst, res.vertrek, user || null);
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
  
  const reservations = typeof getReservations === 'function' ? getReservations() : [];
  const reservation = reservations.find(r => r.id === reservationId);
  
  if (!reservation) {
    alert('Reservering niet gevonden');
    return;
  }
  
  // Update status to 'betaald'
  reservation.status = 'betaald';
  
  // Set flag to prevent syncReservationsToFirebase from overwriting
  if (typeof firebaseDB !== 'undefined') {
    if (typeof firebaseDirectUpdateInProgress !== 'undefined') {
      firebaseDirectUpdateInProgress = true;
      lastDirectUpdateTime = Date.now();
    }
  }
  
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
      if (typeof firebaseDirectUpdateInProgress !== 'undefined') {
        firebaseDirectUpdateInProgress = false;
      }
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
  
  if (!confirm('Weet je zeker dat je deze reservering wilt verwijderen? Dit kan niet ongedaan worden gemaakt.')) {
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
      await firebaseDB.collection('reservations').doc(reservation.id).delete();
      console.log('Reservering verwijderd uit Firebase:', reservation.id);
      
      // Wait a moment for Firebase to propagate
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Fout bij verwijderen reservering uit Firebase:', error);
      alert('Fout bij verwijderen reservering uit Firebase. Check console voor details.');
      // Reset flag on error
      window.firebaseDirectUpdateInProgress = false;
      return; // Stop if Firebase delete fails
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
    }
  }
  
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
      }
    });
  });
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

// Save pricing configuration
function savePricingConfig() {
  // TODO: Get all pricing values and save
  alert('Prijzen configuratie opgeslagen');
}
