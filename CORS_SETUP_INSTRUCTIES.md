# Firebase Storage CORS Configuratie

## Probleem
Je krijgt een CORS fout omdat Firebase Storage requests van GitHub Pages blokkeert.

## Oplossing 1: Via Google Cloud Console (Aanbevolen)

1. Ga naar [Google Cloud Console](https://console.cloud.google.com/)
2. Selecteer je project: **familie-sant-antoni**
3. Ga naar **Cloud Storage** → **Browser**
4. Klik op je storage bucket: **familie-sant-antoni.firebasestorage.app**
5. Ga naar de **Configurations** tab
6. Scroll naar **CORS configuration**
7. Klik op **Edit CORS configuration**
8. Plak het volgende JSON:

```json
[
  {
    "origin": [
      "https://mgabroeders.github.io",
      "http://localhost:*",
      "http://127.0.0.1:*"
    ],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
```

9. Klik op **Save**

## Oplossing 2: Via gsutil (Command Line)

Als je gsutil geïnstalleerd hebt:

1. Open terminal/command prompt
2. Navigeer naar de project folder
3. Run:
```bash
gsutil cors set cors-config.json gs://familie-sant-antoni.firebasestorage.app
```

## Verificatie

Na het instellen:
1. Herlaad je website op GitHub Pages
2. Probeer een foto te uploaden of bekijk bestaande foto's
3. De CORS fout zou nu weg moeten zijn

## Firebase Storage Security Rules

Controleer ook je Firebase Storage Security Rules in de Firebase Console:

1. Ga naar **Firebase Console** → **Storage** → **Rules**
2. Zorg dat je rules er zo uitzien:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{category}/{filename} {
      // Allow read for everyone
      allow read: if true;
      
      // Allow write (upload) only for authenticated users
      allow write: if request.auth != null;
      
      // Allow delete only for authenticated users
      allow delete: if request.auth != null;
    }
  }
}
```

3. Klik op **Publish**

