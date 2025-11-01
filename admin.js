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
  
  // Display approved
  const approvedContainer = document.getElementById('approvedUsers');
  if (approvedContainer) {
    if (approved.length === 0) {
      approvedContainer.innerHTML = '<p class="empty-state">Geen goedgekeurde gebruikers</p>';
    } else {
      approvedContainer.innerHTML = approved.map(user => `
        <div class="user-item">
          <div class="user-info">
            <strong>${user.name} ${user.role === 'admin' ? '(Admin)' : ''}</strong>
            <div>${user.email}</div>
            <div style="font-size: 0.9em; color: #666;">
              Boekingsrechten: ${user.settings?.canBook ? '✅ Ja' : '❌ Nee'} | 
              Max/jaar: ${user.settings?.maxReservationsPerYear || 5} | 
              Prioriteit: ${user.settings?.priority || 'normal'}
            </div>
          </div>
          <div class="user-actions">
            <button class="btn-secondary" onclick="editUserSettings('${user.id}')">Instellingen</button>
            ${user.role !== 'admin' ? `<button class="btn-delete" onclick="deleteUserById('${user.id}')">Verwijderen</button>` : ''}
          </div>
        </div>
      `).join('');
    }
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
  document.getElementById('settingsCanBook').checked = user.settings?.canBook || false;
  document.getElementById('settingsMaxReservations').value = user.settings?.maxReservationsPerYear || 5;
  document.getElementById('settingsPriority').value = user.settings?.priority || 'normal';
  
  document.getElementById('userSettingsModal').style.display = 'block';
}

// Close settings modal
function closeUserSettingsModal() {
  document.getElementById('userSettingsModal').style.display = 'none';
}

// Save user settings
function saveUserSettings() {
  if (!checkAdminAccess()) return;
  const userId = document.getElementById('settingsUserId').value;
  const settings = {
    canBook: document.getElementById('settingsCanBook').checked,
    maxReservationsPerYear: parseInt(document.getElementById('settingsMaxReservations').value),
    priority: document.getElementById('settingsPriority').value
  };
  
  if (updateUserSettings(userId, settings)) {
    loadUsers();
    closeUserSettingsModal();
    alert('Instellingen opgeslagen');
  }
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

