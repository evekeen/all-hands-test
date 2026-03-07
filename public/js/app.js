// RFQ Matcher Frontend Application

const API_BASE = '/api';

// State
let authToken = localStorage.getItem('authToken');
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initNavigation();
  initModals();
  initForms();
  
  if (authToken) {
    showMainApp();
    loadDashboard();
  }
});

// Auth Functions
function initAuth() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
      } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
      }
    });
  });
  
  loginForm.addEventListener('submit', handleLogin);
  registerForm.addEventListener('submit', handleRegister);
  
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showToast(data.error || 'Login failed', 'error');
      return;
    }
    
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    currentUser = data.supplier;
    
    showMainApp();
    loadDashboard();
    showToast('Welcome back!', 'success');
  } catch (error) {
    showToast('Login failed', 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('register-email').value;
  const companyName = document.getElementById('register-company').value;
  const password = document.getElementById('register-password').value;
  
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, companyName, password })
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      showToast(data.error || 'Registration failed', 'error');
      return;
    }
    
    authToken = data.token;
    localStorage.setItem('authToken', authToken);
    currentUser = data.supplier;
    
    showMainApp();
    loadDashboard();
    showToast('Account created!', 'success');
  } catch (error) {
    showToast('Registration failed', 'error');
  }
}

function handleLogout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('authToken');
  
  document.getElementById('auth-section').classList.remove('hidden');
  document.getElementById('main-section').classList.add('hidden');
  
  // Reset forms
  document.getElementById('login-form').reset();
  document.getElementById('register-form').reset();
}

function showMainApp() {
  document.getElementById('auth-section').classList.add('hidden');
  document.getElementById('main-section').classList.remove('hidden');
  
  if (currentUser) {
    document.getElementById('user-company').textContent = currentUser.companyName;
  }
  
  loadProfile();
}

// Navigation
function initNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');
  
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewName = btn.dataset.view;
      
      navBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      views.forEach(v => v.classList.remove('active'));
      document.getElementById(`${viewName}-view`).classList.add('active');
      
      // Load data for the view
      switch (viewName) {
        case 'dashboard':
          loadDashboard();
          break;
        case 'catalog':
          loadCatalog();
          break;
        case 'rfqs':
          loadRfqs();
          break;
        case 'matches':
          loadMatches();
          break;
        case 'profile':
          loadProfile();
          break;
      }
    });
  });
}

