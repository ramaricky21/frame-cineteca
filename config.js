/* FRAME - configurazione PUBBLICA dell'app web.
   Sostituisci i valori con quelli del tuo NUOVO progetto Firebase e del tuo account TMDB.
   NON inserire mai chiavi di account di servizio / private key / token di amministratore Firebase.
   Attenzione: anche la chiave TMDB qui inserita sarà visibile agli utenti del sito pubblico.
*/
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDC_Nkr9KrLajRDtRI_WFsE1BNT2CPSUqw",
  authDomain: "frame-cineteca.firebaseapp.com",
  projectId: "frame-cineteca",
  storageBucket: "frame-cineteca.firebasestorage.app",
  messagingSenderId: "387171900891",
  appId: "1:387171900891:web:2dae340eaa3d3c5b251bfe"
};

// TMDB > Impostazioni account > API > "API Key (v3 auth)" (NON il token account).
// La ricerca funziona senza server aggiuntivi; l'API è gratuita per progetti non commerciali.
export const TMDB_API_KEY = "5a4ac54f98c16db411aa7768aa9a757f";
