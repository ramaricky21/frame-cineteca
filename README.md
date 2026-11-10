# FRAME — Cineteca personale

Questa è la **versione aggiornata al 10 novembre 2026** del sito FRAME già pubblicato su Cloudflare Pages mediante il repository GitHub `ramaricky21/frame-cineteca`. Non modifica Figurine Club.

## Funzioni principali

- Login email/password Firebase e sincronizzazione Firestore.
- Cineteca con film, serie, anime, altri formati, categorie, stati, voti personalizzati, locandine e note.
- **Scopri nuovi titoli**: ricerca/esplorazione diretta di TMDB per popolarità, valutazioni, novità, tipo di opera, genere, anno; scheda dettagliata e pulsante «Aggiungi ai Da vedere».
- **Controllo duplicati** in ricerca TMDB, in Esplora, al salvataggio, all'importazione dei backup e durante la modifica della scheda.
- Confronto preventivo delle differenze (voto, stato, categorie, note ecc.); scelta esplicita prima di aggiornare una scheda già esistente.
- Revisione volontaria delle eventuali vecchie schede duplicate; nessuna cancellazione automatica su Firebase.
- Backup personale in JSON; utilizzo come PWA installabile.

## File e aggiornamento

- `index.html`: struttura dell'app e pagina Esplora.
- `styles.css`: grafica, inclusa versione mobile.
- `app.js`: interfaccia, persistenza, salvataggio e gestione dei conflitti.
- `data.js`: modello dei titoli e validazione dei backup.
- `identity.js`: riconoscimento delle opere e creazione delle chiavi univoche.
- `explore.js`: ricerca e scoperta TMDB.
- `config.js`: parametri pubblici di Firebase e chiave TMDB; già configurato nel backup originale.
- `sw.js`, `manifest.webmanifest`, `assets/`: PWA, icone e risorse statiche.

Per il deploy, prima pubblica le nuove **regole Firestore** fornite nel pacchetto separato. Poi estrai i file della cartella `APP_FRAME` e caricali nella root del repository GitHub esistente, branch `main`. Il sito Cloudflare Pages collegato a GitHub si aggiorna automaticamente dopo il deploy.

Non caricare lo ZIP come file singolo nel repository; estrailo. Non aggiornare GitHub Pages né altri repository. Non è necessaria nessuna dipendenza npm.

## Nota sui duplicati

Per i nuovi titoli catalogati su TMDB viene utilizzata una chiave univoca su Firestore e una transazione. Il confronto tra vecchie schede senza ID TMDB si basa su titolo (anche originale), anno quando presente e formato compatibile. Non esiste un criterio perfetto per titoli manuali molto ambigui: per questo i casi preesistenti si verificano prima di cancellare elementi.

## Verifica

Usa `VERIFICHE_POST_AGGIORNAMENTO.md` nel pacchetto completo. I test browser automatizzati sono stati eseguiti su dati dimostrativi e API TMDB simulate; le regole Firebase reali vanno pubblicate dalla console del proprietario.
