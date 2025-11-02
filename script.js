// Reserveringssysteem voor Familie Sant Antoni

// Data opslag (localStorage)
const STORAGE_KEY = 'santantoni_reservations';
const MESSAGES_KEY = 'santantoni_messages';

// NIEUWE Prijsconfiguratie per appartement, familie en seizoen
// Zomer = Juni en Juli (maanden 5 en 6)
const PRIJZEN = {
  '35': { // Appartement 35
    'A': { zomer: 58, laag: 43 },      // Familie A: €58 zomer, €43 laag
    'B': { zomer: 58, laag: 43 },      // Familie B: €58 zomer, €43 laag
    'C': { zomer: 143, laag: 86 }      // Familie C (geen familie): €143 zomer, €86 laag
  },
  '36': { // Appartement 36
    'B': { zomer: 48, laag: 34 },      // Familie B: €48 zomer, €34 laag
    'A': { zomer: 675, laag: 67 },     // Familie A: €675/week zomer, €67 laag
    'C': { zomer: 675, laag: 67 }      // Familie C: €675/week zomer, €67 laag
  }
};

// Seizoen definities (voor App 35/36 zijn zomer en laag anders dan voorheen)
function getSeizoen(maand) {
  // 0=jan, 1=feb, etc. Zomer is juni en juli (5 en 6)
  if (maand === 5 || maand === 6) return 'zomer';  // Juni en Juli
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

// Selectie state voor kalender
const selectionState = {
  A: { startDate: null, endDate: null },
  B: { startDate: null, endDate: null }
};

// Functies voor data management worden nu gehandeld door firebase-db.js
// Deze localStorage versies blijven als fallback maar worden overschreven door firebase-db.js functies

// Prijsberekening met NIEUWE structuur (gebruikt familie uit user)
function calculatePrice(apartement, aankomst, vertrek, user = null) {
  if (!aankomst || !vertrek) return { total: 0, breakdown: '', breakdownItems: [] };
  
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  // Familie bepalen: gebruik user.family, anders default naar 'C' (geen familie)
  const family = user && user.family ? user.family : 'C';
  
  // Converteer A->35, B->36 voor oude code compatibiliteit
  const appartementId = appartement === 'A' ? '35' : (appartement === 'B' ? '36' : appartement);
  
  // Check of appartementnummer correct is
  if (!PRIJZEN[appartementId] || !PRIJZEN[appartementId][family]) {
    console.error(`Geen prijs configuratie voor App ${appartementId}, Familie ${family}`);
    return { total: 0, breakdown: '', breakdownItems: [] };
  }
  
  const appPricing = PRIJZEN[appartementId][family];
  
  let total = 0;
  const breakdown = [];
  const currentDate = new Date(start);
  
  while (currentDate < end) {
    const maand = currentDate.getMonth();
    const seizoen = getSeizoen(maand);
    const prijsPerNacht = appPricing[seizoen];
    
    // Speciale logica voor App 36 zomer (€675/week alleen voor Familie A/C)
    if (appartementId === '36' && seizoen === 'zomer' && (family === 'A' || family === 'C')) {
      // €675 per week, niet per nacht
      breakdown.push({
        date: new Date(currentDate),
        seizoen,
        prijs: prijsPerNacht,
        weeklyPricing: true
      });
    } else {
      // Normale per-nacht prijs
      total += prijsPerNacht;
      breakdown.push({
        date: new Date(currentDate),
        seizoen,
        prijs: prijsPerNacht
      });
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // Groepeer per seizoen voor overzicht, rekening houdend met weekly pricing
  const grouped = {};
  let weeklyNights = 0;
  let weeklyTotal = 0;
  
  breakdown.forEach(item => {
    if (item.weeklyPricing) {
      weeklyNights++;
      if (!grouped.weekly) {
        grouped.weekly = { count: 0, prijs: item.prijs, naam: 'Zomer (per week)', isWeekly: true };
      }
      grouped.weekly.count++;
    } else {
      const key = item.seizoen;
      if (!grouped[key]) grouped[key] = { count: 0, prijs: item.prijs, naam: getSeizoenNaam(key) };
      grouped[key].count++;
    }
  });
  
  // Bereken totalen: voor weekly pricing moet je weken tellen
  if (grouped.weekly) {
    const weeks = Math.ceil(weeklyNights / 7);
    const weeklyPrice = grouped.weekly.prijs;
    weeklyTotal = weeks * weeklyPrice;
  }
  
  const breakdownItems = Object.values(grouped);
  
  // Build breakdown text
  const breakdownText = breakdownItems
    .map(g => {
      if (g.isWeekly) {
        const weeks = Math.ceil(g.count / 7);
        return `${weeks} week(en) ${g.naam} @ €${g.prijs}/week`;
      }
      return `${g.count} nacht(en) ${g.naam} @ €${g.prijs}/nacht`;
    })
    .join(', ');
  
  return { 
    total: total + weeklyTotal, 
    nights, 
    breakdown: breakdownText, 
    breakdownItems: breakdownItems.map(item => ({
      count: item.isWeekly ? Math.ceil(item.count / 7) : item.count,
      prijs: item.prijs,
      naam: item.naam,
      isWeekly: item.isWeekly || false
    }))
  };
}

function getSeizoenNaam(seizoen) {
  const namen = { laag: 'Laagseizoen', zomer: 'Zomer' };
  return namen[seizoen] || seizoen;
}

// Check seizoensregels (zomermaanden alleen hele weken zaterdag-zaterdag)
function checkSeizoenRules(aankomst, vertrek) {
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const maand = start.getMonth();
  
  // Juni, Juli, Augustus, September (5, 6, 7, 8)
  if (maand >= 5 && maand <= 8) {
    const dayOfWeek = start.getDay(); // 0=zondag, 6=zaterdag
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // Moet zaterdag zijn (6) en minimaal 7 dagen
    if (dayOfWeek !== 6) {
      return { valid: false, message: 'In juni, juli, augustus en september mag je alleen vanaf zaterdag reserveren.' };
    }
    if (days < 7 || days % 7 !== 0) {
      return { valid: false, message: 'In juni, juli, augustus en september zijn alleen hele weken (zaterdag-zaterdag) mogelijk.' };
    }
  }
  
  return { valid: true };
}

// Bepaal welke familie voorrang heeft in een zomermaand
function getPriorityFamilyForMonth(maand, year, appartement) {
  // Appartement 36: altijd familie B
  if (appartement === '36' || appartement === 'B') {
    return 'B';
  }
  
  // Appartement 35: wisselend
  // Juni (5) en Juli (6): even jaren → A, oneven jaren → B
  // Augustus (7) en September (8): even jaren → B, oneven jaren → A
  if (maand === 5 || maand === 6) {
    return year % 2 === 0 ? 'A' : 'B';
  }
  if (maand === 7 || maand === 8) {
    return year % 2 === 0 ? 'B' : 'A';
  }
  
  return null; // Geen voorrang buiten zomermaanden
}

// Check voorseizoen constraint (1 jan - 31 mrt: alleen voorgang families)
function checkPreseasonConstraint(aankomst, user, appartement) {
  const today = new Date();
  const reservationDate = new Date(aankomst);
  const year = reservationDate.getFullYear();
  
  // Voorseizoen: 1 januari tot 31 maart
  if (today.getMonth() < 3) { // Voor 1 april
    // Check of dit een zomermaand is (juni t/m september = 5 t/m 8)
    const reservationMonth = reservationDate.getMonth();
    if (reservationMonth >= 5 && reservationMonth <= 8) {
      const priorityFamily = getPriorityFamilyForMonth(reservationMonth, year, appartement);
      if (priorityFamily && user.family !== priorityFamily) {
        return { valid: false, message: `In het voorseizoen (januari-maart) mogen alleen leden van familie ${priorityFamily} de zomermaanden reserveren voor Appartement ${appartement === 'A' ? '35' : '36'}.` };
      }
    }
  }
  
  return { valid: true };
}

// Bepaal totaalprijs met kortingen
function calculatePriceWithDiscounts(apartement, aankomst, vertrek, user) {
  const basePrice = calculatePrice(apartement, aankomst, vertrek, user);
  let discounts = [];
  let discountAmount = 0;
  
  // Beheerderskorting: admin krijgt 100% korting
  if (user.role === 'admin') {
    discountAmount = basePrice.total;
    discounts.push({ type: 'beheerder', amount: discountAmount, percentage: 100 });
    return { total: 0, discounts, breakdown: basePrice.breakdownItems };
  }
  
  // Langverblijfkorting: 5% bij 3+ weken buiten zomer
  const nights = basePrice.nights;
  const startDate = new Date(aankomst);
  const maand = startDate.getMonth();
  
  if (nights >= 21 && (maand < 5 || maand > 8)) {
    const discount = basePrice.total * 0.05;
    discountAmount += discount;
    discounts.push({ type: 'langverblijf', amount: discount, percentage: 5, nights });
  }
  
  // Familiekorting: 10% korting voor niet-voorgang families die binnen 2 weken boeken
  const today = new Date();
  const daysUntilArrival = Math.ceil((startDate - today) / (1000 * 60 * 60 * 24));
  
  if (maand >= 5 && maand <= 8 && daysUntilArrival <= 14 && daysUntilArrival >= 0) {
    const year = startDate.getFullYear();
    const priorityFamily = getPriorityFamilyForMonth(maand, year, appartement);
    
    if (user.family && user.family !== priorityFamily) {
      const remainingAmount = basePrice.total - discountAmount;
      const discount = remainingAmount * 0.10;
      discountAmount += discount;
      discounts.push({ type: 'familiekorting', amount: discount, percentage: 10, reason: 'last-minute boeking' });
    }
  }
  
  return {
    total: Math.max(0, basePrice.total - discountAmount),
    discounts,
    breakdownItems: basePrice.breakdownItems,
    baseTotal: basePrice.total
  };
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

// Kalender genereren voor specifiek appartement
function generateCalendarForApartment(apartment) {
  const calendarId = apartment ? `calendar-${apartment}` : 'calendar';
  const calendar = document.getElementById(calendarId);
  if (!calendar) return; // Als kalender niet bestaat, skip
  
  const reservations = getReservations();
  
  // Maand en jaar header (alleen bij single calendar)
  const monthHeader = document.getElementById('currentMonth');
  if (monthHeader && !apartment) {
    monthHeader.textContent = `${maandNamen[currentMonth]} ${currentYear}`;
  }
  
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
    
    // Check reserveringen - filter per appartement als specifiek appartement is geselecteerd
    let dateReservations = getReservationsForDate(date, reservations);
    let isReserved = false;
    
    if (apartment) {
      // Alleen reserveringen voor dit specifieke appartement
      dateReservations = dateReservations.filter(r => r.appartement === apartment);
      isReserved = isDateReservedForApartment(date, apartment, reservations);
      
      if (isReserved) {
        dayDiv.classList.add(`reserved-${apartment}`);
      }
    } else {
      // Originele logica voor single calendar
      const reservedA = isDateReservedForApartment(date, 'A', reservations);
      const reservedB = isDateReservedForApartment(date, 'B', reservations);
      
      if (reservedA && reservedB) {
        dayDiv.classList.add('reserved');
      } else if (reservedA) {
        dayDiv.classList.add('reserved-A');
      } else if (reservedB) {
        dayDiv.classList.add('reserved-B');
      }
    }
    
     const dayNumber = document.createElement('div');
     dayNumber.className = 'calendar-day-number';
     dayNumber.textContent = date.getDate();
     dayDiv.appendChild(dayNumber);
     
     // Check selectie state voor dit appartement
     if (apartment) {
       const selection = selectionState[apartment];
       const dateStr = formatDate(date);
       const isStart = selection.startDate && formatDate(selection.startDate) === dateStr;
       const isEnd = selection.endDate && formatDate(selection.endDate) === dateStr;
       const isInRange = selection.startDate && selection.endDate && 
                        date > new Date(selection.startDate) && 
                        date < new Date(selection.endDate);
       
       if (isStart) {
         dayDiv.classList.add('selected-start');
       }
       
       if (isEnd) {
         dayDiv.classList.add('selected-end');
       }
       
       if (isInRange) {
         dayDiv.classList.add('selected-range');
       }
       
       // Alleen clickable als niet gereserveerd
       if (!isReserved && isCurrentMonth) {
         dayDiv.classList.add('clickable');
         dayDiv.style.cursor = 'pointer';
         dayDiv.dataset.date = dateStr;
         dayDiv.addEventListener('click', () => handleDateClick(date, apartment));
         
         // Hover effect
         dayDiv.addEventListener('mouseenter', () => {
           // Altijd blauw bij hover tenzij beide datums al gekozen
           if (!selection.startDate || !selection.endDate) {
             const hoverDate = date;
             const hoverDateStr = formatDate(hoverDate);
             
             // Als er een start is, bepaal hoeken
             if (selection.startDate && !selection.endDate) {
               const calendarDays = calendar.querySelectorAll('.calendar-day');
               const startDate = new Date(selection.startDate);
               const startDateStr = formatDate(startDate);
               
               // Altijd hover-day toevoegen aan hoverende dag met rechter hoeken
               dayDiv.classList.add('hover-day');
               dayDiv.classList.add('hover-end');
               
               // Check eerst of er bezette dagen in het bereik zitten
               const reservations = getReservations();
               let hasBlockedDays = false;
               const checkDate = new Date(startDate);
               while (checkDate < hoverDate) {
                 if (isDateReservedForApartment(checkDate, apartment, reservations)) {
                   hasBlockedDays = true;
                   break;
                 }
                 checkDate.setDate(checkDate.getDate() + 1);
               }
               
               calendarDays.forEach(dayEl => {
                 const dayDateStr = dayEl.dataset.date;
                 if (dayDateStr) {
                   const dayDate = new Date(dayDateStr);
                   
                   // Als deze dag tussen start en hover zit
                   if (hoverDate > startDate && dayDate > startDate && dayDate < hoverDate) {
                     // Als er bezette dagen zijn, maak alles rood
                     if (hasBlockedDays) {
                       dayEl.classList.add('hover-range-blocked');
                     } else {
                       dayEl.classList.add('hover-range');
                     }
                   }
                   
                   // Niet hover-day toevoegen aan start datum
                   if (dayDateStr === startDateStr) {
                     dayEl.classList.remove('hover-day');
                   }
                 }
               });
             } else {
               // Geen start datum, dus alle hoeken rond
               dayDiv.classList.add('hover-day');
               dayDiv.classList.add('hover-start');
             }
           }
         });
         
         dayDiv.addEventListener('mouseleave', () => {
           dayDiv.classList.remove('hover-day', 'hover-start', 'hover-end');
           const calendarDays = calendar.querySelectorAll('.calendar-day');
           calendarDays.forEach(dayEl => {
             dayEl.classList.remove('hover-range', 'hover-range-blocked');
           });
         });
       }
     }
     
     // Voeg hover en click handlers toe voor reserveringen
     if (dateReservations.length > 0 && isCurrentMonth) {
       const res = dateReservations[0]; // Neem eerste reservering
       const resStart = new Date(res.aankomst);
       const resEnd = new Date(res.vertrek);
       resEnd.setDate(resEnd.getDate() - 1); // Vertrekdag telt niet
       
       // Format datums voor weergave
       const formatDisplayDate = (d) => {
         return `${d.getDate()} ${maandNamen[d.getMonth()]} ${d.getFullYear()}`;
       };
       
       // Tooltip bij hover
       dayDiv.setAttribute('title', `${res.naam}`);
       dayDiv.classList.add('has-reservation');
       
       // Click handler voor reserverings details
       if (!apartment) { // Alleen op single calendar pagina
         dayDiv.style.cursor = 'pointer';
         dayDiv.addEventListener('click', (e) => {
           e.preventDefault();
           alert(`Al geboekt door ${res.naam}\n\n` +
                 `Van: ${formatDisplayDate(resStart)}\n` +
                 `Tot: ${formatDisplayDate(resEnd)}\n` +
                 `Aantal personen: ${res.personen}\n` +
                 `Appartement: ${res.appartement}\n` +
                 `Status: ${res.status === 'goedgekeurd' ? 'Goedgekeurd' : res.status === 'in_afwachting' ? 'In afwachting' : 'Betaald'}`);
         });
       }
     }
     
     calendar.appendChild(dayDiv);
   }
   
   // Check overlay voor boekingsbeperkingen
   if (apartment) {
     const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
     const today = new Date();
     const todayYear = today.getFullYear();
     
     // Check alle dagen in de maand voor zomermaanden
     let shouldShowOverlay = false;
     
     // Check of huidige maand een zomermaand is
     if (user && user.family && currentMonth >= 5 && currentMonth <= 8) {
       // Check of we al in het jaar zijn dat we willen reserveren
       if (currentYear > todayYear) {
         // We kijken naar volgend jaar: pas vanaf 1 januari van dat jaar mag je reserveren
         shouldShowOverlay = true;
       } else if (currentYear === todayYear) {
         // We kijken naar huidig jaar: pas vanaf 1 januari van dit jaar mag je reserveren
         const jan1ThisYear = new Date(todayYear, 0, 1);
         if (today < jan1ThisYear) {
           shouldShowOverlay = true;
         }
       }
     }
     
     if (shouldShowOverlay) {
       calendar.style.position = 'relative';
       
       const overlay = document.createElement('div');
       overlay.className = 'booking-overlay';
       overlay.style.position = 'absolute';
       overlay.style.top = '0';
       overlay.style.left = '0';
       overlay.style.width = '100%';
       overlay.style.height = '100%';
       overlay.innerHTML = '<div class="overlay-text">Reserveren nog niet mogelijk</div>';
       calendar.appendChild(overlay);
     }
   }
 }

// Handle klik op datum voor selectie
function handleDateClick(date, apartment) {
  const selection = selectionState[apartment];
  
  // Als geen start datum, maak dit de start
  if (!selection.startDate) {
    selection.startDate = date;
    generateCalendarForApartment(apartment);
    updateReserveButton(apartment);
  }
  // Als start datum maar geen end, maak dit de end (moet na start zijn)
  else if (!selection.endDate) {
    if (date > selection.startDate) {
      // Check of er bezette dagen tussen start en eind zitten
      const reservations = getReservations();
      let hasBlockedDays = false;
      const checkDate = new Date(selection.startDate);
      
      while (checkDate < date) {
        if (isDateReservedForApartment(checkDate, apartment, reservations)) {
          hasBlockedDays = true;
          break;
        }
        checkDate.setDate(checkDate.getDate() + 1);
      }
      
      if (!hasBlockedDays) {
        selection.endDate = date;
        generateCalendarForApartment(apartment);
        updateReserveButton(apartment);
      } else {
        alert('Deze periode bevat bezette dagen. Selecteer een andere datum.');
      }
    } else {
      // Nieuwe start datum
      selection.startDate = date;
      selection.endDate = null;
      generateCalendarForApartment(apartment);
      updateReserveButton(apartment);
    }
  }
  // Als beide datums, reset en maak nieuwe start
  else {
    selection.startDate = date;
    selection.endDate = null;
    generateCalendarForApartment(apartment);
    updateReserveButton(apartment);
  }
}

// Update reserve button tekst en state
function updateReserveButton(apartment) {
  const btn = document.querySelector(`.btn-reserve[data-apartment="${apartment}"]`);
  const startInput = document.querySelector(`.date-input[data-apartment="${apartment}"][data-role="start"]`);
  const endInput = document.querySelector(`.date-input[data-apartment="${apartment}"][data-role="end"]`);
  
  if (!btn || !startInput || !endInput) return;
  
  const selection = selectionState[apartment];
  
  // Update inputs
  if (selection.startDate) {
    startInput.value = formatDate(selection.startDate);
  } else {
    startInput.value = '';
  }
  
  if (selection.endDate) {
    endInput.value = formatDate(selection.endDate);
  } else {
    endInput.value = '';
  }
  
  // Update button
  if (selection.startDate && selection.endDate) {
    btn.textContent = 'Reserveren';
    btn.disabled = false;
  } else {
    btn.textContent = 'Reserveren';
    btn.disabled = true;
  }
}

// Handle reserveer klik
function handleReserveClick(apartment) {
  const selection = selectionState[apartment];
  
  if (!selection.startDate || !selection.endDate) {
    alert('Selecteer eerst een start- en einddatum');
    return;
  }
  
  // Redirect naar kalender pagina met pre-filled data
  const apartmentName = apartment === 'A' ? '35' : '36';
  const start = formatDate(selection.startDate);
  const end = formatDate(selection.endDate);
  
  // Redirect naar kalender pagina met URL params of sessionStorage
  sessionStorage.setItem('pendingReservation', JSON.stringify({
    appartement: apartmentName,
    aankomst: start,
    vertrek: end
  }));
  
  window.location.href = 'kalender.html';
}

// Kalender genereren (wrapper functie)
function generateCalendar() {
  // Check of we twee kalenders hebben (home pagina) of één (kalender pagina)
  const calendarA = document.getElementById('calendar-A');
  const calendarB = document.getElementById('calendar-B');
  const singleCalendar = document.getElementById('calendar');
  
  if (calendarA && calendarB) {
    // Twee kalenders naast elkaar (home pagina)
    generateCalendarForApartment('A');
    generateCalendarForApartment('B');
    updateReserveButton('A');
    updateReserveButton('B');
    
    // Update maand header
    const monthHeader = document.getElementById('currentMonth');
    if (monthHeader) {
      monthHeader.textContent = `${maandNamen[currentMonth]} ${currentYear}`;
    }
  } else if (singleCalendar) {
    // Één kalender (kalender pagina)
    generateCalendarForApartment(null);
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
  
  // Check if current user is admin
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const userIsAdmin = user && typeof isAdmin === 'function' ? isAdmin() : false;
  
  container.innerHTML = reservations.map(res => {
    const aankomst = new Date(res.aankomst).toLocaleDateString('nl-NL');
    const vertrek = new Date(res.vertrek).toLocaleDateString('nl-NL');
    const statusBadge = res.status === 'goedgekeurd' 
      ? '<span class="status-badge approved">✓ Goedgekeurd</span>'
      : res.status === 'betaald'
      ? '<span class="status-badge paid">€ Betaald</span>'
      : '<span class="status-badge pending">⏳ In afwachting</span>';
    
    // Only show delete button for admin
    const deleteButton = userIsAdmin ? `<button class="btn-delete" onclick="handleDeleteReservation('${res.id}')">Verwijderen</button>` : '';
    
    return `
      <div class="reservation-item">
        <div class="reservation-info">
          <strong>${res.naam}</strong>
          <div class="reservation-dates">
            ${aankomst} - ${vertrek} ${res.personen ? `(${res.personen} persoon${res.personen > 1 ? 'en' : ''})` : ''}
          </div>
          ${res.opmerking ? `<div style="margin-top: 0.5em; color: #666; font-style: italic;">${res.opmerking}</div>` : ''}
          <div style="margin-top: 0.5em;">
            <span class="reservation-app">Appartement ${res.appartement}</span>
            ${statusBadge}
          </div>
        </div>
        <div class="reservation-actions">
          ${deleteButton}
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

// Update reservation form based on login status
function updateReservationForm() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const loginPrompt = document.getElementById('loginPrompt');
  const userInfo = document.getElementById('userInfo');
  const nameField = document.getElementById('naamField');
  const emailField = document.getElementById('emailField');
  const reservationForm = document.getElementById('reservationForm');
  
  if (!reservationForm) return; // Not on calendar page
  
  if (!user || !canBook()) {
    if (loginPrompt) loginPrompt.style.display = 'block';
    if (userInfo) userInfo.style.display = 'none';
    if (nameField) {
      nameField.style.display = 'block';
      nameField.querySelector('input').required = true;
    }
    if (emailField) {
      emailField.style.display = 'block';
      emailField.querySelector('input').required = true;
    }
    reservationForm.style.opacity = '0.5';
    reservationForm.style.pointerEvents = 'none';
  } else {
    if (loginPrompt) loginPrompt.style.display = 'none';
    if (userInfo) {
      userInfo.style.display = 'block';
      // Update user info display
      const userName = document.getElementById('userName');
      const userEmail = document.getElementById('userEmail');
      const userAppartment = document.getElementById('userAppartment');
      const userAankomst = document.getElementById('userAankomst');
      const userVertrek = document.getElementById('userVertrek');
      
      if (userName) userName.textContent = user.name;
      if (userEmail) userEmail.textContent = user.email;
      if (userAppartment) {
        const aptSelect = document.getElementById('appartement');
        if (aptSelect && aptSelect.value) {
          const aptName = aptSelect.selectedOptions[0].text;
          userAppartment.textContent = aptName;
        } else {
          userAppartment.textContent = '-';
        }
      }
      if (userAankomst) {
        const aankomstInput = document.getElementById('aankomst');
        if (aankomstInput && aankomstInput.value) {
          userAankomst.textContent = aankomstInput.value;
        } else {
          userAankomst.textContent = '-';
        }
      }
      if (userVertrek) {
        const vertrekInput = document.getElementById('vertrek');
        if (vertrekInput && vertrekInput.value) {
          userVertrek.textContent = vertrekInput.value;
        } else {
          userVertrek.textContent = '-';
        }
      }
    }
    if (nameField) {
      nameField.style.display = 'none';
      const input = nameField.querySelector('input');
      if (input) input.required = false;
    }
    if (emailField) {
      emailField.style.display = 'none';
      const input = emailField.querySelector('input');
      if (input) input.required = false;
    }
    reservationForm.style.opacity = '1';
    reservationForm.style.pointerEvents = 'auto';
  }
}

// Formulier verwerken
document.addEventListener('DOMContentLoaded', () => {
  // Init kalender op elke pagina waar hij bestaat (home en kalender)
  const calendarA = document.getElementById('calendar-A');
  const calendarB = document.getElementById('calendar-B');
  const singleCalendar = document.getElementById('calendar');
  
  if (calendarA || calendarB || singleCalendar) {
    generateCalendar();
  }
  
  // Reserveer knoppen event listeners
  const reserveButtons = document.querySelectorAll('.btn-reserve');
  reserveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const apartment = btn.dataset.apartment;
      handleReserveClick(apartment);
    });
  });
  
  // Date input event listeners
  const dateInputs = document.querySelectorAll('.date-input');
  const today = new Date();
  const minDate = formatDate(today);
  const maxYear = today.getFullYear() + 2;
  const maxDate = `${maxYear}-12-31`;
  
  dateInputs.forEach(input => {
    // Set min en max jaar (vanaf vandaag tot 2 jaar vooruit)
    input.setAttribute('min', minDate);
    input.setAttribute('max', maxDate);
    
    input.addEventListener('change', () => {
      const apartment = input.dataset.apartment;
      const role = input.dataset.role;
      const value = input.value;
      
      if (value) {
        const date = new Date(value);
        if (role === 'start') {
          selectionState[apartment].startDate = date;
          generateCalendarForApartment(apartment);
          updateReserveButton(apartment);
        } else if (role === 'end') {
          selectionState[apartment].endDate = date;
          generateCalendarForApartment(apartment);
          updateReserveButton(apartment);
        }
      }
    });
  });
  
  if (document.getElementById('reservationsList')) {
    displayReservations();
  }
  
  // Stel minimale datum in (vandaag) - alleen op kalender pagina
  const aankomstInput = document.getElementById('aankomst');
  if (aankomstInput) {
    const today = formatDate(new Date());
    aankomstInput.setAttribute('min', today);
    const vertrekInput = document.getElementById('vertrek');
    if (vertrekInput) {
      vertrekInput.setAttribute('min', today);
    }
  }
  
  // Update prijs bij wijziging datums of appartement - alleen op kalender pagina
  const reservationForm = document.getElementById('reservationForm');
  if (reservationForm) {
    function updatePrice() {
      const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      const appartement = document.getElementById('appartement').value;
      const aankomst = document.getElementById('aankomst').value;
      const vertrek = document.getElementById('vertrek').value;
      const priceDisplay = document.getElementById('priceDisplay');
      
      if (appartement && aankomst && vertrek && new Date(aankomst) < new Date(vertrek)) {
        const priceInfo = user ? calculatePriceWithDiscounts(appartement, aankomst, vertrek, user) : calculatePrice(appartement, aankomst, vertrek, null);
        
        // Build detailed breakdown list
        const breakdownContainer = document.getElementById('priceBreakdown');
        if (breakdownContainer && priceInfo.breakdownItems) {
          let html = priceInfo.breakdownItems.map(item => 
            `<div>${item.count}x ${item.naam} = €${(item.count * item.prijs).toFixed(2)}</div>`
          ).join('');
          
          // Add discounts if any
          if (priceInfo.discounts && priceInfo.discounts.length > 0) {
            html += '<div style="margin-top: 0.5em; color: #4CAF50;"><strong>Kortingen:</strong></div>';
            priceInfo.discounts.forEach(disc => {
              html += `<div style="color: #4CAF50;">-${disc.percentage}% ${disc.type} = -€${disc.amount.toFixed(2)}</div>`;
            });
          }
          
          // Add totals
          if (priceInfo.baseTotal !== undefined) {
            html += `<div><strong>Subtotaal: €${priceInfo.baseTotal.toFixed(2)}</strong></div>`;
          }
          html += `<div><strong>Totaal = €${priceInfo.total.toFixed(2)}</strong></div>`;
          
          breakdownContainer.innerHTML = html;
        }
        
        priceDisplay.style.display = 'block';
      } else {
        priceDisplay.style.display = 'none';
      }
    }
    
    // Update vertrek min wanneer aankomst verandert
    const aankomstInput = document.getElementById('aankomst');
    if (aankomstInput) {
      aankomstInput.addEventListener('change', (e) => {
        const aankomstDate = e.target.value;
        const vertrekInput = document.getElementById('vertrek');
        if (vertrekInput) {
          vertrekInput.setAttribute('min', aankomstDate);
          
          // Als vertrek voor aankomst is, reset vertrek
          if (vertrekInput.value && vertrekInput.value <= aankomstDate) {
            vertrekInput.value = '';
          }
        }
        
        updatePrice();
        updateReservationForm(); // Update user info display
      });
    }
    
    const vertrekInput = document.getElementById('vertrek');
    if (vertrekInput) {
      vertrekInput.addEventListener('change', () => {
        updatePrice();
        updateReservationForm(); // Update user info display
      });
    }
    
    const appartementSelect = document.getElementById('appartement');
    if (appartementSelect) {
      appartementSelect.addEventListener('change', () => {
        updatePrice();
        updateReservationForm(); // Update user info display
      });
    }
    
    // Load pending reservation from sessionStorage
    const pendingReservation = sessionStorage.getItem('pendingReservation');
    if (pendingReservation) {
      try {
        const data = JSON.parse(pendingReservation);
        const appartement = document.getElementById('appartement');
        const aankomstInput = document.getElementById('aankomst');
        const vertrekInput = document.getElementById('vertrek');
        
        if (appartement && aankomstInput && vertrekInput) {
          // Map appartement nummer naar letter
          const apartmentMap = { '35': 'A', '36': 'B' };
          const aptLetter = apartmentMap[data.appartement] || 'A';
          
          appartement.value = aptLetter;
          if (data.aankomst) aankomstInput.value = data.aankomst;
          if (data.vertrek) vertrekInput.value = data.vertrek;
          
          // Clear session storage
          sessionStorage.removeItem('pendingReservation');
          
          // Trigger price calculation and update form
          updatePrice();
          updateReservationForm();
        }
      } catch (e) {
        console.error('Error loading pending reservation:', e);
      }
    }
    
    // Initial update of reservation form
    updateReservationForm();
    
    // Re-check after auth loads
    setTimeout(updateReservationForm, 100);
  }
  
  // Formulier submit - alleen op kalender pagina
  if (reservationForm) {
    reservationForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    // Check authentication
    if (typeof requireBookingAccess === 'function' && !requireBookingAccess()) {
      return;
    }
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const appartement = document.getElementById('appartement').value;
    const naam = user ? user.name : document.getElementById('naam').value;
    const email = user ? user.email : document.getElementById('email').value;
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
    
    // Check voorseizoen constraint
    if (user) {
      const preseasonCheck = checkPreseasonConstraint(aankomst, user, appartement);
      if (!preseasonCheck.valid) {
        alert(preseasonCheck.message);
        return;
      }
    }
    
    // Check overlap
    if (hasOverlap(appartement, aankomst, vertrek)) {
      alert(`Appartement ${appartement} is al gereserveerd in deze periode!`);
      return;
    }
    
    // Bereken prijs met kortingen
    const priceInfo = user ? calculatePriceWithDiscounts(appartement, aankomst, vertrek, user) : calculatePrice(appartement, aankomst, vertrek, null);
    
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
      status: 'in_afwachting',
      userId: user ? user.id : null,
      createdBy: user ? user.name : naam
    };
    
    const newReservation = addReservation(reservation);
    
    // Maak transactie aan
    if (typeof addTransaction === 'function') {
      addTransaction({
        type: 'reservation',
        reservationId: newReservation.id,
        userName: naam,
        amount: -priceInfo.total, // Negatief omdat het een betaling is
        description: `Reservering Appartement ${appartement}: ${aankomst} - ${vertrek}`,
        status: 'pending'
      });
    }
    
    displayReservations();
    generateCalendar();
    
      // Formulier resetten
      reservationForm.reset();
      const today = formatDate(new Date());
      const aankomstInput = document.getElementById('aankomst');
      const vertrekInput = document.getElementById('vertrek');
      if (aankomstInput) aankomstInput.setAttribute('min', today);
      if (vertrekInput) vertrekInput.setAttribute('min', today);
      
      alert('Reservering succesvol toegevoegd!');
    });
  }
  
  // Kalender navigatie - op home en kalender pagina
  const prevMonthBtn = document.getElementById('prevMonth');
  const nextMonthBtn = document.getElementById('nextMonth');
  
  if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      generateCalendar();
    });
  }
  
  if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      generateCalendar();
    });
  }
  
  // Navigatie werkt nu met echte pagina's, geen smooth scroll nodig
  
  // Foto galerij functionaliteit - alleen op fotos pagina
  if (document.querySelector('.gallery-tabs')) {
    initGallery();
  }
  
  // Familieberichten functionaliteit - op berichten pagina en home pagina
  if (document.getElementById('messageForm')) {
    initMessages();
    // Re-check after auth loads
    setTimeout(() => {
      updateMessageForm();
    }, 100);
  }
});

// Menu toggle functie
function toggleMenu() {
  const menu = document.getElementById('mainNav');
  const toggle = document.getElementById('menuToggle');
  
  if (menu && toggle) {
    menu.classList.toggle('active');
    toggle.classList.toggle('active');
  }
}

// Sluit menu als je buiten klikt
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mainNav');
  const toggle = document.getElementById('menuToggle');
  
  if (menu && toggle && menu.classList.contains('active')) {
    if (!menu.contains(e.target) && !toggle.contains(e.target)) {
      menu.classList.remove('active');
      toggle.classList.remove('active');
    }
  }
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

// Update message form based on login status
function updateMessageForm() {
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const loginPrompt = document.getElementById('messageLoginPrompt');
  const userInfo = document.getElementById('messageUserInfo');
  const currentUserInfo = document.getElementById('messageCurrentUserInfo');
  const messageForm = document.getElementById('messageForm');
  
  if (!messageForm) return; // Not on page with messages
  
  if (!user || !isLoggedIn()) {
    // Not logged in - only show login prompt, hide form
    if (loginPrompt) loginPrompt.style.display = 'block';
    messageForm.style.display = 'none';
  } else {
    // Logged in - show form with user info
    if (loginPrompt) loginPrompt.style.display = 'none';
    messageForm.style.display = 'block';
    if (userInfo && currentUserInfo) {
      currentUserInfo.innerHTML = `<strong>${user.name}</strong> (${user.email})`;
    }
  }
}

// Familieberichten
function initMessages() {
  displayMessages();
  updateMessageForm();
  
  const messageForm = document.getElementById('messageForm');
  if (messageForm) {
    messageForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      // Check if logged in - required
      const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      if (!user || !isLoggedIn()) {
        alert('Je moet ingelogd zijn om berichten te plaatsen');
        return;
      }
      
      const author = user.name; // Always use logged in user's name
      const text = document.getElementById('messageText').value;
      
      if (text) {
        addMessage(author, text, user.id);
        displayMessages();
        messageForm.reset();
        updateMessageForm(); // Re-update form
      }
    });
  }
}

function displayMessages() {
  const container = document.getElementById('messagesList');
  const messages = getMessages();
  
  if (messages.length === 0) {
    container.innerHTML = '<div class="empty-state">Nog geen berichten geplaatst</div>';
    return;
  }
  
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const userIsAdmin = user && typeof isAdmin === 'function' ? isAdmin() : false;
  
  container.innerHTML = messages.map(msg => {
    const date = new Date(msg.date).toLocaleDateString('nl-NL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Toon verwijder knop als eigenaar of admin
    const canDelete = user && (msg.userId === user.id || userIsAdmin);
    const deleteButton = canDelete 
      ? `<button class="delete-message-btn" data-message-id="${msg.id}" title="Verwijderen">×</button>` 
      : '';
    
    return `
      <div class="message-item">
        <div class="message-header">
          <span class="message-author">${msg.author}</span>
          <span class="message-date">${date}</span>
          ${deleteButton}
        </div>
        <div class="message-text">${msg.text}</div>
      </div>
    `;
  }).join('');
  
  // Voeg event listeners toe aan delete knoppen
  setTimeout(() => {
    const deleteButtons = container.querySelectorAll('.delete-message-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', function() {
        const messageId = this.dataset.messageId;
        deleteMessage(messageId);
        displayMessages();
      });
    });
  }, 0);
}
