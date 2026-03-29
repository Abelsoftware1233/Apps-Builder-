const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');

const app = express();
const upload = multer({ dest: 'uploads/' }); // Tijdelijke map voor geüploade iconen

app.use(cors());
app.use(express.json());

// Hoofdmap voor alle projecten
const BUILDS_DIR = path.join(__dirname, 'builds');
if (!fs.existsSync(BUILDS_DIR)) fs.mkdirSync(BUILDS_DIR);

/**
 * ROUTE 1: Project Genereren & Bouwen
 * Ontvangt GitHub URL, App Naam, App ID en Icoon
 */
app.post('/build', upload.single('icon'), (req, res) => {
    const { repoUrl, appId, appName } = req.body;
    const iconFile = req.file;

    if (!repoUrl || !appId || !appName) {
        return res.status(400).json({ error: "Ontbrekende gegevens. Vul alles in." });
    }

    // Unieke mapnaam maken op basis van tijdstip
    const projectID = `app_${Date.now()}`;
    const projectPath = path.join(BUILDS_DIR, projectID);

    console.log(`🚀 Start bouwproces voor: ${appName} (${appId})`);

    // Commando-reeks voor Capacitor integratie
    // 1. Clone repo -> 2. Install deps -> 3. Capacitor init -> 4. Android toevoegen
    const buildCommand = `
        git clone ${repoUrl} ${projectPath} && 
        cd ${projectPath} && 
        npm install --quiet && 
        npx cap init "${appName}" "${appId}" --web-dir . --confirm && 
        npx cap add android && 
        npx cap copy android
    `;

    exec(buildCommand, (err, stdout, stderr) => {
        if (err) {
            console.error("Fout tijdens build:", stderr);
            return res.status(500).json({ error: "Fout bij initialisatie van Capacitor/Android." });
        }

        // Als er een icoon is meegegeven, kopieer deze naar de projectmap
        if (iconFile) {
            const iconDest = path.join(projectPath, 'app_icon_source.png');
            fs.moveSync(iconFile.path, iconDest, { overwrite: true });
            console.log("✅ Icoon bronbestand toegevoegd aan project.");
        }

        console.log(`✅ Project gereed in: ${projectPath}`);
        
        res.json({ 
            success: true, 
            message: "Project succesvol klaargezet in je Linux-omgeving!",
            location: projectPath,
            projectID: projectID
        });
    });
});

/**
 * ROUTE 2: APK Downloaden (nadat je Gradle hebt gedraaid)
 * Gebruik dit nadat je in Android Studio op 'Build APK' hebt geklikt
 */
app.get('/download-apk/:projectID', (req, res) => {
    const projectID = req.params.projectID;
    
    // Standaard Gradle output pad voor debug APK's
    const apkPath = path.join(BUILDS_DIR, projectID, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

    if (fs.existsSync(apkPath)) {
        res.download(apkPath, `builder_${projectID}.apk`);
    } else {
        res.status(404).json({ 
            error: "APK nog niet gevonden.", 
            instructions: "Open het project in Android Studio en draai 'Build -> Build Bundle(s) / APK(s) -> Build APK(s)'" 
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`\n=========================================`);
    console.log(`🚀 Chromebook Builder Server is LIVE`);
    console.log(`📡 Poort: ${PORT}`);
    console.log(`📂 Projecten map: ${BUILDS_DIR}`);
    console.log(`=========================================\n`);
});
