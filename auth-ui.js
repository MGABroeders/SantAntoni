// UI functies voor authenticatie (login/register forms)

// Initialize login page
function initLoginPage() {
  // Tab switching
  const tabs = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      forms.forEach(f => {
        f.classList.remove('active');
        if (f.id === `${targetTab}Form`) {
          f.classList.add('active');
        }
      });
      
      // Clear errors
      document.getElementById('loginError').style.display = 'none';
      document.getElementById('registerError').style.display = 'none';
      document.getElementById('registerSuccess').style.display = 'none';
    });
  });
  
  // Login form
  document.getElementById('loginFormElement').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const result = login(email, password);
    const errorDiv = document.getElementById('loginError');
    
    if (result.success) {
      window.location.href = 'index.html';
    } else {
      errorDiv.textContent = result.message;
      errorDiv.style.display = 'block';
    }
  });
  
  // Register form
  document.getElementById('registerFormElement').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    
    const errorDiv = document.getElementById('registerError');
    const successDiv = document.getElementById('registerSuccess');
    
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    if (password !== passwordConfirm) {
      errorDiv.textContent = 'Wachtwoorden komen niet overeen';
      errorDiv.style.display = 'block';
      return;
    }
    
    const result = register(name, email, password);
    
    if (result.success) {
      successDiv.style.display = 'block';
      document.getElementById('registerFormElement').reset();
      errorDiv.style.display = 'none';
    } else {
      errorDiv.textContent = result.message;
      errorDiv.style.display = 'block';
    }
  });
}

// Update navigation with login/logout
function updateNavigation() {
  const authNav = document.getElementById('authNav');
  if (!authNav) return;
  
  const user = getCurrentUser();
  
  if (user) {
    if (isAdmin()) {
      authNav.innerHTML = `
        <a href="admin.html">Beheer</a>
        <a href="#" onclick="logout(); return false;">Uitloggen (${user.name})</a>
      `;
    } else {
      authNav.innerHTML = `
        <a href="#" onclick="logout(); return false;">Uitloggen (${user.name})</a>
      `;
    }
  } else {
    authNav.innerHTML = `
      <a href="login.html">Inloggen</a>
    `;
  }
}

// Check if page needs authentication
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Check if user can book
function requireBookingAccess() {
  if (!requireAuth()) return false;
  if (!canBook()) {
    alert('Je hebt geen rechten om te reserveren. Neem contact op met een beheerder.');
    return false;
  }
  return true;
}

// Initialize on page load
if (typeof window !== 'undefined') {
  // Update navigation on all pages
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateNavigation);
  } else {
    updateNavigation();
  }
}

