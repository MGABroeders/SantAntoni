// Reserveringssysteem voor Familie Sant Antoni

// Data opslag (localStorage)
const STORAGE_KEY = 'santantoni_reservations';
const MESSAGES_KEY = 'santantoni_messages';

// Prijsconfiguratie per seizoen
const PRIJZEN = {
  laag: { A: 80, B: 85 },      // Per nacht in euro's
  mid: { A: 120, B: 130 },
  hoog: { A: 180, B: 200 }     // Juli/Augustus
};

// Seizoen definities
function getSeizoen(maand) {
  // 0=jan, 1=feb, etc.
  if (maand === 6 || maand === 7) return 'hoog'; // Juli/Augustus
  if (maand >= 4 && maand <= 8) return 'mid';    // Mei t/m September (behalve jul/aug)
  return 'laag'; // Rest van het jaar
}

// Maandnamen in het Nederlands
const maandNamen = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

const dagNamen = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za'];
const dagNamenVolledig = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];

// Huidige weergave
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

// Functies voor data management
function getReservations() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

function saveReservations(reservations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reservations));
}

function addReservation(reservation) {
  const reservations = getReservations();
  reservation.id = Date.now().toString();
  reservation.created = new Date().toISOString();
  reservations.push(reservation);
  saveReservations(reservations);
  return reservation;
}

function deleteReservation(id) {
  const reservations = getReservations();
  const filtered = reservations.filter(r => r.id !== id);
  saveReservations(filtered);
}

// Berichten functies
function getMessages() {
  const data = localStorage.getItem(MESSAGES_KEY);
  return data ? JSON.parse(data) : [];
}

function saveMessages(messages) {
  localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

function addMessage(author, text) {
  const messages = getMessages();
  const message = {
    id: Date.now().toString(),
    author,
    text,
    date: new Date().toISOString()
  };
  messages.unshift(message); // Nieuwste eerst
  saveMessages(messages);
  return message;
}

// Prijsberekening
function calculatePrice(apartement, aankomst, vertrek) {
  if (!aankomst || !vertrek) return { total: 0, breakdown: '' };
  
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  let total = 0;
  const breakdown = [];
  const currentDate = new Date(start);
  
  while (currentDate < end) {
    const maand = currentDate.getMonth();
    const seizoen = getSeizoen(maand);
    const prijs = PRIJZEN[seizoen][apartement];
    
    total += prijs;
    breakdown.push({
      date: new Date(currentDate),
      seizoen,
      prijs
    });
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Groepeer per seizoen voor overzicht
  const grouped = breakdown.reduce((acc, item) => {
    const key = item.seizoen;
    if (!acc[key]) acc[key] = { count: 0, prijs: item.prijs, naam: getSeizoenNaam(key) };
    acc[key].count++;
    return acc;
  }, {});
  
  const breakdownText = Object.values(grouped)
    .map(g => `${g.count} nacht(en) ${g.naam} @ €${g.prijs}/nacht`)
    .join(', ');
  
  return { total, nights, breakdown: breakdownText };
}

function getSeizoenNaam(seizoen) {
  const namen = { laag: 'Laagseizoen', mid: 'Middenseizoen', hoog: 'Hoogseizoen' };
  return namen[seizoen] || seizoen;
}

// Check seizoensregels (juli/aug alleen hele weken)
function checkSeizoenRules(aankomst, vertrek) {
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const maand = start.getMonth();
  
  // Juli (6) of Augustus (7)
  if (maand === 6 || maand === 7) {
    const dayOfWeek = start.getDay(); // 0=zondag, 6=zaterdag
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // Moet zaterdag zijn (6) en minimaal 7 dagen
    if (dayOfWeek !== 6) {
      return { valid: false, message: 'In juli en augustus mag je alleen vanaf zaterdag reserveren.' };
    }
    if (days < 7 || days % 7 !== 0) {
      return { valid: false, message: 'In juli en augustus zijn alleen hele weken (zaterdag-zaterdag) mogelijk.' };
    }
  }
  
  return { valid: true };
}

// Check of een datum bezet is
function isDateReserved(date, reservations) {
  const dateStr = formatDate(date);
  return reservations.some(res => {
    const start = new Date(res.aankomst);
    const end = new Date(res.vertrek);
    const checkDate = new Date(date);
    return checkDate >= start && checkDate < end;
  });
}

// Check of een datum bezet is voor een specifiek appartement
function isDateReservedForApartment(date, apartment, reservations) {
  const dateStr = formatDate(date);
  const checkDate = new Date(date);
  return reservations.some(res => {
    if (res.appartement !== apartment) return false;
    const start = new Date(res.aankomst);
    const end = new Date(res.vertrek);
    return checkDate >= start && checkDate < end;
  });
}

function getReservationsForDate(date, reservations) {
  const checkDate = new Date(date);
  return reservations.filter(res => {
    const start = new Date(res.aankomst);
    const end = new Date(res.vertrek);
    return checkDate >= start && checkDate < end;
  });
}

// Format datum als YYYY-MM-DD
function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Kalender genereren
function generateCalendar() {
  const calendar = document.getElementById('calendar');
  const reservations = getReservations();
  
  // Maand en jaar header
  document.getElementById('currentMonth').textContent = 
    `${maandNamen[currentMonth]} ${currentYear}`;
  
  // Leeg maken
  calendar.innerHTML = '';
  
  // Dagen headers
  dagNamen.forEach(day => {
    const header = document.createElement('div');
    header.className = 'calendar-header';
    header.textContent = day;
    calendar.appendChild(header);
  });
  
  // Eerste dag van de maand
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());
  
  // Genereer 42 dagen (6 weken)
  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const dayDiv = document.createElement('div');
    dayDiv.className = 'calendar-day';
    
    const isCurrentMonth = date.getMonth() === currentMonth;
    const isToday = formatDate(date) === formatDate(new Date());
    
    if (!isCurrentMonth) {
      dayDiv.classList.add('other-month');
    }
    
    if (isToday) {
      dayDiv.classList.add('today');
    }
    
    // Check reserveringen
    const dateReservations = getReservationsForDate(date, reservations);
    const reservedA = isDateReservedForApartment(date, 'A', reservations);
    const reservedB = isDateReservedForApartment(date, 'B', reservations);
    
    if (reservedA && reservedB) {
      dayDiv.classList.add('reserved');
    } else if (reservedA) {
      dayDiv.classList.add('reserved-A');
    } else if (reservedB) {
      dayDiv.classList.add('reserved-B');
    }
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'calendar-day-number';
    dayNumber.textContent = date.getDate();
    dayDiv.appendChild(dayNumber);
    
    if (dateReservations.length > 0 && isCurrentMonth) {
      const reservationLabel = document.createElement('div');
      reservationLabel.className = 'calendar-day-reservation';
      const labels = dateReservations.map(r => `${r.naam} (${r.appartement})`);
      reservationLabel.textContent = labels.slice(0, 2).join(', ');
      if (labels.length > 2) reservationLabel.textContent += '...';
      dayDiv.appendChild(reservationLabel);
    }
    
    calendar.appendChild(dayDiv);
  }
}

