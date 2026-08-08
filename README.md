# Android App Pro Builder

Een 3-staps wizard om Android projectstructuren te genereren.

- **Stap 1** — GitHub repo / leeg project / template, app naam, package ID, SDK versies, icoon upload
- **Stap 2** — Features (camera, locatie, Firebase, Bluetooth, biometrie…), architectuur (MVVM/Clean/MVC), Kotlin of Java
- **Stap 3** — Samenvatting + project genereren

Wat er echt gegenereerd wordt (downloadbare ZIP):
- `settings.gradle.kts`, `build.gradle.kts` (root + app)
- `AndroidManifest.xml` met de juiste permissies
- `MainActivity.kt` (of `.java`)
- `MainViewModel.kt` bij MVVM, repository + usecase bij Clean Architecture
- `activity_main.xml`, `strings.xml`, `colors.xml`, `themes.xml`
- `gradle/libs.versions.toml` (version catalog)
- `README.md` + `.gitignore`

## Gebruik zonder backend (puur browser)

Zet `index.html`, `style.css` en `script.js` in één map en open `index.html` in je browser.
De ZIP wordt dan volledig client-side opgebouwd (via JSZip, vanaf een CDN).

> Let op: zonder backend werkt de GitHub-import knop niet (die heeft de server nodig
> om de GitHub API aan te roepen zonder CORS-problemen en zonder je token bloot te geven
> in de browser-devtools van een gedeelde machine).

## Gebruik met backend (aanbevolen)

De backend voegt twee dingen toe:
1. **Server-side projectgeneratie** via `/api/generate` — dezelfde output als de browser,
   maar validatie en generatie gebeuren op de server.
2. **GitHub repo import** via `/api/github-import` — haalt metadata op (naam, beschrijving,
   taal, default branch) van een publieke of private (met token) GitHub repo, en vult
   automatisch een voorgestelde app-naam en package ID in.

### Starten

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate   # optioneel maar aanbevolen
pip install -r requirements.txt
python3 app.py
```

De server draait dan op `http://127.0.0.1:5050`. Open daarna `index.html` — de front-end
detecteert automatisch of hij op `localhost`/`127.0.0.1` draait en praat dan met de
backend. Is de backend niet bereikbaar, dan valt de app automatisch terug op client-side
generatie (er verschijnt een toast-melding).

### Endpoints

| Methode | Pad                    | Omschrijving                                   |
|---------|-------------------------|-------------------------------------------------|
| GET     | `/api/health`           | Health check                                    |
| POST    | `/api/generate`         | Genereert het project, retourneert een ZIP      |
| POST    | `/api/github-import`    | Haalt GitHub repo metadata op                   |

**`/api/generate`** verwacht JSON:
```json
{
  "app_name": "Mijn App",
  "app_id": "com.mijn.app",
  "lang": "kotlin",
  "arch": "mvvm",
  "min_sdk": 26,
  "target_sdk": 34,
  "features": ["internet", "camera", "firebase"]
}
```

**`/api/github-import`** verwacht JSON:
```json
{ "repo_url": "https://github.com/gebruiker/repo", "token": "" }
```

### Productie

Voor productie: draai niet de Flask dev-server, maar gunicorn (zit al in `requirements.txt`):
```bash
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## Python CLI

Voor wie liever via de terminal werkt (gebruikt dezelfde generatielogica als de backend):

```bash
python3 generate_project.py --name "Mijn App" --id com.mijn.app --features internet camera firebase
# of met config bestand:
python3 generate_project.py --config config.json
```
