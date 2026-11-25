import { createDataApi } from './dataApi';
import { createFirestoreStore } from './firestoreStore';

/**
 * The app's single data client. It talks to Firebase Firestore directly, so the
 * deployed site is one static build with no API server behind it. The method
 * shape stays axios-like (`{ data }` responses and `error.response.data.message`)
 * because every page already uses it.
 */
const api = createDataApi(createFirestoreStore());

export default api;
