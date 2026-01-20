# Firebase Firestore Security Rules

## Probleem
Je krijgt `permission-denied` fouten omdat de Firebase Firestore Security Rules niet correct zijn ingesteld.

## Oplossing

### Stap 1: Ga naar Firebase Console
1. Ga naar: https://console.firebase.google.com/project/familie-sant-antoni/firestore/rules
2. Of: Firebase Console → Project: **familie-sant-antoni** → Firestore Database → Rules tab

### Stap 2: Plak deze Security Rules

Kopieer en plak de volgende rules in de Firebase Console:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Reserveringen: iedereen kan lezen, alleen ingelogde gebruikers kunnen schrijven/verwijderen
    match /reservations/{reservationId} {
      allow read: if true;  // Iedereen kan reserveringen lezen
      allow create, update, delete: if request.auth != null;  // Alleen ingelogde gebruikers kunnen schrijven/verwijderen
    }
    
    // Berichten: iedereen kan lezen, alleen ingelogde gebruikers kunnen schrijven/verwijderen
    match /messages/{messageId} {
      allow read: if true;  // Iedereen kan berichten lezen
      allow create, update, delete: if request.auth != null;  // Alleen ingelogde gebruikers kunnen schrijven/verwijderen
    }
    
    // Gebruikers: alleen lezen voor ingelogde gebruikers, alleen admin kan schrijven
    match /users/{userId} {
      allow read: if request.auth != null;  // Alleen ingelogde gebruikers kunnen gebruikers lezen
      allow create, update, delete: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';  // Alleen admin kan gebruikers bewerken
    }
    
    // Foto's: iedereen kan lezen, alleen ingelogde gebruikers kunnen uploaden/verwijderen
    match /photos/{photoId} {
      allow read: if true;  // Iedereen kan foto's bekijken
      allow create, update, delete: if request.auth != null;  // Alleen ingelogde gebruikers kunnen foto's uploaden/verwijderen
    }
    
    // Transacties: alleen admin kan lezen/schrijven
    match /transactions/{transactionId} {
      allow read, write: if request.auth != null && 
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';  // Alleen admin
    }
  }
}
```

### Stap 3: Publiceer de Rules
1. Klik op **"Publish"** of **"Publiceren"** bovenaan de pagina
2. Wacht even tot de rules zijn gepubliceerd (meestal binnen 1 minuut)

### Stap 4: Test opnieuw
1. **Log eerst in** op de website (belangrijk!)
2. Ga naar Admin Panel → Settings → Test Firebase Verbinding
3. De test zou nu moeten slagen

## Belangrijk

⚠️ **Je moet eerst INLOGGEN voordat Firebase werkt!**

- De security rules vereisen `request.auth != null` (ingelogde gebruiker)
- Zonder inloggen krijg je altijd `permission-denied`
- Log in via de login pagina voordat je Firebase test

## Alternatieve Rules (Minder Veilig - Alleen voor Testen)

Als je tijdens ontwikkeling iedereen toegang wilt geven (NIET voor productie!):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;  // IEDEREEN heeft toegang - ALLEEN VOOR TESTEN!
    }
  }
}
```

⚠️ **WAARSCHUWING**: Gebruik deze rules ALLEEN tijdens ontwikkeling, NIET in productie!