// Dashboard
async function loadDashboard() {
  try {
    // Get catalog count
    const catalogRes = await fetch(`${API_BASE}/catalog`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const catalogItems = await catalogRes.json();
    
    // Get RFQ count
    const rfqRes = await fetch(`${API_BASE}/rfqs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const rfqs = await rfqRes.json();
    
    // Get match count
    const matchRes = await fetch(`${API_BASE}/matches`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const matches = await matchRes.json();
    
    // Update stats
    document.getElementById('catalog-count').textContent = catalogItems.length;
    document.getElementById('rfq-count').textContent = rfqs.length;
    document.getElementById('match-count').textContent = matches.length;
    document.getElementById('pending-count').textContent = matches.filter(m => m.status === 'pending').length;
    
    // Show recent matches
    const recentList = document.getElementById('recent-matches-list');
    if (matches.length === 0) {
      recentList.innerHTML = '<p class="empty-state">No matches yet. Upload your catalog and run matching!</p>';
    } else {
      recentList.innerHTML = matches.slice(0, 5).map(m => `
        <div class="match-card">
          <div class="match-header">
            <div>
              <h4>${m.rfq.title}</h4>
              <span class="catalog-ref">Matched: ${m.catalogItem?.name || 'Unknown'}</span>
            </div>
            <span class="match-score ${getScoreClass(m.confidenceScore)}">${Math.round(m.confidenceScore * 100)}%</span>
          </div>
          <div class="meta">
            <span class="status-badge ${m.status}">${m.status}</span>
            <span>${new Date(m.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Load dashboard error:', error);
  }
}

document.getElementById('run-matching-btn').addEventListener('click', async () => {
  const btn = document.getElementById('run-matching-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Running...';
  
  try {
    const res = await fetch(`${API_BASE}/matches/run-matching`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    if (res.ok) {
      showToast('Matching complete!', 'success');
      loadDashboard();
    } else {
      showToast('Matching failed', 'error');
    }
  } catch (error) {
    showToast('Matching failed', 'error');
  }
  
  btn.disabled = false;
  btn.textContent = '🔄 Run Matching';
});

// Catalog
async function loadCatalog() {
  try {
    const res = await fetch(`${API_BASE}/catalog`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const items = await res.json();
    
    const catalogList = document.getElementById('catalog-list');
    
    if (items.length === 0) {
      catalogList.innerHTML = '<p class="empty-state">No catalog items. Upload a CSV or add items manually.</p>';
      return;
    }
    
    catalogList.innerHTML = items.map(item => `
      <div class="catalog-item">
        <h4>${item.name}</h4>
        <div class="meta">
          <span>Category: ${item.categories.join(', ') || 'None'}</span>
          ${item.skus.length ? `<span>SKU: ${item.skus.join(', ')}</span>` : ''}
        </div>
        <div class="keywords">
          ${item.keywords.map(k => `<span class="keyword-tag">${k}</span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Load catalog error:', error);
  }
}

function initModals() {
  // Upload modal
  document.getElementById('upload-catalog-btn').addEventListener('click', () => {
    document.getElementById('upload-modal').classList.remove('hidden');
  });
  
  // Add item modal
  document.getElementById('add-item-btn').addEventListener('click', () => {
    document.getElementById('item-modal').classList.remove('hidden');
  });
  
  // Close modals
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  
  // Close on background click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.add('hidden');
      }
    });
  });
}

function initForms() {
  // Upload form
  document.getElementById('upload-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = document.getElementById('csv-file');
    const file = fileInput.files[0];
    
    if (!file) {
      showToast('Please select a file', 'error');
      return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_BASE}/catalog/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
        body: formData
      });
      
      const data = await res.json();
      
      if (res.ok) {
        showToast(`Uploaded ${data.items.length} items!`, 'success');
        document.getElementById('upload-modal').classList.add('hidden');
        document.getElementById('upload-form').reset();
        loadCatalog();
        loadDashboard();
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (error) {
      showToast('Upload failed', 'error');
    }
  });
  
  // Add item form
  document.getElementById('item-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('item-name').value;
    const keywords = document.getElementById('item-keywords').value.split(',').map(k => k.trim()).filter(Boolean);
    const categories = document.getElementById('item-categories').value.split(',').map(c => c.trim()).filter(Boolean);
    const skus = document.getElementById('item-skus').value.split(',').map(s => s.trim()).filter(Boolean);
    
    try {
      const res = await fetch(`${API_BASE}/catalog`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, keywords, categories, skus })
      });
      
      if (res.ok) {
        showToast('Item added!', 'success');
        document.getElementById('item-modal').classList.add('hidden');
        document.getElementById('item-form').reset();
        loadCatalog();
        loadDashboard();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to add item', 'error');
      }
    } catch (error) {
      showToast('Failed to add item', 'error');
    }
  });
  
  // Profile form
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const companyName = document.getElementById('profile-company').value;
    const notificationEmail = document.getElementById('profile-notification-email').value;
    const notificationTime = document.getElementById('profile-notification-time').value;
    
    try {
      const res = await fetch(`${API_BASE}/suppliers`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ companyName, notificationEmail, notificationTime })
      });
      
      if (res.ok) {
        showToast('Profile updated!', 'success');
        currentUser = { ...currentUser, companyName, notificationEmail, notificationTime };
        document.getElementById('user-company').textContent = companyName;
      } else {
        showToast('Failed to update profile', 'error');
      }
    } catch (error) {
      showToast('Failed to update profile', 'error');
    }
  });
}