// Reserveringen lijst weergeven
function displayReservations() {
  const container = document.getElementById('reservationsList');
  const reservations = getReservations().sort((a, b) => {
    return new Date(a.aankomst) - new Date(b.aankomst);
  });
  
  if (reservations.length === 0) {
    container.innerHTML = '<div class="empty-state">Nog geen reserveringen</div>';
    return;
  }
  
  container.innerHTML = reservations.map(res => {
    const aankomst = new Date(res.aankomst).toLocaleDateString('nl-NL');
    const vertrek = new Date(res.vertrek).toLocaleDateString('nl-NL');
    const statusBadge = res.status === 'goedgekeurd' 
      ? '<span class="status-badge approved">✓ Goedgekeurd</span>'
      : res.status === 'betaald'
      ? '<span class="status-badge paid">€ Betaald</span>'
      : '<span class="status-badge pending">⏳ In afwachting</span>';
    
    return `
      <div class="reservation-item">
        <div class="reservation-info">
          <strong>${res.naam}${res.email ? ` (${res.email})` : ''}</strong>
          <div class="reservation-dates">
            ${aankomst} - ${vertrek} ${res.personen ? `(${res.personen} persoon${res.personen > 1 ? 'en' : ''})` : ''}
          </div>
          ${res.prijs ? `<div style="margin-top: 0.5em; font-weight: bold; color: #1565c0;">€${res.prijs.toFixed(2)}</div>` : ''}
          ${res.opmerking ? `<div style="margin-top: 0.5em; color: #666; font-style: italic;">${res.opmerking}</div>` : ''}
          <div style="margin-top: 0.5em;">
            <span class="reservation-app">Appartement ${res.appartement}</span>
            ${statusBadge}
          </div>
        </div>
        <div class="reservation-actions">
          <button class="btn-delete" onclick="handleDeleteReservation('${res.id}')">Verwijderen</button>
        </div>
      </div>
    `;
  }).join('');
}

// Reservering verwijderen
function handleDeleteReservation(id) {
  if (confirm('Weet je zeker dat je deze reservering wilt verwijderen?')) {
    deleteReservation(id);
    displayReservations();
    generateCalendar();
  }
}

// Check op overlappende reserveringen
function hasOverlap(apartement, aankomst, vertrek, excludeId = null) {
  const reservations = getReservations();
  const newStart = new Date(aankomst);
  const newEnd = new Date(vertrek);
  
  return reservations.some(res => {
    if (res.id === excludeId) return false;
    if (res.appartement !== apartement) return false;
    
    const resStart = new Date(res.aankomst);
    const resEnd = new Date(res.vertrek);
    
    // Check overlap
    return (newStart < resEnd && newEnd > resStart);
  });
}

