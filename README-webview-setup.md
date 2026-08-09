# Web2App Pro — APK-build server setup

Deze uitbreiding laat de backend een **echte, installeerbare APK** bouwen
(debug-ondertekend) van een Web2App WebView-project. Dat vereist een
Android build-omgeving op je server — dat kan niet in een gewone Flask-app
zonder deze installatie.

## Snelstart (aanbevolen)

Er is een setup-script dat stap 1 t/m 3 hieronder automatisch doorloopt:

```bash
cd backend
chmod +x setup_build_server.sh
./setup_build_server.sh
```

Draai dit als gewone gebruiker (niet als root, geen `sudo ./setup...`) —
het script gebruikt zelf `sudo` waar nodig. Herstart daarna je shell
(`source ~/.bashrc`) en ga direct naar
[Stap 4 — Backend starten](#stap-4--backend-starten-met-de-juiste-omgeving).

Wil je liever alles handmatig en stap voor stap doen (bijvoorbeeld om te
snappen wat er precies gebeurt, of omdat je afwijkt van Ubuntu), volg dan
de losse stappen hieronder — dat is exact wat het script automatiseert.

## Wat je nodig hebt op je VPS

- Linux server (Ubuntu 22.04/24.04 aanbevolen), min. 4 GB RAM, 10+ GB vrije schijfruimte
- JDK 17
- Android SDK command-line tools
- Internettoegang (voor Gradle dependencies bij elke build — je kan dit
  cachen, zie onderaan)

## Stap 1 — JDK installeren

```bash
sudo apt update
sudo apt install -y openjdk-17-jdk unzip

java -version   # moet 17.x tonen
```

## Stap 2 — Android SDK command-line tools installeren

```bash
mkdir -p ~/android-sdk/cmdline-tools
cd ~/android-sdk/cmdline-tools
curl -O https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip commandlinetools-linux-11076708_latest.zip
mv cmdline-tools latest
```

> Controleer op https://developer.android.com/studio#command-tools of dit
> nog de laatste versie/URL is — Google werkt dit regelmatig bij.

Zet de omgevingsvariabelen (voeg toe aan `~/.bashrc` én aan de systemd
service die straks de Flask-app draait):

```bash
export ANDROID_HOME=$HOME/android-sdk
export ANDROID_SDK_ROOT=$HOME/android-sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
```

Installeer de benodigde SDK-componenten (accepteer de licenties):

```bash
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
```

## Stap 3 — gradle-wrapper.jar genereren (eenmalig, belangrijk!)

De backend levert `gradlew`, `gradlew.bat` en `gradle-wrapper.properties`
al mee in `backend/gradle_wrapper_template/`, maar **niet**
`gradle-wrapper.jar` — dat is een binair bestand dat ik in mijn
ontwikkelomgeving niet kon genereren (geen Gradle/internet beschikbaar
daar). Jij moet dit één keer doen op je eigen server, met een lokale
Gradle-installatie:

```bash
# Gradle tijdelijk installeren om de wrapper te genereren
sudo apt install -y gradle   # of via sdkman: sdk install gradle 8.7

cd backend/gradle_wrapper_template
gradle wrapper --gradle-version 8.7
```

Dit genereert `gradle/wrapper/gradle-wrapper.jar` in die map. Vanaf dat
moment is het sjabloon compleet en gebruikt de backend het voor elk
gegenereerd Web2App-project. Je hoeft dit maar één keer te doen — het
wrapper-jar verandert niet tussen builds.

Controleer dat het gelukt is:
```bash
ls -la backend/gradle_wrapper_template/gradle/wrapper/
# moet gradle-wrapper.jar en gradle-wrapper.properties tonen
chmod +x backend/gradle_wrapper_template/gradlew
```

## Stap 4 — Backend starten met de juiste omgeving

```bash
cd backend
pip install -r requirements.txt
export ANDROID_HOME=$HOME/android-sdk
export ANDROID_SDK_ROOT=$HOME/android-sdk
python3 app.py
```

De backend checkt bij elke build-aanvraag of `ANDROID_HOME` of
`ANDROID_SDK_ROOT` gezet is — zo niet, dan krijg je een duidelijke
foutmelding via de API in plaats van een cryptische Gradle-crash.

## Stap 5 — Testen

```bash
curl -X POST http://127.0.0.1:5000/api/build-apk \
  -H "Content-Type: application/json" \
  -d '{"app_name":"Test Site","app_id":"com.test.web2app","url":"https://example.com"}'
# -> {"job_id": "...", "status": "queued"}

curl http://127.0.0.1:5000/api/build-apk/<job_id>/status
# -> {"status": "building" | "done" | "error", ...}

curl -o app-debug.apk http://127.0.0.1:5000/api/build-apk/<job_id>/download
```

De eerste build duurt typisch 2-5 minuten (Gradle downloadt dependencies).
Latere builds zijn sneller omdat Gradle/Maven caches hergebruikt worden
(zorg dat de gebruiker die de Flask-app draait consistent blijft, zodat
`~/.gradle` en `~/.m2` niet steeds opnieuw opgebouwd worden).

## App-icoon

Elk gegenereerd Web2App-project krijgt automatisch een app-icoon: een
gekleurd vlak met de eerste letter van de app-naam, gerenderd als PNG met
Pillow (staat in `requirements.txt`). Zonder Pillow op de server valt de
generator terug op een simpele vector-vorm — de build faalt dus nooit door
een ontbrekend icoon, maar het resultaat is mooier met Pillow geïnstalleerd.

## Resource-overwegingen

- Elke build draait `gradlew assembleDebug` — dit kost CPU en RAM
  (typisch 1-2 GB per build). Draai niet te veel builds tegelijk op een
  kleine VPS.
- De huidige implementatie draait builds in Python-threads zonder limiet
  op gelijktijdigheid. Voor productiegebruik met meerdere gebruikers:
  voeg een wachtrij/worker-limiet toe (bijv. met Celery of een simpele
  semaphore) zodat niet 10 builds tegelijk je server platleggen.
- Elke voltooide build ruimt zijn eigen projectmap op, maar de gebouwde
  APK's in `/tmp/web2app_builds/<job_id>/` blijven staan totdat je ze
  handmatig opruimt of een cronjob toevoegt.

## Troubleshooting

| Foutmelding | Oorzaak | Oplossing |
|---|---|---|
| `gradlew niet gevonden` | wrapper-sjabloon mist | Check Stap 3 |
| `ANDROID_HOME/ANDROID_SDK_ROOT is niet ingesteld` | env var niet zichtbaar voor het Flask-process | Zet de export ook in de systemd service-file, niet alleen `.bashrc` |
| Build faalt met "SDK location not found" | `local.properties` ontbreekt | Gradle vindt de SDK meestal via `ANDROID_HOME`; zo niet, voeg `sdk.dir=/pad/naar/android-sdk` toe aan een `local.properties` in het gegenereerde project (kan je toevoegen in `_write_files_to_disk` in `app.py`) |
| Build blijft hangen | Eerste keer, Gradle download | Normaal, kan enkele minuten duren; timeout staat op 15 min |
