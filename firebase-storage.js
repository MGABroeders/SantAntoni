// Firebase Storage functions voor foto upload/download

// Upload foto naar Firebase Storage
async function uploadPhoto(file, category, description) {
  if (!firebaseStorage) {
    console.error('Firebase Storage niet geïnitialiseerd');
    return null;
  }
  
  const user = getCurrentUser();
  if (!user) {
    alert('Je moet ingelogd zijn om foto\'s te uploaden');
    return null;
  }
  
  try {
    // Generate unique filename
    const timestamp = Date.now();
    const filename = `${timestamp}_${file.name}`;
    // Firebase Storage compat API: ref() met path string
    const storageRef = firebaseStorage.ref(`photos/${category}/${filename}`);
    
    // Upload file
    const uploadTask = storageRef.put(file);
    const snapshot = await uploadTask;
    const downloadURL = await snapshot.ref.getDownloadURL();
    
    // Save photo metadata to Firestore
    const photoData = {
      url: downloadURL,
      filename: filename,
      category: category,
      description: description || '',
      uploadedBy: user.name || user.email,
      uploadedByEmail: user.email,
      uploadedById: user.id,
      uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString()
    };
    
    await firebaseDB.collection('photos').add(photoData);
    
    console.log('Foto succesvol geüpload:', downloadURL);
    return photoData;
  } catch (error) {
    console.error('Fout bij uploaden foto:', error);
    alert('Fout bij uploaden foto: ' + error.message);
    return null;
  }
}

// Haal alle foto's op uit Firestore
async function getPhotos() {
  if (!firebaseDB) {
    console.error('Firebase DB niet geïnitialiseerd');
    return [];
  }
  
  try {
    const snapshot = await firebaseDB.collection('photos')
      .orderBy('uploadedAt', 'desc')
      .get();
    
    const photos = [];
    snapshot.forEach(doc => {
      photos.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Also check localStorage as fallback
    const localPhotos = JSON.parse(localStorage.getItem('photos') || '[]');
    
    // Merge and deduplicate
    const allPhotos = [...photos];
    localPhotos.forEach(localPhoto => {
      if (!allPhotos.find(p => p.id === localPhoto.id)) {
        allPhotos.push(localPhoto);
      }
    });
    
    return allPhotos;
  } catch (error) {
    console.error('Fout bij ophalen foto\'s:', error);
    // Fallback to localStorage
    return JSON.parse(localStorage.getItem('photos') || '[]');
  }
}

// Real-time listener voor foto's
function subscribeToPhotos(callback) {
  if (!firebaseDB) {
    console.error('Firebase DB niet geïnitialiseerd');
    // Fallback to polling localStorage
    setInterval(() => {
      const photos = JSON.parse(localStorage.getItem('photos') || '[]');
      callback(photos);
    }, 2000);
    return () => {}; // Return unsubscribe function
  }
  
  try {
    const unsubscribe = firebaseDB.collection('photos')
      .orderBy('uploadedAt', 'desc')
      .onSnapshot((snapshot) => {
        const photos = [];
        snapshot.forEach(doc => {
          photos.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        // Also sync to localStorage
        localStorage.setItem('photos', JSON.stringify(photos));
        
        callback(photos);
      }, (error) => {
        console.error('Fout bij real-time foto\'s:', error);
        // Fallback to localStorage
        const photos = JSON.parse(localStorage.getItem('photos') || '[]');
        callback(photos);
      });
    
    return unsubscribe;
  } catch (error) {
    console.error('Fout bij real-time listener:', error);
    // Fallback to localStorage
    const photos = JSON.parse(localStorage.getItem('photos') || '[]');
    callback(photos);
    return () => {}; // Return unsubscribe function
  }
}

// Verwijder foto
async function deletePhoto(photoId, photoUrl) {
  if (!firebaseDB || !firebaseStorage) {
    console.error('Firebase niet geïnitialiseerd');
    return false;
  }
  
  const user = getCurrentUser();
  if (!user) {
    alert('Je moet ingelogd zijn om foto\'s te verwijderen');
    return false;
  }
  
  try {
    // Check if user can delete (own photo or admin)
    const photoDoc = await firebaseDB.collection('photos').doc(photoId).get();
    if (!photoDoc.exists) {
      alert('Foto niet gevonden');
      return false;
    }
    
    const photoData = photoDoc.data();
    const isAdmin = typeof isAdminUser === 'function' ? isAdminUser() : false;
    const isOwner = photoData.uploadedById === user.id || photoData.uploadedByEmail === user.email;
    
    if (!isAdmin && !isOwner) {
      alert('Je kunt alleen je eigen foto\'s verwijderen');
      return false;
    }
    
    // Delete from Firestore
    await firebaseDB.collection('photos').doc(photoId).delete();
    
    // Delete from Storage
    try {
      const storageRef = firebaseStorage.refFromURL ? firebaseStorage.refFromURL(photoUrl) : firebaseStorage.ref(photoUrl);
      await storageRef.delete();
    } catch (storageError) {
      console.warn('Fout bij verwijderen uit Storage (mogelijk al verwijderd):', storageError);
    }
    
    // Also remove from localStorage
    const localPhotos = JSON.parse(localStorage.getItem('photos') || '[]');
    const updatedPhotos = localPhotos.filter(p => p.id !== photoId);
    localStorage.setItem('photos', JSON.stringify(updatedPhotos));
    
    console.log('Foto succesvol verwijderd');
    return true;
  } catch (error) {
    console.error('Fout bij verwijderen foto:', error);
    alert('Fout bij verwijderen foto: ' + error.message);
    return false;
  }
}

