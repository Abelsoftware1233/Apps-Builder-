# 🚀 Pro: Android App Builder (Chromebook Edition)

Dit project is een luxe, onafhankelijke "App Geyser" kloon waarmee je elke GitHub Web Repository kunt omzetten naar een native Android project ($APK$), direct op je Chromebook. **100% Gratis, geen limieten.**

---

## 🛠️ Benodigdheden
Voordat je begint, moet de **Linux-omgeving** op je Chromebook geactiveerd zijn (Instellingen > Ontwikkelaars > Linux).

### Eenmalige Installatie
Open je Linux Terminal en voer het volgende commando uit om de "motor" te installeren:
```bash
sudo apt update && sudo apt install -y nodejs npm git openjdk-17-jdk


Ga naar je projectmap en installeer de Node.js pakketten:

npm install


🚀 Snelstartgids (De 3 Gouden Commando's)
1. De Motor Starten
Elke keer als je apps wilt bouwen, start je de server in de terminal:

De server draait nu op http://localhost:3000.

2. Je IP-Adres Checken
Wil je de app direct op je telefoon downloaden via je eigen netwerk? Typ:

hostname -I


3. Schoonmaken
Chromebook vol? Verwijder oude builds met:


npm run clean


📱 Hoe bouw je een App?
Open de Interface: Ga naar je GitHub Pages URL of open index.html.
Gegevens Invullen: - Plak de GitHub URL van je webproject.
Kies een App Naam en een uniek App ID (bijv. com.echo.mijnapp).
Selecteer een Icoon (optioneel).
Converteer: Klik op "CONVERTEER NU". Je Linux-omgeving clonet nu de code en maakt de Android-bestanden aan.
Bak de APK: - Open de officiële Android Studio op je Chromebook.
Kies 'Open Project' en ga naar Linux-bestanden > mijn_apps > [Jouw App].
Ga naar Build > Build APK(s).

📂 Projectstructuur
index.html & script.js: De luxe interface (Frontend).
server.js: De "motor" die het zware werk doet in Linux (Backend).
package.json: De lijst met benodigde softwarepakketten.
/mijn_apps: Hier worden je gegenereerde Android-projecten opgeslagen.

⚖️ Licentie & Eigendom
Dit systeem is gebouwd voor de  Repository. ik ben volledig eigenaar van je eigen code en de gegenereerde apps. Geen externe API's of betaalde diensten nodig.


### Hoe voeg je dit toe?
1. Maak een nieuw bestand aan in je GitHub repo genaamd `README.md`.
2. Plak de bovenstaande tekst erin.
3. Sla het op en commit de wijzigingen.

