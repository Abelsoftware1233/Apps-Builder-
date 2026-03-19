Bash: plak dit lange commando in Terminal 

sudo apt update && sudo apt install -y
nodejs npm git openjdk-17-jdk && npm 
install express cors multer child_process



server.js sla dit op in Linux

const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Maak een map voor al je builds
const BASE_DIR = path.join(__dirname, 'mijn_apps');
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR);

app.post('/build', (req, res) => {
    const { repoUrl, appId, appName } = req.body;
    const projectFolder = path.join(BASE_DIR, appName.replace(/\s+/g, '_'));

    console.log(`\x1b[36m[Echo Pro]\x1b[0m Bouwen van: ${appName}`);

    // Het commando dat alles doet op Linux
    const buildCmd = `
        git clone ${repoUrl} ${projectFolder} && 
        cd ${projectFolder} && 
        npm install && 
        npm install @capacitor/core @capacitor/cli @capacitor/android && 
        npx cap init "${appName}" "${appId}" --web-dir . && 
        npx cap add android && 
        npx cap copy android
    `;

    exec(buildCmd, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Fout bij het bouwen van de mappen." });
        }
        res.json({ 
            success: true, 
            message: "Android project staat klaar!",
            location: projectFolder
        });
    });
});

app.listen(3000, () => console.log("\x1b[32m✔ Luxe Builder actief op poort 3000\x1b[0m"));


