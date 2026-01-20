# Firebase Security Rules - Automatische Sync Herstellen

## Probleem
Na het aanzetten van 2FA in Firebase werkt de automatische sync niet meer. Data wordt alleen in localStorage opgeslagen en niet gedeeld tussen apparaten.

## Oplossing

### Stap 1: Ga naar Firebase Console Rules
1. Ga naar: https://console.firebase.google.com/project/familie-sant-antoni/firestore/rules
2. Of: Firebase Console → Project → Firestore Database → Rules tab

### Stap 2: Vervang ALLES door deze rules

**Kopieer en plak deze rules (vervang alles wat er nu staat):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reserveringen: iedereen kan lezen en schrijven (automatische sync)
    match /reservations/{reservationId} {
      allow read, write: if true;  // Iedereen kan reserveringen lezen en schrijven
    }
    
    // Berichten: iedereen kan lezen en schrijven
    match /messages/{messageId} {
      allow read, write: if true;  // Iedereen kan berichten lezen en schrijven
    }
    
    // Gebruikers: alleen lezen voor ingelogde gebruikers, alleen admin kan schrijven
    match /users/{userId} {
      allow read: if request.auth != null;  // Alleen ingelogde gebruikers kunnen gebruikers lezen
      allow create, update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';  // Alleen admin kan gebruikers bewerken
    }
    
    // Foto's: iedereen kan lezen en schrijven
    match /photos/{photoId} {
      allow read, write: if true;  // Iedereen kan foto's bekijken en uploaden
    }
    
    // Transacties: alleen admin kan lezen/schrijven
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';  // Alleen admin
    }
  }
}
```

### Stap 3: Publiceer
1. Klik op **"Publish"** of **"Publiceren"** bovenaan
2. Wacht even (meestal binnen 1 minuut)

### Stap 4: Eenmalig - Sync bestaande data
Na het publiceren van de rules:
1. Ga naar Admin Panel → Settings
2. Klik op **"Sync ALL naar Firebase"** (oranje knop)
3. Dit synchroniseert alle bestaande localStorage data naar Firebase (eenmalig)

### Stap 5: Test
1. Maak een nieuwe reservering op je mobiel
2. Open de website op je PC
3. De reservering zou automatisch moeten verschijnen (binnen enkele seconden)

## Belangrijk

✅ **Na deze stappen werkt automatische sync weer:**
- Reserveringen op mobiel → verschijnen automatisch op PC
- Reserveringen op PC → verschijnen automatisch op mobiel
- Geen handmatige sync nodig
- Real-time updates tussen alle apparaten

⚠️ **Let op:** Deze rules geven iedereen toegang tot reserveringen, berichten en foto's. Dit is veilig voor een privé familie website, maar niet geschikt voor publieke websites.

## Als het nog steeds niet werkt

1. Check de browser console (F12) voor foutmeldingen
2. Check of Firebase status indicator "✓ Firebase" toont (niet "⚠️ Local")
3. Test de verbinding via Admin Panel → Settings → "Test Verbinding"
4. Check of data in Firebase staat: https://console.firebase.google.com/project/familie-sant-antoni/firestore/data

