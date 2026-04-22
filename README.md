 Zet ze in één map en open index.html in je browser. Dit is wat de app doet:
3-staps wizard:
Stap 1 — GitHub repo / leeg project / template, app naam, package ID, SDK versies, icoon upload
Stap 2 — Features (camera, locatie, Firebase, Bluetooth, biometrie…), architectuur (MVVM/Clean/MVC), Kotlin of Java
Stap 3 — Samenvatting + project genereren
Wat er echt gegenereerd wordt (downloadbare ZIP):
settings.gradle.kts, build.gradle.kts (root + app)
AndroidManifest.xml met de juiste permissies
MainActivity.kt (of .java)
MainViewModel.kt bij MVVM, repository + usecase bij Clean Architecture
activity_main.xml, strings.xml, colors.xml, themes.xml
gradle/libs.versions.toml (version catalog)
README.md + .gitignore
Python CLI (generate_project.py) voor wie liever via de terminal werkt:
Bash

python3 generate_project.py --name "Mijn App" --id com.mijn.app --features internet camera firebase
# of met config bestand:
python3 generate_project.py --config config.json