// Formulier verwerken
document.addEventListener('DOMContentLoaded', () => {
  // Init
  generateCalendar();
  displayReservations();
  
  // Stel minimale datum in (vandaag)
  const today = formatDate(new Date());
  document.getElementById('aankomst').setAttribute('min', today);
  document.getElementById('vertrek').setAttribute('min', today);
  
  // Update prijs bij wijziging datums of appartement
  function updatePrice() {
    const appartement = document.getElementById('appartement').value;
    const aankomst = document.getElementById('aankomst').value;
    const vertrek = document.getElementById('vertrek').value;
    const priceDisplay = document.getElementById('priceDisplay');
    
    if (appartement && aankomst && vertrek && new Date(aankomst) < new Date(vertrek)) {
      const priceInfo = calculatePrice(appartement, aankomst, vertrek);
      document.getElementById('calculatedPrice').textContent = priceInfo.total.toFixed(2);
      document.getElementById('priceBreakdown').textContent = priceInfo.breakdown;
      priceDisplay.style.display = 'block';
    } else {
      priceDisplay.style.display = 'none';
    }
  }
  
  // Update vertrek min wanneer aankomst verandert
  document.getElementById('aankomst').addEventListener('change', (e) => {
    const aankomstDate = e.target.value;
    document.getElementById('vertrek').setAttribute('min', aankomstDate);
    
    // Als vertrek voor aankomst is, reset vertrek
    const vertrekInput = document.getElementById('vertrek');
    if (vertrekInput.value && vertrekInput.value <= aankomstDate) {
      vertrekInput.value = '';
    }
    
    updatePrice();
  });
  
  document.getElementById('vertrek').addEventListener('change', updatePrice);
  document.getElementById('appartement').addEventListener('change', updatePrice);
  
  // Formulier submit
  document.getElementById('reservationForm').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const appartement = document.getElementById('appartement').value;
    const naam = document.getElementById('naam').value;
    const email = document.getElementById('email').value;
    const aankomst = document.getElementById('aankomst').value;
    const vertrek = document.getElementById('vertrek').value;
    const personen = parseInt(document.getElementById('personen').value);
    const opmerking = document.getElementById('opmerking').value;
    
    // Validatie
    if (new Date(aankomst) >= new Date(vertrek)) {
      alert('Vertrekdatum moet na aankomstdatum liggen!');
      return;
    }
    
    // Check seizoensregels
    const seasonCheck = checkSeizoenRules(aankomst, vertrek);
    if (!seasonCheck.valid) {
      alert(seasonCheck.message);
      return;
    }
    
    // Check overlap
    if (hasOverlap(appartement, aankomst, vertrek)) {
      alert(`Appartement ${appartement} is al gereserveerd in deze periode!`);
      return;
    }
    
    // Bereken prijs
    const priceInfo = calculatePrice(appartement, aankomst, vertrek);
    
    // Reservering toevoegen
    const reservation = {
      appartement,
      naam,
      email,
      aankomst,
      vertrek,
      personen,
      opmerking,
      prijs: priceInfo.total,
      status: 'in_afwachting' // Kan later worden goedgekeurd
    };
    
    addReservation(reservation);
    displayReservations();
    generateCalendar();
    
    // Formulier resetten
    document.getElementById('reservationForm').reset();
    document.getElementById('aankomst').setAttribute('min', today);
    document.getElementById('vertrek').setAttribute('min', today);
    
    alert('Reservering succesvol toegevoegd!');
  });
  
  // Kalender navigatie
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
    generateCalendar();
  });
  
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
    generateCalendar();
  });
  
  // Smooth scroll voor navigatie links
  document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href.startsWith('#')) {
        e.preventDefault();
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });
  
  // Foto galerij functionaliteit
  initGallery();
  
  // Familieberichten functionaliteit
  initMessages();
});

// Foto galerij
function initGallery() {
  const tabs = document.querySelectorAll('.gallery-tab');
  const items = document.querySelectorAll('.gallery-item');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const category = tab.dataset.gallery;
      
      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Filter items
      items.forEach(item => {
        if (category === 'all' || item.dataset.category === category) {
          item.classList.remove('hidden');
        } else {
          item.classList.add('hidden');
        }
      });
    });
  });
}

function openLightbox(src, alt) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  img.alt = alt;
  lightbox.classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
}

// Familieberichten
function initMessages() {
  displayMessages();
  
  document.getElementById('messageForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const author = document.getElementById('messageAuthor').value;
    const text = document.getElementById('messageText').value;
    
    if (author && text) {
      addMessage(author, text);
      displayMessages();
      document.getElementById('messageForm').reset();
    }
  });
}

function displayMessages() {
  const container = document.getElementById('messagesList');
  const messages = getMessages();
  
  if (messages.length === 0) {
    container.innerHTML = '<div class="empty-state">Nog geen berichten geplaatst</div>';
    return;
  }
  
  container.innerHTML = messages.map(msg => {
    const date = new Date(msg.date).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return `
      <div class="message-item">
        <div class="message-header">
          <span class="message-author">${msg.author}</span>
          <span class="message-date">${date}</span>
        </div>
        <div class="message-text">${msg.text}</div>
      </div>
    `;
  }).join('');
}
