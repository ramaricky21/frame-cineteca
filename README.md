# FRAME — Cineteca personale (progetto nuovo)

Web app installabile (PWA) per catalogare film, anime, serie TV, live action e altre opere.

- Accesso email/password con Firebase Authentication.
- Sincronizzazione tra smartphone, tablet e desktop tramite Cloud Firestore.
- Ricerca TMDB e locandine automatiche, usando una chiave API TMDB v3.
- Categorie create dall'utente: creazione, rinomina, eliminazione senza eliminare titoli.
- Più categorie per titolo, note, stati, voti anche `9+`, `9-`, `10 e lode`, `11/10`.
- Ordinamento per voto (predefinito), ricerca, filtri, esportazione/importazione JSON.
- Installabile dal browser su dispositivo compatibile; utilizzo base senza abbonamento.

## Avvio

Il file da modificare è **`config.js`**. Inserisci i parametri di un **nuovo** progetto Firebase Web e la tua chiave API TMDB.
Dopo, carica tutti i file di questa cartella nella radice di un **nuovo** repository GitHub pubblico e attiva Pages su `main / (root)`.
Copia le regole del pacchetto Firebase nella console del progetto Firebase nuovo.

**Non caricare solo questo ZIP in GitHub:** estrai i file e trascina il *contenuto* della cartella. `index.html` deve stare nella root del repository.

Per testare l'interfaccia prima della configurazione, apri il sito e premi **Prova la demo**. I dati demo sono temporanei e non si sincronizzano.

Guida completa: `GUIDA_PASSO_PASSO.md` nel pacchetto completo.

## Struttura

- `index.html`, `styles.css`, `app.js`, `data.js`: interfaccia e logica.
- `config.js`: configurazione pubblica, da completare manualmente.
- `manifest.webmanifest`, `sw.js`, `assets/`: installazione PWA.
- `.nojekyll`: compatibilità GitHub Pages.

## Sicurezza e limiti

Per ogni utente Firebase: `users/{uid}/entries` e `users/{uid}/categories`, protetti da regole che consentono accesso soltanto al proprietario.
La configurazione Web Firebase non è una chiave amministrativa. La chiave TMDB presente in `config.js`, invece, sarà esposta agli utenti del repository pubblico; usa soltanto la chiave API v3 concessa per questo uso e rispetta le condizioni TMDB. Non pubblicare chiavi di servizio Firebase, password o credenziali cloud.

TMDB: gratuito per uso personale non commerciale con attribuzione obbligatoria. GitHub Pages gratuito per repository pubblici su GitHub Free; Firebase Spark ha quote gratuite. Nessuna garanzia sui cambiamenti futuri delle condizioni di terzi.

Questa app non è collegata a Figurine Club e non ne importa/modifica i dati.
