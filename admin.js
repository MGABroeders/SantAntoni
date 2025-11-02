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

// Load transactions
function loadTransactions() {
  if (!checkAdminAccess()) return;
  
  const transactions = getTransactions();
  const container = document.getElementById('transactionsList');
  if (!container) return;
  
  if (transactions.length === 0) {
    container.innerHTML = '<p class="empty-state">Geen transacties</p>';
    return;
  }
  
  container.innerHTML = transactions.map(trans => {
    const date = new Date(trans.date).toLocaleDateString('nl-NL');
    return `
      <div class="transaction-item">
        <div class="transaction-info">
          <strong>${trans.userName || 'Onbekend'}</strong>
          <div>${trans.description}</div>
          <div style="font-size: 0.9em; color: #666;">${date}</div>
        </div>
        <div class="transaction-amount">
          <strong style="color: ${trans.amount >= 0 ? '#28a745' : '#dc3545'};">
            €${Math.abs(trans.amount).toFixed(2)}
          </strong>
          <div style="font-size: 0.85em;">${trans.status || 'open'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Tab switching
function initAdminTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.admin-tab-content');
  
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
  
  initAdminTabs();
  loadUsers();
  
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
