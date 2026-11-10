# FRAME — App web GitHub/Cloudflare Pages

Versione dell'app FRAME con autorizzazione amministrativa delle registrazioni, basata sul progetto del 10 novembre 2026.

## Funzionamento

- Ogni utente può creare un account email/password tramite Firebase Authentication, ma **prima di utilizzare la cineteca** deve ricevere l'approvazione dell'amministratore.
- Il tuo account già esistente diventa amministratore se il suo UID viene registrato in `accessConfig/main` nella console Firebase.
- Il pannello **Gestione utenti** è visibile solo all'amministratore e consente approvazione, rifiuto, revoca, riapprovazione.
- Ogni account mantiene i dati della **propria** cineteca; nessuna modifica alle categorie, valutazioni, ricerca TMDB e anti-duplicati.
- **Offline, cache Firestore, service worker e PWA non sono stati disattivati.** È cambiata solo la versione della cache statica per distribuire il nuovo codice.

## Installazione

1. Leggi prima `CONFIGURAZIONE_ADMIN.md` nel pacchetto completo (non presente in questa cartella GitHub).
2. Crea in Firebase `accessConfig/main` con il tuo `adminUid`.
3. Pubblica le nuove `FIREBASE/firestore.rules` e **solo dopo** distribuisci questa cartella nella root del repository `ramaricky21/frame-cineteca`, branch `main`.
4. Cloudflare Pages già collegato a GitHub pubblica il sito automaticamente dopo il deploy.

**Non cancellare né ricaricare i dati Firestore.** Non è necessario modificare `config.js`, il progetto Firebase o creare un nuovo account admin.

Il controllo di sicurezza è applicato dal server con Firestore Security Rules, non soltanto mediante la grafica. Gli account non ancora approvati possono autenticarsi e inviare la richiesta, ma non leggere/scrivere la cineteca online.
