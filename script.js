// Reserveringssysteem voor Familie Sant Antoni

// Data opslag (localStorage)
const STORAGE_KEY = 'santantoni_reservations';
const MESSAGES_KEY = 'santantoni_messages';

// Get current date (with override if set) - gebruikt admin override voor testen
function getCurrentDate() {
  const overrideDate = localStorage.getItem('dateOverride');
  if (overrideDate) {
    return new Date(overrideDate);
  }
  return new Date();
}

// NIEUWE Prijsconfiguratie per appartement, familie en seizoen
// Zomer = Juli en Augustus (maanden 6 en 7)
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
  // 0=jan, 1=feb, etc. Zomer is juli en augustus (6 en 7)
  if (maand === 6 || maand === 7) return 'zomer';  // Juli en Augustus
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
  
  // Ensure apartement is a string (not an HTML element)
  if (apartement && typeof apartement !== 'string') {
    // If it's an HTML element, try to get .value
    if (apartement.value !== undefined) {
      apartement = apartement.value;
    } else {
      console.error('calculatePrice: apartement is not a string:', apartement);
      return { total: 0, breakdown: '', breakdownItems: [] };
    }
  }
  
  if (!apartement || apartement === '') {
    console.error('calculatePrice: apartement is empty or null');
    return { total: 0, breakdown: '', breakdownItems: [] };
  }
  
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const nights = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  
  // Familie bepalen: gebruik user.family, anders default naar 'C' (geen familie)
  const family = user && user.family ? user.family : 'C';
  
  // Converteer A->35, B->36 voor oude code compatibiliteit
  const appartementId = apartement === 'A' ? '35' : (apartement === 'B' ? '36' : apartement);
  
  // Check of appartementnummer correct is
  if (!PRIJZEN[appartementId] || !PRIJZEN[appartementId][family]) {
    console.error(`Geen prijs configuratie voor App ${appartementId} (van '${apartement}'), Familie ${family}`);
    console.error('Available appartements:', Object.keys(PRIJZEN));
    console.error('Available families for App', appartementId, ':', PRIJZEN[appartementId] ? Object.keys(PRIJZEN[appartementId]) : 'none');
    return { total: 0, breakdown: '', breakdownItems: [] };
  }
  
  const appPricing = PRIJZEN[appartementId][family];
  
  console.log('Price calculation:', {
    apartement,
    appartementId,
    family,
    appPricing,
    start: aankomst,
    end: vertrek
  });
  
  let total = 0;
  const breakdown = [];
  const currentDate = new Date(start);
  
  while (currentDate < end) {
    const maand = currentDate.getMonth();
    const seizoen = getSeizoen(maand);
    const prijsPerNacht = appPricing[seizoen];
    
    // Check of prijs valid is
    if (!prijsPerNacht || isNaN(prijsPerNacht) || prijsPerNacht <= 0) {
      console.error(`Invalid price for App ${appartementId}, Familie ${family}, Seizoen ${seizoen}:`, prijsPerNacht);
      console.error('Available pricing:', appPricing);
      // Skip deze dag of return error
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Only log first few days to avoid console spam
    if (breakdown.length < 3) {
      console.log(`Date: ${currentDate.toLocaleDateString()}, Month: ${maand}, Seizoen: ${seizoen}, Prijs: €${prijsPerNacht}`);
    }
    
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
  
  // Check of we data hebben
  if (breakdown.length === 0) {
    console.error('No breakdown items generated! Check dates and pricing.');
    return { total: 0, breakdown: '', breakdownItems: [] };
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
  const namen = { laag: 'Laagseizoen', zomer: 'Hoogseizoen' };
  return namen[seizoen] || seizoen;
}

// Check seizoensregels (alleen juli-augustus: alleen hele weken zaterdag-zaterdag, max 2 weken)
// BELANGRIJK: Deze regel geldt voor ALLES (inclusief admin) - niemand mag halve weken in hoogseizoen
function checkSeizoenRules(aankomst, vertrek, user = null) {
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const maand = start.getMonth();
  
  // Alleen juli en augustus (6 en 7)
  if (maand === 6 || maand === 7) {
    const dayOfWeek = start.getDay(); // 0=zondag, 6=zaterdag
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    // Moet zaterdag zijn (6) en minimaal 7 dagen - GELDT VOOR ALLES (zelfs admin)
    if (dayOfWeek !== 6) {
      return { valid: false, message: 'In juli en augustus mag je alleen vanaf zaterdag reserveren.' };
    }
    if (days < 7 || days % 7 !== 0) {
      return { valid: false, message: 'In juli en augustus zijn alleen hele weken (zaterdag-zaterdag) mogelijk.' };
    }
    // Check maximaal 2 weken in juli-augustus
    if (days > 14) {
      return { valid: false, message: 'In juli en augustus mag je maximaal 2 weken boeken. Je probeert ' + Math.ceil(days / 7) + ' weken te boeken.' };
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

// Helper: check of reservering valt in voorkeursmaanden (juni-september)
function isDateInPreferredMonths(aankomst, vertrek) {
  const start = new Date(aankomst);
  const end = new Date(vertrek);
  const checkDate = new Date(start);
  
  while (checkDate < end) {
    const month = checkDate.getMonth();
    if (month >= 5 && month <= 8) { // Juni-september
      return true;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  
  return false;
}

// Check voorseizoen constraint (1 jan - 31 mrt: iedereen kan intenties indienen)
// In prioriteitsperiode mag je maximaal 2 weken boeken in voorkeursmaanden (juni-september)
// Iedereen kan intenties indienen, maar op 1 februari maakt de eigenaar de definitieve keuze
function checkPreseasonConstraint(aankomst, vertrek, user, apartement) {
  // Admin kan altijd reserveren zonder beperkingen
  if (user && user.role === 'admin') {
    return { valid: true };
  }
  
  const today = getCurrentDate(); // Gebruik override datum indien ingesteld
  const reservationStart = new Date(aankomst);
  const reservationEnd = new Date(vertrek);
  const year = reservationStart.getFullYear();
  
  // Check of reservering (gedeeltelijk) in voorkeursmaanden valt (juni-september = maanden 5-8)
  let daysInSummerMonths = 0;
  const checkDate = new Date(reservationStart);
  
  while (checkDate < reservationEnd) {
    const month = checkDate.getMonth();
    if (month >= 5 && month <= 8) { // Juni-september
      daysInSummerMonths++;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  
  // Als reservering valt in voorkeursmaanden (juni-september)
  if (daysInSummerMonths > 0) {
    const todayYear = today.getFullYear();
    const reservationYear = year;
    const todayMonth = today.getMonth(); // 0 = januari, 3 = april
    
    // Check of het reserveringsjaar hetzelfde is als het huidige jaar
    if (reservationYear === todayYear) {
      // Tijdens prioriteitsperiode (jan-maart = maanden 0-2)
      // IEDEREEN kan nu intenties indienen - geen beperkingen meer op wie kan reserveren
      if (todayMonth >= 0 && todayMonth < 3) {
        // Check maximum duur: 2 weken (14 dagen) in voorkeursmaanden tijdens prioriteitsperiode
        if (daysInSummerMonths > 14) {
          return { valid: false, message: `Tijdens de prioriteitsperiode (januari-maart) mag je maximaal 2 weken (14 dagen) boeken in de voorkeursmaanden (juni-september). Je reservering bevat ${daysInSummerMonths} dagen in deze maanden.` };
        }
        // Iedereen kan reserveren - dit wordt een intentie
        return { valid: true, isIntention: true };
      }
      // Vanaf april (maand 3 en later): alles is open, geen checks meer nodig
    } else if (reservationYear > todayYear) {
      // Toekomstig jaar: nog niet 1 januari van dat jaar
      const jan1ReservationYear = new Date(reservationYear, 0, 1);
      if (today < jan1ReservationYear) {
        // Nog niet 1 januari van reserveringsjaar - NIEMAND mag reserveren voor voorkeursmaanden
        return { valid: false, message: 'Je kunt nog niet reserveren voor dit jaar. Wacht tot 1 januari.' };
      } else {
        // We zijn al in het reserveringsjaar (1 januari of later)
        // Check of we IN de prioriteitsperiode zijn (jan-maart)
        if (todayMonth >= 0 && todayMonth < 3) {
          // Tijdens prioriteitsperiode: iedereen kan intenties indienen
          if (daysInSummerMonths > 14) {
            return { valid: false, message: `Tijdens de prioriteitsperiode (januari-maart) mag je maximaal 2 weken (14 dagen) boeken in de voorkeursmaanden (juni-september). Je reservering bevat ${daysInSummerMonths} dagen in deze maanden.` };
          }
          // Iedereen kan reserveren - dit wordt een intentie
          return { valid: true, isIntention: true };
        }
        // Na april: alles is open, geen checks meer nodig
      }
    }
  }
  
  return { valid: true };
}

// Bepaal totaalprijs met kortingen
function calculatePriceWithDiscounts(apartement, aankomst, vertrek, user) {
  if (!user) {
    console.error('calculatePriceWithDiscounts: user is null/undefined');
    return calculatePrice(apartement, aankomst, vertrek, null);
  }
  
  const basePrice = calculatePrice(apartement, aankomst, vertrek, user);
  
  // Check if basePrice is valid
  if (!basePrice || basePrice.total === 0) {
    console.error('calculatePriceWithDiscounts: basePrice is invalid:', basePrice);
    return basePrice || { total: 0, breakdown: '', breakdownItems: [] };
  }
  
  let discounts = [];
  let discountAmount = 0;
  
  // Beheerderskorting: admin krijgt 100% korting
  if (user.role === 'admin') {
    discountAmount = basePrice.total;
    discounts.push({ type: 'beheerder', amount: discountAmount, percentage: 100 });
    return { 
      total: 0, 
      discounts, 
      breakdownItems: basePrice.breakdownItems || [],
      baseTotal: basePrice.total
    };
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
  // Normalize dates to midnight (ignore time component) for accurate day comparison
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  return reservations.some(res => {
    if (res.appartement !== apartment) return false;
    const start = new Date(res.aankomst);
    start.setHours(0, 0, 0, 0);
    const end = new Date(res.vertrek);
    end.setHours(0, 0, 0, 0);
    
    // Begindatum + alle dagen ertussen, maar einddatum is vertrekdag (niet gereserveerd voor overnachting)
    // checkDate >= start: begindatum wordt meegenomen
    // checkDate < end: einddatum wordt NIET meegenomen (dat is vertrekdag)
    return checkDate >= start && checkDate < end;
  });
}

function getReservationsForDate(date, reservations) {
  // Normalize dates to midnight (ignore time component) for accurate day comparison
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  return reservations.filter(res => {
    const start = new Date(res.aankomst);
    start.setHours(0, 0, 0, 0);
    const end = new Date(res.vertrek);
    end.setHours(0, 0, 0, 0);
    
    // Begindatum + alle dagen ertussen, maar einddatum is vertrekdag (niet gereserveerd voor overnachting)
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
    
    // Check of dit hoogseizoen is (juli-augustus) en of het een zaterdag is
    const isInHighSeason = isHighSeason(date);
    const isSaturday = date.getDay() === 6; // 6 = zaterdag
    if (isInHighSeason && isSaturday && isCurrentMonth) {
      dayDiv.classList.add('high-season-saturday');
      dayDiv.title = 'Zaterdag - Start van boekbare week in hoogseizoen';
    }
    
    // Check reserveringen - filter per appartement als specifiek appartement is geselecteerd
    let dateReservations = getReservationsForDate(date, reservations);
    let isReserved = false;
    let isApproved = false; // Geaccepteerd (goedgekeurd of betaald)
    
    if (apartment) {
      // Alleen reserveringen voor dit specifieke appartement
      dateReservations = dateReservations.filter(r => r.appartement === apartment);
      isReserved = isDateReservedForApartment(date, apartment, reservations);
      
      // Check if any reservation for this date is approved (goedgekeurd or betaald)
      const apartmentReservations = dateReservations.filter(r => r.appartement === apartment);
      isApproved = apartmentReservations.some(r => r.status === 'goedgekeurd' || r.status === 'betaald');
      
      // Check if any reservation is pending cancellation
      const hasPendingCancellation = apartmentReservations.some(r => r.status === 'pending_cancellation');
      
      // Check if any reservation is an intention
      const hasIntention = apartmentReservations.some(r => r.isIntention === true);
      
      if (isReserved) {
        dayDiv.classList.add(`reserved-${apartment}`);
        if (hasIntention) {
          dayDiv.classList.add('reserved-intention'); // Lichter dan pending - intentie
        } else if (hasPendingCancellation) {
          dayDiv.classList.add('reserved-pending'); // Pending cancellation treated as pending
        } else if (isApproved) {
          dayDiv.classList.add('reserved-approved');
        } else {
          dayDiv.classList.add('reserved-pending');
        }
      }
    } else {
      // Originele logica voor single calendar
      const reservedA = isDateReservedForApartment(date, 'A', reservations);
      const reservedB = isDateReservedForApartment(date, 'B', reservations);
      
      // Check if any reservation for this date is approved
      const allDateReservations = dateReservations;
      isApproved = allDateReservations.some(r => r.status === 'goedgekeurd' || r.status === 'betaald');
      
      // Check if any reservation is pending cancellation
      const hasPendingCancellation = allDateReservations.some(r => r.status === 'pending_cancellation');
      
      // Check if any reservation is an intention
      const hasIntention = allDateReservations.some(r => r.isIntention === true);
      
      if (reservedA && reservedB) {
        dayDiv.classList.add('reserved');
        if (hasIntention) {
          dayDiv.classList.add('reserved-intention');
        } else if (hasPendingCancellation) {
          dayDiv.classList.add('reserved-pending'); // Pending cancellation treated as pending
        } else if (isApproved) {
          dayDiv.classList.add('reserved-approved');
        } else {
          dayDiv.classList.add('reserved-pending');
        }
      } else if (reservedA) {
        dayDiv.classList.add('reserved-A');
        if (hasIntention) {
          dayDiv.classList.add('reserved-intention');
        } else if (hasPendingCancellation) {
          dayDiv.classList.add('reserved-pending'); // Pending cancellation treated as pending
        } else if (isApproved) {
          dayDiv.classList.add('reserved-approved');
        } else {
          dayDiv.classList.add('reserved-pending');
        }
      } else if (reservedB) {
        dayDiv.classList.add('reserved-B');
        if (hasIntention) {
          dayDiv.classList.add('reserved-intention');
        } else if (hasPendingCancellation) {
          dayDiv.classList.add('reserved-pending'); // Pending cancellation treated as pending
        } else if (isApproved) {
          dayDiv.classList.add('reserved-approved');
        } else {
          dayDiv.classList.add('reserved-pending');
        }
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
        // Check of dit hoogseizoen is (juli-augustus)
        const isInHighSeason = isHighSeason(date);
        const isSaturday = date.getDay() === 6; // 6 = zaterdag
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const isAdmin = user && user.role === 'admin';
        
        // Check of dit een voorkeursmaand is (juni-september = maanden 5-8) die nog niet geboekt mag worden
        // ALLEEN voorkeursmaanden blokkeren, niet andere maanden!
        const dateMonth = date.getMonth();
        const isPreferredMonth = dateMonth >= 5 && dateMonth <= 8; // Juni-september alleen!
        const dateYear = date.getFullYear();
        const jan1DateYear = new Date(dateYear, 0, 1);
        const today = getCurrentDate(); // Gebruik override datum indien ingesteld
        
        let isBlockedByPriorityRule = false;
        // ALLEEN checken als het een voorkeursmaand is!
        if (isPreferredMonth && !isAdmin) {
          const todayYear = today.getFullYear();
          const todayMonth = today.getMonth(); // 0 = januari, 3 = april
          
          // Als we kijken naar hetzelfde jaar
          if (dateYear === todayYear) {
            // Tijdens prioriteitsperiode (jan-maart = maanden 0-2)
            // IEDEREEN kan nu intenties indienen - geen blokkering meer
            // Alleen checken of we nog niet in het jaar zijn
            if (todayMonth >= 0 && todayMonth < 3) {
              // Tijdens prioriteitsperiode: iedereen kan intenties indienen
              // Geen blokkering - isBlockedByPriorityRule blijft false
            }
            // Vanaf april (maand 3 en later): niet blokkeren, alles is open
          } else if (dateYear > todayYear) {
            // Toekomstig jaar: nog niet 1 januari van dat jaar = NIEMAND kan reserveren
            const jan1DateYear = new Date(dateYear, 0, 1);
            if (today < jan1DateYear) {
              // Nog niet 1 januari van reserveringsjaar - blokkeer voor iedereen
              isBlockedByPriorityRule = true;
            }
            // Als we al in het reserveringsjaar zijn, kan iedereen intenties indienen
          }
        }
        
        // In hoogseizoen: alleen zaterdagen klikbaar (GELDT VOOR ALLES, inclusief admin)
        if (isInHighSeason && !isSaturday) {
          // Geen clickable class toevoegen - niet klikbaar
          dayDiv.title = 'In juli en augustus kun je alleen vanaf zaterdag boeken';
          dayDiv.style.cursor = 'not-allowed';
          dayDiv.style.opacity = '0.6';
          // Geen hover events voor niet-klikbare dagen
        } else if (isBlockedByPriorityRule) {
          // Geblokkeerd door prioriteitsregel - niet klikbaar
          dayDiv.title = 'Reserveren nog niet mogelijk';
          dayDiv.style.cursor = 'not-allowed';
          dayDiv.style.opacity = '0.6';
          dayDiv.classList.add('disabled-booking');
          // Geen hover events voor niet-klikbare dagen
        } else {
          // Normaal klikbaar - maar check of dit een geldige selectie is
          // Als er al een startdatum is in hoogseizoen, einddatum moet ook zaterdag zijn
          const selection = selectionState[apartment];
          const hasStartInHighSeason = selection.startDate && isHighSeason(new Date(selection.startDate));
          
          if (hasStartInHighSeason && !isSaturday) {
            // Er is een start in hoogseizoen maar dit is geen zaterdag - niet klikbaar als eind
            dayDiv.title = 'In juli en augustus mag je alleen hele weken boeken. Selecteer een zaterdag als einddatum.';
            dayDiv.style.cursor = 'not-allowed';
            dayDiv.style.opacity = '0.6';
            // Geen hover events voor niet-klikbare dagen
          } else {
            // Normaal klikbaar
            dayDiv.classList.add('clickable');
            dayDiv.style.cursor = 'pointer';
            dayDiv.dataset.date = dateStr;
            dayDiv.addEventListener('click', () => handleDateClick(date, apartment));
            
            // Hover effect (alleen voor klikbare dagen)
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
                  
                  // Loop door alle calendar dagen en pas hover styling toe
                  calendarDays.forEach(dayEl => {
                    const dayDateStr = dayEl.dataset.date;
                    if (dayDateStr) {
                      const dayDate = new Date(dayDateStr);
                      
                      // Startdatum: blijf altijd blauw, voeg hover-day toe voor highlight
                      if (dayDateStr === startDateStr) {
                        dayEl.classList.add('hover-day'); // Voor highlight, selected-start blijft blauw
                        return; // Skip verdere styling voor startdatum
                      }
                      
                      // Als deze dag de hoverende dag is (niet de startdatum)
                      if (dayDateStr === hoverDateStr) {
                        // Hover over andere dag: hover-day toevoegen met rechter hoeken
                        dayEl.classList.add('hover-day');
                        dayEl.classList.add('hover-end');
                      }
                      
                      // Als deze dag tussen start en hover zit
                      if (hoverDate > startDate && dayDate > startDate && dayDate < hoverDate) {
                        // Als er bezette dagen zijn, maak alles rood
                        if (hasBlockedDays) {
                          dayEl.classList.add('hover-range-blocked');
                        } else {
                          dayEl.classList.add('hover-range');
                        }
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
   // Overlay wordt alleen getoond als de huidige maand (currentMonth) een voorkeursmaand is die geblokkeerd moet worden
   if (apartment) {
     const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
     const today = getCurrentDate(); // Gebruik override datum indien ingesteld
     const todayYear = today.getFullYear();
     
     // Admin kan altijd reserveren - geen overlay
     const isAdmin = user && user.role === 'admin';
     
     // Check of de huidige maand (currentMonth) een voorkeursmaand is (juni-september = maanden 5-8)
     const isCurrentMonthPreferred = currentMonth >= 5 && currentMonth <= 8;
     
     let shouldShowOverlay = false;
     
     // Overlay alleen voor voorkeursmaanden (juni-september = maanden 5-8)
     if (isCurrentMonthPreferred && !isAdmin) {
       const todayMonth = today.getMonth(); // 0 = januari, 3 = april
       
       // Als we kijken naar hetzelfde jaar
       if (currentYear === todayYear) {
         // Tijdens prioriteitsperiode (jan-maart = maanden 0-2)
         // IEDEREEN kan nu intenties indienen - geen overlay meer
         // shouldShowOverlay blijft false
         if (todayMonth >= 0 && todayMonth < 3) {
           // Geen overlay - iedereen kan intenties indienen
           shouldShowOverlay = false;
         }
         // Vanaf april (maand 3 en later): geen overlay, alles is open
       } else if (currentYear > todayYear) {
         // Toekomstig jaar: nog niet 1 januari van dat jaar = NIEMAND kan reserveren
         const jan1CurrentYear = new Date(currentYear, 0, 1);
         if (today < jan1CurrentYear) {
           // Nog niet 1 januari van reserveringsjaar - overlay voor iedereen
           shouldShowOverlay = true;
         } else {
           // We zijn al in het reserveringsjaar (1 januari of later)
           // Check of we IN de prioriteitsperiode zijn (jan-maart)
           if (todayMonth >= 0 && todayMonth < 3) {
             // IEDEREEN kan nu intenties indienen - geen overlay meer
             shouldShowOverlay = false;
           }
           // Na april: geen overlay, alles is open
         }
       }
     }
     
     if (shouldShowOverlay) {
       calendar.style.position = 'relative';
       
       // Verwijder oude overlay als die bestaat
       const existingOverlay = calendar.querySelector('.booking-overlay');
       if (existingOverlay) {
         existingOverlay.remove();
       }
       
       const overlay = document.createElement('div');
       overlay.className = 'booking-overlay';
       overlay.style.position = 'absolute';
       overlay.style.top = '0';
       overlay.style.left = '0';
       overlay.style.width = '100%';
       overlay.style.height = '100%';
       overlay.innerHTML = '<div class="overlay-text">Reserveren nog niet mogelijk</div>';
       calendar.appendChild(overlay);
     } else {
       // Verwijder overlay als deze niet meer nodig is
       const existingOverlay = calendar.querySelector('.booking-overlay');
       if (existingOverlay) {
         existingOverlay.remove();
       }
     }
   }
 }

// Helper: vind de zaterdag van de week waarin deze datum valt
function findSaturdayOfWeek(date) {
  const d = new Date(date);
  const dayOfWeek = d.getDay(); // 0=zondag, 6=zaterdag
  // Ga terug naar zaterdag van deze week
  // Als dag = zaterdag (6), blijf op deze dag
  // Anders: ga terug naar vorige zaterdag
  if (dayOfWeek === 6) {
    // Al zaterdag, blijf op deze dag
    return d;
  } else if (dayOfWeek === 0) {
    // Zondag, ga 1 dag terug naar zaterdag
    d.setDate(d.getDate() - 1);
  } else {
    // Maandag (1) t/m vrijdag (5), ga terug naar vorige zaterdag
    d.setDate(d.getDate() - (dayOfWeek + 1)); // +1 omdat zondag=0 maar we naar zaterdag gaan
  }
  return d;
}

// Helper: check of een datum in hoogseizoen valt (alleen juli en augustus)
function isHighSeason(date) {
  const month = date.getMonth(); // 0=januari, 6=juli, 7=augustus
  return month === 6 || month === 7; // Alleen juli en augustus
}

// Handle klik op datum voor selectie
function handleDateClick(date, apartment) {
  const selection = selectionState[apartment];
  
  // Check of gebruiker admin is
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const isAdmin = user && user.role === 'admin';
  
  // Als geen start datum, maak dit de start
  if (!selection.startDate) {
    // Extra check: in hoogseizoen (juli-augustus) alleen zaterdagen klikbaar (GELDT VOOR ALLES, inclusief admin)
    const isInHighSeason = isHighSeason(date);
    const isSaturday = date.getDay() === 6; // 6 = zaterdag
    
    if (isInHighSeason && !isSaturday) {
      // Niet zaterdag in hoogseizoen - blokkeer klik (ook voor admin)
      alert('In juli en augustus kun je alleen vanaf zaterdag boeken. Selecteer een zaterdag als startdatum.');
      return; // Stop hier, voer geen selectie uit
    }
    
    // In hoogseizoen EN het is een zaterdag: alleen de zaterdag selecteren als start (geen automatische week)
    // User kan dan zelf kiezen hoeveel weken (1 of 2) door op een andere zaterdag te klikken
    selection.startDate = date;
    generateCalendarForApartment(apartment);
    updateReserveButton(apartment);
  }
  // Als start datum maar geen end, maak dit de end (moet na start zijn)
  else if (!selection.endDate) {
    if (date > selection.startDate) {
      // In hoogseizoen: einddatum moet ook een zaterdag zijn (hele weken)
      const isInHighSeason = isHighSeason(date);
      const isSaturday = date.getDay() === 6; // 6 = zaterdag
      
      // Check of het maximaal 2 weken is in juli-augustus
      if (isInHighSeason && isSaturday) {
        const nights = Math.ceil((date - selection.startDate) / (1000 * 60 * 60 * 24));
        if (nights > 14) {
          alert('In juli en augustus mag je maximaal 2 weken boeken. Je probeert ' + Math.ceil(nights / 7) + ' weken te boeken.');
          return;
        }
      }
      
      if (isInHighSeason && !isSaturday) {
        // Niet zaterdag als einddatum in hoogseizoen - blokkeer
        alert('In juli en augustus mag je alleen hele weken boeken. Selecteer een zaterdag als einddatum.');
        return; // Stop hier, voer geen selectie uit
      }
      
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
        // Check of deze periode in voorkeursmaanden valt en of er intenties zijn
        const isInPreferredMonths = isDateInPreferredMonths(formatDate(selection.startDate), formatDate(date));
        if (isInPreferredMonths) {
          const overlappingIntentions = getOverlappingIntentions(apartment, selection.startDate, date);
          if (overlappingIntentions.length > 0) {
            // Toon modal met intenties
            showIntentionsModal(apartment, selection.startDate, date, overlappingIntentions, () => {
              // Callback: gebruiker heeft modal gezien, ga door met selectie
              selection.endDate = date;
              generateCalendarForApartment(apartment);
              updateReserveButton(apartment);
            });
            return; // Wacht op modal bevestiging
          }
        }
        
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

// Get overlapping intentions for a period
function getOverlappingIntentions(apartment, startDate, endDate) {
  const reservations = getReservations();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return reservations.filter(res => {
    if (!res.isIntention) return false;
    if (res.appartement !== apartment) return false;
    if (res.status === 'approved') return false; // Alleen niet-goedgekeurde intenties
    
    const resStart = new Date(res.aankomst);
    const resEnd = new Date(res.vertrek);
    
    // Check overlap
    return start < resEnd && end > resStart;
  });
}

// Show modal with intentions for selected period
function showIntentionsModal(apartment, startDate, endDate, intentions, onContinue) {
  const users = typeof getUsers === 'function' ? getUsers() : [];
  const currentUser = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  const currentUserScore = currentUser ? (currentUser.score !== undefined && currentUser.score !== null ? currentUser.score : 0) : 0;
  
  // Determine priority family for this period
  const reservationStart = new Date(startDate);
  const year = reservationStart.getFullYear();
  let firstSummerMonth = null;
  const checkStartDate = new Date(reservationStart);
  while (checkStartDate < new Date(endDate) && !firstSummerMonth) {
    const month = checkStartDate.getMonth();
    if (month >= 5 && month <= 8) {
      firstSummerMonth = month;
      break;
    }
    checkStartDate.setDate(checkStartDate.getDate() + 1);
  }
  
  const apartmentNum = apartment === 'A' ? '35' : (apartment === 'B' ? '36' : apartment);
  const priorityFamily = firstSummerMonth !== null ? getPriorityFamilyForMonth(firstSummerMonth, year, apartmentNum) : null;
  
  // Sort intentions by score (highest first), then by priority family
  const sortedIntentions = intentions.map(int => {
    const user = users.find(u => u.id === int.userId || u.email === int.email);
    const userScore = user ? (user.score !== undefined && user.score !== null ? user.score : 0) : 0;
    const userFamily = user ? user.family : (int.family || null);
    const hasPriority = userFamily === priorityFamily;
    
    return {
      ...int,
      user,
      userScore,
      userFamily,
      hasPriority
    };
  }).sort((a, b) => {
    // First by score (highest first)
    if (a.userScore !== b.userScore) {
      return b.userScore - a.userScore;
    }
    // Then by priority family
    if (a.hasPriority && !b.hasPriority) return -1;
    if (!a.hasPriority && b.hasPriority) return 1;
    return 0;
  });
  
  // Determine if current user has priority (only based on family, not score)
  const currentUserHasPriority = currentUser && currentUser.family === priorityFamily;
  const isAdmin = currentUser && currentUser.role === 'admin';
  
  // Check if any other intention has family priority over current user
  const hasOtherFamilyPriority = sortedIntentions.some(int => {
    const isOwnIntention = currentUser && int.userId === currentUser.id;
    if (isOwnIntention) return false;
    return int.hasPriority && !currentUserHasPriority;
  });
  
  const apartmentName = apartment === 'A' || apartment === '35' ? '35' : '36';
  const priorityFamilyName = priorityFamily === 'A' ? 'Familie A (Pieters-Louasson)' : priorityFamily === 'B' ? 'Familie B (Broeders)' : 'Geen voorrang';
  
  let html = `
    <div id="intentionsModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;">
      <div style="background: white; padding: 2em; border-radius: 8px; max-width: 600px; max-height: 80vh; overflow-y: auto; margin: 1em;">
        <h2 style="margin-top: 0;">Intenties voor deze periode</h2>
        <p style="color: #666; margin-bottom: 1.5em;">
          Appartement ${apartmentName}: ${new Date(startDate).toLocaleDateString('nl-NL')} - ${new Date(endDate).toLocaleDateString('nl-NL')}
        </p>
        
        ${priorityFamily ? `
          <div style="padding: 1em; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px; margin-bottom: 1.5em;">
            <strong>Voorrangsperiode:</strong> ${priorityFamilyName}
          </div>
        ` : ''}
        
        ${currentUser ? `
          <div style="padding: 1em; background: ${currentUserHasPriority ? '#e8f5e9' : '#fff3cd'}; border-left: 4px solid ${currentUserHasPriority ? '#4caf50' : '#ffc107'}; border-radius: 4px; margin-bottom: 1.5em;">
            <strong>Jouw intentie:</strong>
            <div style="margin-top: 0.5em;">
              ${currentUserHasPriority ? 
                '<span style="color: #4caf50; font-weight: bold;">✓ Dit is jouw voorrangsperiode</span>' : 
                `<span style="color: #856404; font-weight: bold;">⚠️ Dit is NIET jouw voorrangsperiode. ${priorityFamilyName} heeft voorrang.</span>`
              }
              ${isAdmin ? ` <span style="margin-left: 1em; color: #666; font-size: 0.9em;">(Score: ${currentUserScore})</span>` : ''}
            </div>
          </div>
        ` : ''}
        
        <h3 style="margin-top: 0;">Andere intenties (${sortedIntentions.filter(int => !currentUser || int.userId !== currentUser.id).length}):</h3>
        ${sortedIntentions.filter(int => !currentUser || int.userId !== currentUser.id).length === 0 ? '<p style="color: #666;">Nog geen andere intenties voor deze periode.</p>' : ''}
  `;
  
  sortedIntentions.forEach((int, index) => {
    const isOwnIntention = currentUser && int.userId === currentUser.id;
    if (isOwnIntention) return; // Skip own intention, already shown above
    
    // Only show family priority, not score priority
    const hasFamilyPriorityOverUser = int.hasPriority && !currentUserHasPriority;
    
    html += `
      <div style="padding: 1em; margin: 0.5em 0; background: ${int.hasPriority ? '#e8f5e9' : '#fff3cd'}; border-left: 4px solid ${int.hasPriority ? '#4caf50' : '#ffc107'}; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <strong>${int.createdBy || int.naam}</strong>
            ${int.hasPriority ? ' <span style="color: #4caf50; font-weight: bold;">✓ Voorrangsperiode</span>' : ''}
            ${int.personen ? ` <span style="color: #666;">(${int.personen} persoon${int.personen > 1 ? 'en' : ''})</span>` : ''}
            ${isAdmin ? `<div style="margin-top: 0.3em; font-size: 0.9em; color: #666;">Score: <strong>${int.userScore}</strong></div>` : ''}
            ${hasFamilyPriorityOverUser ? '<div style="margin-top: 0.5em; color: #f44336; font-weight: bold;">⚠️ Deze persoon heeft voorrang op jou (andere familie)</div>' : ''}
            ${int.opmerking ? `<div style="margin-top: 0.5em; color: #666; font-style: italic; font-size: 0.9em;">${int.opmerking}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  html += `
        <div style="margin-top: 2em; padding-top: 1.5em; border-top: 2px solid #e0e0e0;">
          <p style="color: #666; font-size: 0.9em; margin-bottom: 1em;">
            Tijdens de prioriteitsperiode (januari-maart) kunnen meerdere personen interesse tonen voor dezelfde periode. 
            Op 1 februari maakt de eigenaar de definitieve keuze.
          </p>
          <div style="display: flex; gap: 1em; justify-content: flex-end;">
            <button onclick="closeIntentionsModal()" class="btn-secondary">Annuleren</button>
            <button onclick="continueWithReservation()" class="btn-primary">Doorgaan met reserveren</button>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('intentionsModal');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Add modal to page
  document.body.insertAdjacentHTML('beforeend', html);
  
  // Store callback
  window.intentionsModalCallback = onContinue;
}

// Close intentions modal
function closeIntentionsModal() {
  const modal = document.getElementById('intentionsModal');
  if (modal) {
    modal.remove();
  }
  window.intentionsModalCallback = null;
}

// Continue with reservation after viewing intentions
function continueWithReservation() {
  if (window.intentionsModalCallback) {
    window.intentionsModalCallback();
    window.intentionsModalCallback = null;
  }
  closeIntentionsModal();
}

// Handle reserveer klik
function handleReserveClick(apartment) {
  const selection = selectionState[apartment];
  
  if (!selection.startDate || !selection.endDate) {
    alert('Selecteer eerst een start- en einddatum');
    return;
  }
  
  // Check if there are intentions for this period
  const isInPreferredMonths = isDateInPreferredMonths(formatDate(selection.startDate), formatDate(selection.endDate));
  if (isInPreferredMonths) {
    const overlappingIntentions = getOverlappingIntentions(apartment, selection.startDate, selection.endDate);
    if (overlappingIntentions.length > 0) {
      // Show modal with intentions
      showIntentionsModal(apartment, selection.startDate, selection.endDate, overlappingIntentions, () => {
        // Callback: continue with reservation
        const apartmentName = apartment === 'A' ? '35' : '36';
        const start = formatDate(selection.startDate);
        const end = formatDate(selection.endDate);
        
        sessionStorage.setItem('pendingReservation', JSON.stringify({
          appartement: apartmentName,
          aankomst: start,
          vertrek: end
        }));
        
        window.location.href = 'kalender.html';
      });
      return; // Wait for modal confirmation
    }
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
function displayReservations(containerId = 'reservationsList') {
  const container = document.getElementById(containerId);
  if (!container) return;
  
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
    
    // Check if this is user's own reservation
    const isOwnReservation = user && res.userId === user.id;
    
    // Show cancel button for own reservations, delete button for admin
    let actionButtons = '';
    if (userIsAdmin) {
      actionButtons = `<button class="btn-delete" onclick="handleDeleteReservation('${res.id}')">Verwijderen</button>`;
    } else if (isOwnReservation) {
      // Own reservation: show cancel button
      actionButtons = `<button class="btn-secondary" onclick="cancelReservation('${res.id}')">Annuleren</button>`;
    }
    
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
          ${actionButtons}
        </div>
      </div>
    `;
  }).join('');
}

// Reservering verwijderen (alleen admin)
async function handleDeleteReservation(id) {
  const confirmMsg = '⚠️ Weet je zeker dat je deze reservering wilt verwijderen?\n\nDit kan niet ongedaan worden gemaakt.';
  if (confirm(confirmMsg)) {
    await deleteReservation(id);
    if (typeof displayReservations === 'function') {
      displayReservations();
    }
    if (typeof displayMyReservations === 'function') {
      displayMyReservations();
    }
    if (typeof generateCalendar === 'function') {
      generateCalendar();
    }
  }
}

// Toon eigen reserveringen op homepage
function displayMyReservations() {
  const section = document.getElementById('myReservationsSection');
  const list = document.getElementById('myReservationsList');
  
  if (!section || !list) return;
  
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  
  if (!user) {
    section.style.display = 'none';
    return;
  }
  
  const reservations = getReservations();
  const myReservations = reservations.filter(res => res.userId === user.id);
  
  if (myReservations.length === 0) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  
  // Sorteer op aankomstdatum (oudste eerst)
  myReservations.sort((a, b) => new Date(a.aankomst) - new Date(b.aankomst));
  
  list.innerHTML = myReservations.map(res => {
    const aankomst = new Date(res.aankomst);
    const vertrek = new Date(res.vertrek);
    const today = getCurrentDate();
    const daysUntilArrival = Math.ceil((aankomst - today) / (1000 * 60 * 60 * 24));
    const withinTwoWeeks = daysUntilArrival <= 14 && daysUntilArrival >= 0;
    const canCancel = !withinTwoWeeks || res.status !== 'betaald';
    
    const statusBadge = res.status === 'goedgekeurd' 
      ? '<span class="status-badge approved">✓ Goedgekeurd</span>'
      : res.status === 'betaald'
      ? '<span class="status-badge paid">€ Betaald</span>'
      : res.status === 'pending_cancellation'
      ? '<span class="status-badge pending" style="background: #ffc107; color: #856404;">⏳ Annulering Aangevraagd</span>'
      : '<span class="status-badge pending">⏳ In afwachting</span>';
    
    let cancelInfo = '';
    let cancelButton = '';
    
    if (res.status === 'pending_cancellation') {
      cancelInfo = '<p style="color: #856404; font-style: italic; margin-top: 0.5em;">⏳ Annulering aangevraagd - wachtend op beheerder</p>';
    } else if (withinTwoWeeks && res.status === 'betaald') {
      cancelInfo = '<p style="color: #dc3545; font-weight: bold; margin-top: 0.5em;">⚠️ Je kunt deze reservering nog annuleren, maar krijg geen geld terug (binnen 2 weken van aankomst)</p>';
      cancelButton = `<button class="btn-secondary" onclick="cancelReservation('${res.id}')" style="margin-top: 0.5em;">Annuleren</button>`;
    } else {
      cancelButton = `<button class="btn-secondary" onclick="cancelReservation('${res.id}')" style="margin-top: 0.5em;">Annuleren</button>`;
    }
    
    return `
      <div class="reservation-item" style="margin-bottom: 1.5em; padding: 1.5em; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div class="reservation-info">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.8em;">
            <div>
              <strong style="font-size: 1.1em;">Appartement ${res.appartement === 'A' || res.appartement === '35' ? '35' : '36'}</strong>
              <div style="font-size: 0.9em; color: #666; margin-top: 0.3em;">
                ${aankomst.toLocaleDateString('nl-NL')} - ${vertrek.toLocaleDateString('nl-NL')}
                ${res.personen ? ` (${res.personen} persoon${res.personen > 1 ? 'en' : ''})` : ''}
              </div>
            </div>
            ${statusBadge}
          </div>
          ${res.opmerking ? `<div style="margin: 0.8em 0; color: #666; font-style: italic;">${res.opmerking}</div>` : ''}
          ${cancelInfo}
          ${cancelButton}
        </div>
      </div>
    `;
  }).join('');
}

// Toon intenties voor voorkeursmaanden
function displayIntentions() {
  const section = document.getElementById('intentionsSection');
  const list = document.getElementById('intentionsList');
  
  if (!section || !list) return;
  
  const reservations = getReservations();
  const intentions = reservations.filter(res => res.isIntention && res.status !== 'approved');
  
  // Get users for score lookup
  const users = typeof getUsers === 'function' ? getUsers() : [];
  
  // Check of we in prioriteitsperiode zijn of er intenties zijn
  const today = getCurrentDate();
  const isPriorityPeriod = today.getMonth() < 3; // Jan-Mar
  const isAfterFeb1 = today.getMonth() > 1 || (today.getMonth() === 1 && today.getDate() >= 1); // Na 1 februari
  
  if (intentions.length === 0 && !isPriorityPeriod) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'block';
  
  if (intentions.length === 0) {
    list.innerHTML = '<p class="empty-state">Nog geen intenties ingediend voor voorkeursmaanden</p>';
    return;
  }
  
  // Groepeer intenties per appartement en periode
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
  
  // Bepaal prioriteitsfamilie voor elke groep
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
    
    // Sorteer intenties: eerst op score (hoogste eerst), dan op prioriteitsfamilie
    group.intentions.sort((a, b) => {
      const aUser = users.find(u => u.id === a.userId || u.email === a.email);
      const bUser = users.find(u => u.id === b.userId || u.email === b.email);
      
      // Get scores (default 0 if not set)
      const aScore = aUser ? (aUser.score !== undefined && aUser.score !== null ? aUser.score : 0) : 0;
      const bScore = bUser ? (bUser.score !== undefined && bUser.score !== null ? bUser.score : 0) : 0;
      
      // First sort by score (highest first)
      if (aScore !== bScore) {
        return bScore - aScore; // Higher score first
      }
      
      // If scores are equal, then by priority family
      const aFamily = a.family || (a.userId ? getUserFamily(a.userId) : null);
      const bFamily = b.family || (b.userId ? getUserFamily(b.userId) : null);
      
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
  
  // Sorteer groepen op appartement en datum
  groups.sort((a, b) => {
    if (a.appartement !== b.appartement) {
      return a.appartement.localeCompare(b.appartement);
    }
    return new Date(a.aankomst) - new Date(b.aankomst);
  });
  
  list.innerHTML = groups.map(group => {
    const aankomst = new Date(group.aankomst);
    const vertrek = new Date(group.vertrek);
    const apartmentName = group.appartement === 'A' || group.appartement === '35' ? '35' : '36';
    
    const intentionsHtml = group.intentions.map(int => {
      const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
      const isOwnIntention = user && int.userId === user.id;
      const intFamily = int.family || (int.userId ? getUserFamily(int.userId) : null);
      const hasPriority = intFamily === group.priorityFamily;
      
      // Get user score (only show to admin, but calculate for sorting)
      const intUser = users.find(u => u.id === int.userId || u.email === int.email);
      const userScore = intUser ? (intUser.score !== undefined && intUser.score !== null ? intUser.score : 0) : 0;
      const isAdmin = user && user.role === 'admin';
      
        return `
        <div class="intention-item" style="padding: 1em; margin: 0.5em 0; background: ${hasPriority ? '#e8f5e9' : '#fff3cd'}; border-left: 4px solid ${hasPriority ? '#4caf50' : '#ffc107'}; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <strong>${int.createdBy || int.naam}</strong>
              ${hasPriority ? '<span style="margin-left: 0.5em; color: #4caf50; font-weight: bold;">✓ Voorrang</span>' : ''}
              ${int.personen ? ` <span style="color: #666;">(${int.personen} persoon${int.personen > 1 ? 'en' : ''})</span>` : ''}
              ${isAdmin ? `<div style="margin-top: 0.3em; font-size: 0.9em;"><strong>Score:</strong> <span style="font-weight: bold; color: ${userScore > 0 ? '#4caf50' : userScore < 0 ? '#f44336' : '#666'}; font-size: 1.1em;">${userScore}</span></div>` : ''}
              ${int.opmerking ? `<div style="margin-top: 0.5em; color: #666; font-style: italic; font-size: 0.9em;">${int.opmerking}</div>` : ''}
            </div>
            ${isOwnIntention ? '<span style="color: #2196f3; font-size: 0.9em;">(Jouw intentie)</span>' : ''}
          </div>
        </div>
      `;
    }).join('');
    
    return `
      <div class="intention-group" style="margin-bottom: 2em; padding: 1.5em; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <div style="margin-bottom: 1em; padding-bottom: 1em; border-bottom: 2px solid #e0e0e0;">
          <h3 style="margin: 0 0 0.5em 0;">Appartement ${apartmentName}</h3>
          <div style="color: #666;">
            ${aankomst.toLocaleDateString('nl-NL')} - ${vertrek.toLocaleDateString('nl-NL')}
          </div>
          <div style="margin-top: 0.5em; font-weight: bold; color: #1976d2;">
            Voorrangsperiode: ${group.priorityFamilyName}
          </div>
          ${isAfterFeb1 ? '<div style="margin-top: 0.5em; color: #d32f2f; font-weight: bold;">⚠️ Wachtend op definitieve keuze door eigenaar</div>' : ''}
        </div>
        <div>
          <strong style="display: block; margin-bottom: 0.5em;">Intenties (${group.intentions.length}):</strong>
          ${intentionsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Helper om familie van gebruiker op te halen
function getUserFamily(userId) {
  if (typeof getCurrentUser === 'function') {
    const user = getCurrentUser();
    if (user && user.id === userId) {
      return user.family;
    }
  }
  // Probeer uit reservering te halen
  const reservations = getReservations();
  const res = reservations.find(r => r.userId === userId);
  return res ? res.family : null;
}

// Reservering annuleren (eigenaar)
async function cancelReservation(id) {
  const reservations = getReservations();
  const reservation = reservations.find(r => r.id === id);
  
  if (!reservation) {
    alert('Reservering niet gevonden');
    return;
  }
  
  const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
  if (!user || reservation.userId !== user.id) {
    alert('Je kunt alleen je eigen reserveringen annuleren');
    return;
  }
  
  // Check of we binnen 2 weken van begindatum zijn
  const today = getCurrentDate();
  const arrivalDate = new Date(reservation.aankomst);
  arrivalDate.setHours(0, 0, 0, 0);
  const daysUntilArrival = Math.ceil((arrivalDate - today) / (1000 * 60 * 60 * 24));
  const withinTwoWeeks = daysUntilArrival <= 14 && daysUntilArrival >= 0;
  
  // Als nog niet betaald: direct verwijderen
  if (reservation.status !== 'betaald') {
    const confirmMsg = withinTwoWeeks 
      ? '⚠️ Je annuleert binnen 2 weken voor je aankomstdatum.\n\nDit kan niet ongedaan worden gemaakt.\n\nWeet je zeker dat je deze reservering wilt annuleren?'
      : 'Weet je zeker dat je deze reservering wilt annuleren?';
      
    if (confirm(confirmMsg)) {
      await deleteReservation(id);
      displayMyReservations();
      generateCalendar();
      alert('Reservering geannuleerd en verwijderd.');
    }
  } else {
    // Als al betaald: check 2-weken regel
    if (withinTwoWeeks) {
      // Binnen 2 weken: geen geld terug, maar wel verwijderen
      const confirmMsg = '⚠️ Je annuleert binnen 2 weken voor je aankomstdatum.\n\nVanwege deze korte termijn krijg je GEEN geld terug.\n\nWeet je zeker dat je deze reservering wilt annuleren?';
      if (confirm(confirmMsg)) {
        // Direct verwijderen (geen refund)
        await deleteReservation(id);
        displayMyReservations();
        generateCalendar();
        alert('Reservering geannuleerd en verwijderd. Geen terugbetaling vanwege korte termijn annulering (binnen 2 weken).');
      }
    } else {
      // Meer dan 2 weken: refund mogelijk
      const confirmMsg = 'Je hebt al betaald voor deze reservering.\n\nAls je annuleert, wordt de beheerder op de hoogte gebracht om het geld terug te geven.\n\nWeet je zeker dat je wilt annuleren?';
      if (confirm(confirmMsg)) {
        // Update reservering status naar pending_cancellation
        const updatedReservation = {
          ...reservation,
          status: 'pending_cancellation',
          cancellationRequested: new Date().toISOString()
        };
        
        // Update in Firebase
        if (typeof updateReservation === 'function') {
          await updateReservation(id, updatedReservation);
        } else {
          // Fallback: delete and re-add
          await deleteReservation(id);
          await addReservation(updatedReservation);
        }
        
        displayMyReservations();
        generateCalendar();
        alert('Je reservering is gemarkeerd voor annulering. De beheerder wordt op de hoogte gebracht om het geld terug te geven.');
      }
    }
  }
}

// Update reservering (helper functie)
async function updateReservation(id, updates) {
  if (typeof firebaseDB !== 'undefined' && firebaseDB) {
    try {
      await firebaseDB.collection('reservations').doc(id).update(updates);
      
      // Update localStorage
      const reservations = getReservations();
      const index = reservations.findIndex(r => r.id === id);
      if (index !== -1) {
        reservations[index] = { ...reservations[index], ...updates };
        localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
      }
    } catch (error) {
      console.error('Firebase fout bij updaten reservering:', error);
      // Fallback: delete and re-add
      const reservations = getReservations();
      const reservation = reservations.find(r => r.id === id);
      if (reservation) {
        await deleteReservation(id);
        await addReservation({ ...reservation, ...updates });
      }
    }
  } else {
    // Fallback naar localStorage
    const reservations = getReservations();
    const index = reservations.findIndex(r => r.id === id);
    if (index !== -1) {
      reservations[index] = { ...reservations[index], ...updates };
      localStorage.setItem('santantoni_reservations', JSON.stringify(reservations));
    }
  }
}

// Check op overlappende reserveringen
function hasOverlap(apartement, aankomst, vertrek, excludeId = null) {
  const reservations = getReservations();
  return hasOverlapWithReservations(apartement, aankomst, vertrek, reservations, excludeId);
}

// Check overlap met specifieke lijst van reserveringen
function hasOverlapWithReservations(apartement, aankomst, vertrek, reservations, excludeId = null) {
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
  
  // Load eigen reserveringen op homepage
  if (typeof displayMyReservations === 'function') {
    setTimeout(() => {
      displayMyReservations();
    }, 500);
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
  
  // Toon reserveringen lijst alleen voor admin op kalender.html
  const adminReservationsList = document.getElementById('adminReservationsList');
  if (adminReservationsList) {
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const userIsAdmin = user && typeof isAdmin === 'function' ? isAdmin() : false;
    
    if (userIsAdmin) {
      adminReservationsList.style.display = 'block';
      if (document.getElementById('reservationsList')) {
        displayReservations();
      }
    } else {
      adminReservationsList.style.display = 'none';
    }
  } else if (document.getElementById('reservationsList')) {
    // Normale reserveringen lijst (als het niet de admin versie is)
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
      const appartementElement = document.getElementById('appartement');
      const apartement = appartementElement ? appartementElement.value : null;
      const aankomst = document.getElementById('aankomst')?.value;
      const vertrek = document.getElementById('vertrek')?.value;
      const priceDisplay = document.getElementById('priceDisplay');
      
      console.log('updatePrice called:', { user, apartement, aankomst, vertrek });
      
      // Ensure apartement is a string value, not an element
      if (!apartement || typeof apartement !== 'string') {
        console.warn('Apartement is not a valid string:', apartement);
        if (priceDisplay) priceDisplay.style.display = 'none';
        return;
      }
      
      if (apartement && aankomst && vertrek && new Date(aankomst) < new Date(vertrek)) {
        const priceInfo = user ? calculatePriceWithDiscounts(apartement, aankomst, vertrek, user) : calculatePrice(apartement, aankomst, vertrek, null);
        
        console.log('priceInfo:', priceInfo);
        
        // Build detailed breakdown list
        const breakdownContainer = document.getElementById('priceBreakdown');
        
        // Validate priceInfo - toon altijd, ook als 0
        if (!priceInfo) {
          console.error('priceInfo is null/undefined:', priceInfo);
          if (breakdownContainer) {
            breakdownContainer.innerHTML = `<div style="color: #d32f2f; padding: 1em; background: #ffebee; border-radius: 4px;">
              <strong>Fout bij prijsberekening</strong><br>
              Prijsberekening kon niet worden uitgevoerd. Check console voor details.
            </div>`;
            if (priceDisplay) priceDisplay.style.display = 'block';
          }
          return;
        }
        
        // Als total 0 is maar breakdownItems bestaat, toon het alsnog (admin krijgt 100% korting)
        if (priceInfo.total === 0 && (!priceInfo.breakdownItems || priceInfo.breakdownItems.length === 0)) {
          console.warn('Price calculation returned 0 with no breakdown items:', priceInfo);
        }
        
        if (breakdownContainer) {
          let html = '';
          
          // Check if breakdownItems exists and has items
          if (priceInfo.breakdownItems && priceInfo.breakdownItems.length > 0) {
            html += priceInfo.breakdownItems.map(item => {
              if (!item || !item.prijs || item.prijs <= 0) {
                console.error('Invalid breakdown item:', item);
                return '';
              }
              if (item.isWeekly) {
                return `<div><strong>${item.count} week(en)</strong> ${item.naam} €${item.prijs.toFixed(2)}/week = <strong>€${(item.count * item.prijs).toFixed(2)}</strong></div>`;
              } else {
                return `<div><strong>${item.count} nacht(en)</strong> ${item.naam} €${item.prijs.toFixed(2)}/nacht = <strong>€${(item.count * item.prijs).toFixed(2)}</strong></div>`;
              }
            }).filter(h => h !== '').join('');
          } else {
            html += '<div style="color: #d32f2f;">Geen prijsdetails beschikbaar. Check console voor details.</div>';
          }
          
          // Add discounts if any
          if (priceInfo.discounts && priceInfo.discounts.length > 0) {
            html += '<div style="margin-top: 1em; padding-top: 1em; border-top: 1px solid #ddd;"><div style="color: #4CAF50;"><strong>Kortingen:</strong></div>';
            priceInfo.discounts.forEach(disc => {
              html += `<div style="color: #4CAF50;">- ${disc.percentage}% ${disc.type} = -€${disc.amount.toFixed(2)}</div>`;
            });
            html += '</div>';
          }
          
          // Add totals - always show, even if 0 for debugging
          if (priceInfo.baseTotal !== undefined && priceInfo.baseTotal !== priceInfo.total) {
            html += `<div style="margin-top: 1em; padding-top: 1em; border-top: 1px solid #ddd;"><strong>Subtotaal: €${priceInfo.baseTotal.toFixed(2)}</strong></div>`;
          }
          
          // Toon totaal - admin krijgt 0 (100% korting), anders toon prijs
          const totalDisplay = priceInfo.total !== undefined ? priceInfo.total.toFixed(2) : '0.00';
          const totalColor = priceInfo.total > 0 ? '#1565c0' : (priceInfo.total === 0 && user && user.role === 'admin' ? '#4CAF50' : '#d32f2f');
          const totalMessage = priceInfo.total === 0 && user && user.role === 'admin' ? ' (100% korting voor admin)' : '';
          html += `<div style="margin-top: 0.5em; font-size: 1.2em; font-weight: bold; color: ${totalColor};"><strong>Totaal: €${totalDisplay}${totalMessage}</strong></div>`;
          
          console.log('Setting breakdown HTML:', html);
          console.log('Full priceInfo:', JSON.stringify(priceInfo, null, 2));
          breakdownContainer.innerHTML = html;
        } else {
          console.error('breakdownContainer not found!');
        }
        
        if (priceDisplay) {
          priceDisplay.style.display = 'block';
        }
      } else {
        console.log('Invalid data, hiding price display');
        if (priceDisplay) {
          priceDisplay.style.display = 'none';
        }
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
      
      // Ook bij input events (voor snellere feedback)
      aankomstInput.addEventListener('input', () => {
        updatePrice();
      });
    }
    
    const vertrekInput = document.getElementById('vertrek');
    if (vertrekInput) {
      vertrekInput.addEventListener('change', () => {
        updatePrice();
        updateReservationForm(); // Update user info display
      });
      
      // Ook bij input events (voor snellere feedback)
      vertrekInput.addEventListener('input', () => {
        updatePrice();
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
    setTimeout(() => {
      updateReservationForm();
      updatePrice(); // Update prijs na auth load
    }, 100);
    
    // Ook update prijs na een korte delay om zeker te zijn dat alles geladen is
    setTimeout(() => {
      updatePrice();
    }, 500);
    
    // Update admin reservations visibility after auth load
    setTimeout(() => {
      const adminReservationsList = document.getElementById('adminReservationsList');
      if (adminReservationsList) {
        const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
        const userIsAdmin = user && typeof isAdmin === 'function' ? isAdmin() : false;
        
        if (userIsAdmin) {
          adminReservationsList.style.display = 'block';
          if (document.getElementById('reservationsList')) {
            displayReservations();
          }
        } else {
          adminReservationsList.style.display = 'none';
        }
      }
    }, 500);
  }
  
  // Formulier submit - alleen op kalender pagina
  if (reservationForm) {
    reservationForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Check authentication
    if (typeof requireBookingAccess === 'function' && !requireBookingAccess()) {
      return;
    }
    
    const user = typeof getCurrentUser === 'function' ? getCurrentUser() : null;
    const apartement = document.getElementById('appartement').value;
    const naam = user ? user.name : document.getElementById('naam').value;
    const email = user ? user.email : document.getElementById('email').value;
    const aankomst = document.getElementById('aankomst').value;
    const vertrek = document.getElementById('vertrek').value;
    const personen = parseInt(document.getElementById('personen').value);
    const opmerking = document.getElementById('opmerking').value;
    
    // Check betalingsvoorwaarden akkoord
    const paymentAgreement = document.getElementById('paymentAgreement');
    if (!paymentAgreement || !paymentAgreement.checked) {
      alert('Je moet akkoord gaan met de betalingsvoorwaarden om je reservering te kunnen plaatsen.');
      paymentAgreement?.focus();
      return;
    }
    
    // Validatie
    if (new Date(aankomst) >= new Date(vertrek)) {
      alert('Vertrekdatum moet na aankomstdatum liggen!');
      return;
    }
    
    // Check seizoensregels (admin overslaat deze check)
    const seasonCheck = checkSeizoenRules(aankomst, vertrek, user);
    if (!seasonCheck.valid) {
      alert(seasonCheck.message);
      return;
    }
    
    // Check voorseizoen constraint (altijd checken, ook als geen user)
    const preseasonCheck = checkPreseasonConstraint(aankomst, vertrek, user, apartement);
    if (!preseasonCheck.valid) {
      if (preseasonCheck.message) {
        alert(preseasonCheck.message);
      }
      return;
    }
    
    // Bereken prijs met kortingen
    const priceInfo = user ? calculatePriceWithDiscounts(apartement, aankomst, vertrek, user) : calculatePrice(apartement, aankomst, vertrek, null);
    
    // Check of deze reservering in prioriteitsperiode is voor voorkeursmaanden
    const todayDate = getCurrentDate(); // Gebruik override datum indien ingesteld
    const isPriorityPeriod = todayDate.getMonth() < 3; // Jan-Mar
    const isInPreferredMonths = isDateInPreferredMonths(aankomst, vertrek); // Juni-Sept
    
    // Bepaal of dit een intentie is (tijdens prioriteitsperiode voor voorkeursmaanden)
    // Gebruik isIntention uit preseasonCheck als beschikbaar, anders bepaal het zelf
    const isIntention = preseasonCheck.isIntention || (isPriorityPeriod && isInPreferredMonths);
    
    // Check overlap - intenties mogen overlappen, normale reserveringen niet
    const allReservations = getReservations();
    
    if (isIntention) {
      // Intentie tijdens prioriteitsperiode - mag overlappen met andere intenties
      // Check alleen overlap met definitieve reserveringen (niet-intenties)
      const definitiveReservations = allReservations.filter(res => !res.isIntention);
      if (hasOverlapWithReservations(apartement, aankomst, vertrek, definitiveReservations)) {
        alert(`Appartement ${apartement} is al definitief gereserveerd in deze periode!`);
        return;
      }
      
      // Toon wie er al interesse heeft in deze periode
      const overlappingIntentions = allReservations.filter(res => {
        if (res.appartement !== apartement) return false;
        if (!res.isIntention) return false;
        if (res.userId === (user ? user.id : null)) return false; // Niet je eigen intentie
        
        const resStart = new Date(res.aankomst);
        const resEnd = new Date(res.vertrek);
        const newStart = new Date(aankomst);
        const newEnd = new Date(vertrek);
        
        return newStart < resEnd && newEnd > resStart;
      });
      
      // Bepaal prioriteitsfamilie voor deze periode
      const reservationStart = new Date(aankomst);
      const year = reservationStart.getFullYear();
      let firstSummerMonth = null;
      const checkStartDate = new Date(reservationStart);
      while (checkStartDate < new Date(vertrek) && !firstSummerMonth) {
        const month = checkStartDate.getMonth();
        if (month >= 5 && month <= 8) {
          firstSummerMonth = month;
          break;
        }
        checkStartDate.setDate(checkStartDate.getDate() + 1);
      }
      
      const apartmentNum = apartement === 'A' ? '35' : (apartement === 'B' ? '36' : apartement);
      const priorityFamily = firstSummerMonth !== null ? getPriorityFamilyForMonth(firstSummerMonth, year, apartmentNum) : null;
      const userFamily = user ? user.family : null;
      const hasPriority = priorityFamily && userFamily === priorityFamily;
      
      // Waarschuwing voor intentie
      let warningMsg = '⚠️ INTENTIE RESERVERING\n\nJe boekingsperiode valt in de prioriteitsperiode voor voorkeursmaanden.\n';
      warningMsg += 'Dit is een INTENTIE: meerdere personen kunnen interesse tonen voor dezelfde periode.\n\n';
      
      if (!hasPriority && priorityFamily) {
        const priorityFamilyName = priorityFamily === 'A' ? 'Familie A (Pieters-Louasson)' : 'Familie B (Broeders)';
        warningMsg += `⚠️ BELANGRIJK: Dit is NIET jouw voorrangsperiode!\n`;
        warningMsg += `${priorityFamilyName} heeft voorrang op deze periode.\n\n`;
        
        // Check if someone from priority family already has an intention
        const priorityFamilyIntentions = overlappingIntentions.filter(int => {
          const intUser = users.find(u => u.id === int.userId || u.email === int.email);
          const intFamily = intUser ? intUser.family : (int.family || null);
          return intFamily === priorityFamily;
        });
        
        if (priorityFamilyIntentions.length > 0) {
          warningMsg += `⚠️ Er heeft al ${priorityFamilyIntentions.length} persoon(en) van ${priorityFamilyName} interesse getoond voor deze periode.\n`;
          warningMsg += `Zij hebben voorrang op jou.\n\n`;
        }
      } else if (hasPriority) {
        warningMsg += `✓ Dit is jouw voorrangsperiode (Familie ${priorityFamily}).\n\n`;
      }
      
      warningMsg += 'Op 1 februari wordt de definitieve keuze gemaakt door de eigenaar.';
      
      if (!confirm(warningMsg)) {
        return; // Gebruiker wilt niet doorgaan
      }
    } else {
      // Normale reservering (buiten prioriteitsperiode of niet in voorkeursmaanden)
      // Check overlap met alle reserveringen (inclusief intenties die nog niet bevestigd zijn)
      // Maar intenties die al bevestigd zijn door eigenaar worden als definitief beschouwd
      const confirmedReservations = allReservations.filter(res => !res.isIntention || res.status === 'approved');
      if (hasOverlapWithReservations(apartement, aankomst, vertrek, confirmedReservations)) {
        alert(`Appartement ${apartement} is al gereserveerd in deze periode!`);
        return;
      }
    }
    
    // Reservering toevoegen
    const reservation = {
      appartement: apartement,
      naam,
      email,
      aankomst,
      vertrek,
      personen,
      opmerking,
      prijs: priceInfo.total,
      status: 'in_afwachting',
      userId: user ? user.id : null,
      createdBy: user ? user.name : naam,
      isIntention: isIntention || false,
      isProvisional: false // Legacy - niet meer gebruikt, vervangen door isIntention
    };
    
    // Wait for async addReservation to complete
    const newReservation = await addReservation(reservation);
    
    // Maak transactie aan
    if (typeof addTransaction === 'function') {
      addTransaction({
        type: 'reservation',
        reservationId: newReservation.id,
        userName: naam,
        amount: -priceInfo.total, // Negatief omdat het een betaling is
        description: `Reservering Appartement ${apartement}: ${aankomst} - ${vertrek}`,
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