// RFQs
async function loadRfqs() {
  try {
    const res = await fetch(`${API_BASE}/rfqs`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const rfqs = await res.json();
    
    const rfqList = document.getElementById('rfq-list');
    
    if (rfqs.length === 0) {
      rfqList.innerHTML = '<p class="empty-state">No RFQs available.</p>';
      return;
    }
    
    rfqList.innerHTML = rfqs.map(rfq => `
      <div class="rfq-card ${rfq.hasMatch ? 'has-match' : ''}">
        <h4>${rfq.title}</h4>
        <div class="meta">
          <span>📁 ${rfq.category}</span>
          <span>📍 ${rfq.rawData?.location || 'N/A'}</span>
          <span>🏢 ${rfq.rawData?.buyer || 'N/A'}</span>
          <span>📅 ${new Date(rfq.closingDate).toLocaleDateString()}</span>
        </div>
        <p class="description">${rfq.description}</p>
        <div class="actions">
          ${rfq.hasMatch ? `
            <span class="match-score ${getScoreClass(rfq.confidenceScore)}">${Math.round(rfq.confidenceScore * 100)}% Match</span>
            <span class="status-badge ${rfq.matchStatus}">${rfq.matchStatus}</span>
          ` : '<span class="meta">No match yet</span>'}
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Load RFQs error:', error);
  }
}

document.getElementById('scan-rfqs-btn').addEventListener('click', async () => {
  const btn = document.getElementById('scan-rfqs-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading"></span> Scanning...';
  
  try {
    const res = await fetch(`${API_BASE}/rfqs/scan`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const data = await res.json();
    showToast(data.message, 'success');
    loadRfqs();
  } catch (error) {
    showToast('Scan failed', 'error');
  }
  
  btn.disabled = false;
  btn.textContent = '🔄 Refresh';
});

// Matches
async function loadMatches() {
  try {
    const filter = document.getElementById('match-filter').value;
    
    const res = await fetch(`${API_BASE}/matches`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    let matches = await res.json();
    
    // Apply filter
    if (filter !== 'all') {
      matches = matches.filter(m => m.status === filter);
    }
    
    const matchList = document.getElementById('match-list');
    
    if (matches.length === 0) {
      matchList.innerHTML = '<p class="empty-state">No matches found.</p>';
      return;
    }
    
    matchList.innerHTML = matches.map(m => `
      <div class="match-card">
        <div class="match-header">
          <div>
            <h4>${m.rfq.title}</h4>
            <span class="catalog-ref">Matched: ${m.catalogItem?.name || 'Unknown'}</span>
          </div>
          <span class="match-score ${getScoreClass(m.confidenceScore)}">${Math.round(m.confidenceScore * 100)}%</span>
        </div>
        <div class="reasoning">${m.llmReasoning || 'No reasoning available'}</div>
        <div class="meta">
          <span class="status-badge ${m.status}">${m.status}</span>
          <span>📁 ${m.rfq.category}</span>
          <span>📅 ${new Date(m.rfq.closingDate).toLocaleDateString()}</span>
        </div>
        <div class="actions" style="margin-top: 12px;">
          <button class="btn btn-primary" onclick="updateMatchStatus('${m.id}', 'viewed')">Mark Viewed</button>
          <button class="btn btn-outline" onclick="updateMatchStatus('${m.id}', 'bid_started')">Start Bid</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Load matches error:', error);
  }
}

document.getElementById('match-filter').addEventListener('change', loadMatches);

window.updateMatchStatus = async function(matchId, status) {
  try {
    const res = await fetch(`${API_BASE}/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    
    if (res.ok) {
      showToast(`Status updated to ${status}`, 'success');
      loadMatches();
      loadDashboard();
    } else {
      showToast('Failed to update status', 'error');
    }
  } catch (error) {
    showToast('Failed to update status', 'error');
  }
};

// Profile
async function loadProfile() {
  try {
    const res = await fetch(`${API_BASE}/suppliers`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const profile = await res.json();
    
    document.getElementById('profile-email').value = profile.email || '';
    document.getElementById('profile-company').value = profile.companyName || '';
    document.getElementById('profile-notification-email').value = profile.notificationEmail || '';
    document.getElementById('profile-notification-time').value = profile.notificationTime || '08:00';
  } catch (error) {
    console.error('Load profile error:', error);
  }
}

// Utility Functions
function getScoreClass(score) {
  if (score >= 0.7) return 'high';
  if (score >= 0.4) return 'medium';
  return 'low';
}

function showToast(message, type = 'info') {
  // Remove existing toasts
  document.querySelectorAll('.toast').forEach(t => t.remove());
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
