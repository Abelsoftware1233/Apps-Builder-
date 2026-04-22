// ===== ANDROID APP PRO BUILDER — script.js =====

let currentStep = 1;
let selectedTemplate = 'basic';
let iconDataUrl = null;
let generatedFiles = {};

// ===== NAVIGATION =====
function goToStep(step) {
  if (step > currentStep && !validateStep(currentStep)) return;

  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = step === 'result' ? 'stepResult' : 'step' + step;
  document.getElementById(target).classList.add('active');

  // Update progress bar
  document.querySelectorAll('.prog-step').forEach(s => {
    const n = parseInt(s.dataset.step);
    s.classList.remove('active','done');
    if (typeof step === 'number') {
      if (n < step) s.classList.add('done');
      if (n === step) s.classList.add('active');
    }
  });

  if (step === 3) buildSummary();
  currentStep = step;
}

function validateStep(step) {
  if (step === 1) {
    const name = document.getElementById('appName').value.trim();
    const id = document.getElementById('appId').value.trim();
    if (!name) { showToast('⚠️ Voer een App Naam in!'); return false; }
    if (!id || !id.includes('.')) { showToast('⚠️ Voer een geldig App ID in (bijv. com.mijn.app)'); return false; }
  }
  return true;
}

// ===== TABS =====
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ===== TEMPLATES =====
document.querySelectorAll('.template-card').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    selectedTemplate = card.dataset.tpl;
  });
});

// ===== ICON UPLOAD =====
const iconFile = document.getElementById('iconFile');
const fileDrop = document.getElementById('fileDrop');

iconFile.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) loadIcon(file);
});

fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('drag'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('drag'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault(); fileDrop.classList.remove('drag');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadIcon(file);
});

function loadIcon(file) {
  const reader = new FileReader();
  reader.onload = e => {
    iconDataUrl = e.target.result;
    const preview = document.getElementById('iconPreview');
    preview.innerHTML = `<img src="${iconDataUrl}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;" />`;
    showToast('✅ Icoon geladen!');
  };
  reader.readAsDataURL(file);
}

// ===== SUMMARY =====
function buildSummary() {
  const appName = document.getElementById('appName').value;
  const appId = document.getElementById('appId').value;
  const minSdk = document.getElementById('minSdk').value;
  const targetSdk = document.getElementById('targetSdk').value;
  const lang = document.querySelector('input[name="lang"]:checked').value;
  const arch = document.querySelector('input[name="arch"]:checked').value;
  const features = getSelectedFeatures();

  document.getElementById('summary').innerHTML = `
    <div class="summary-row"><span class="summary-key">App Naam</span><span class="summary-val">${appName}</span></div>
    <div class="summary-row"><span class="summary-key">App ID</span><span class="summary-val">${appId}</span></div>
    <div class="summary-row"><span class="summary-key">Taal</span><span class="summary-val">${lang === 'kotlin' ? 'Kotlin' : 'Java'}</span></div>
    <div class="summary-row"><span class="summary-key">Architectuur</span><span class="summary-val">${arch.toUpperCase()}</span></div>
    <div class="summary-row"><span class="summary-key">SDK</span><span class="summary-val">Min ${minSdk} / Target ${targetSdk}</span></div>
    <div class="summary-row"><span class="summary-key">Features</span><span class="summary-val">${features.length > 0 ? features.join(', ') : 'Geen extra'}</span></div>
  `;
}

function getSelectedFeatures() {
  const features = [];
  if (document.getElementById('feat-internet').checked) features.push('Internet');
  if (document.getElementById('feat-camera').checked) features.push('Camera');
  if (document.getElementById('feat-storage').checked) features.push('Opslag');
  if (document.getElementById('feat-location').checked) features.push('Locatie');
  if (document.getElementById('feat-push').checked) features.push('Push');
  if (document.getElementById('feat-bluetooth').checked) features.push('Bluetooth');
  if (document.getElementById('feat-biometric').checked) features.push('Biometrie');
  if (document.getElementById('feat-firebase').checked) features.push('Firebase');
  return features;
}

// ===== PROJECT GENERATOR =====
async function generateProject() {
  const btn = document.getElementById('generateBtn');
  const btnText = document.getElementById('genBtnText');
  btn.classList.add('loading');
  btnText.textContent = '⚙️ Project wordt aangemaakt...';

  const appName = document.getElementById('appName').value.trim();
  const appId = document.getElementById('appId').value.trim();
  const minSdk = document.getElementById('minSdk').value;
  const targetSdk = document.getElementById('targetSdk').value;
  const lang = document.querySelector('input[name="lang"]:checked').value;
  const arch = document.querySelector('input[name="arch"]:checked').value;

  const packagePath = appId.replace(/\./g, '/');
  const ext = lang === 'kotlin' ? 'kt' : 'java';
  const isKotlin = lang === 'kotlin';

  // Simulate generation steps
  const steps = ['Gradle bestanden...', 'Manifest...', 'MainActivity...', 'Resources...', 'Structuur afronden...'];
  for (const s of steps) {
    btnText.textContent = '⚙️ ' + s;
    await sleep(300);
  }

  // Generate all files
  generatedFiles = generateAllFiles(appName, appId, packagePath, minSdk, targetSdk, isKotlin, arch, ext);

  // Show result
  btn.classList.remove('loading');
  renderResult(appName, appId, packagePath, ext);
  goToStep('result');
  document.querySelectorAll('.prog-step').forEach(s => s.classList.add('done'));
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function generateAllFiles(appName, appId, packagePath, minSdk, targetSdk, isKotlin, arch, ext) {
  const features = getSelectedFeatures();
  const hasFirebase = features.includes('Firebase');
  const hasInternet = features.includes('Internet');
  const hasCamera = features.includes('Camera');
  const hasLocation = features.includes('Locatie');
  const hasStorage = features.includes('Opslag');
  const hasPush = features.includes('Push');
  const hasBluetooth = features.includes('Bluetooth');
  const hasBiometric = features.includes('Biometrie');
  const readme = document.getElementById('opt-readme').checked;
  const gitignore = document.getElementById('opt-gitignore').checked;

  const files = {};

  // --- settings.gradle.kts ---
  files['settings.gradle.kts'] = `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "${appName}"
include(":app")
`;

  // --- build.gradle.kts (root) ---
  files['build.gradle.kts'] = `plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    ${hasFirebase ? 'alias(libs.plugins.google.services) apply false' : ''}
}
`;

  // --- gradle.properties ---
  files['gradle.properties'] = `android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
`;

  // --- app/build.gradle.kts ---
  const dependencies = buildDependencies(hasFirebase, hasBiometric, arch, isKotlin);
  files['app/build.gradle.kts'] = `plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    ${hasFirebase ? "alias(libs.plugins.google.services)" : ''}
    ${arch === 'mvvm' ? "id(\"kotlin-kapt\")" : ''}
}

android {
    namespace = "${appId}"
    compileSdk = ${targetSdk}

    defaultConfig {
        applicationId = "${appId}"
        minSdk = ${minSdk}
        targetSdk = ${targetSdk}
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }
    kotlinOptions { jvmTarget = "1.8" }
    buildFeatures { viewBinding = true }
}

dependencies {
${dependencies}
}
`;

  // --- AndroidManifest.xml ---
  const permissions = buildPermissions(hasInternet, hasCamera, hasLocation, hasStorage, hasBluetooth, hasBiometric);
  files[`app/src/main/AndroidManifest.xml`] = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
${permissions}
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.${appName.replace(/\s/g, '')}">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        ${hasPush ? '<service android:name=".service.PushNotificationService" android:exported="false"><intent-filter><action android:name="com.google.firebase.MESSAGING_EVENT"/></intent-filter></service>' : ''}
    </application>
</manifest>
`;

  // --- MainActivity ---
  if (isKotlin) {
    files[`app/src/main/java/${packagePath}/MainActivity.kt`] = generateMainActivityKotlin(appId, arch);
  } else {
    files[`app/src/main/java/${packagePath}/MainActivity.java`] = generateMainActivityJava(appId, arch);
  }

  // --- ViewModel (if MVVM) ---
  if (arch === 'mvvm' && isKotlin) {
    files[`app/src/main/java/${packagePath}/viewmodel/MainViewModel.kt`] = `package ${appId}.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class MainViewModel : ViewModel() {
    private val _message = MutableLiveData<String>()
    val message: LiveData<String> = _message

    init {
        _message.value = "Welkom bij ${appName}!"
    }

    fun updateMessage(text: String) {
        _message.value = text
    }
}
`;
  }

  // --- Repository (if Clean Architecture) ---
  if (arch === 'clean' && isKotlin) {
    files[`app/src/main/java/${packagePath}/data/repository/MainRepository.kt`] = `package ${appId}.data.repository

class MainRepository {
    fun getData(): String {
        // TODO: Implementeer je data source hier
        return "Data van repository"
    }
}
`;
    files[`app/src/main/java/${packagePath}/domain/usecase/GetDataUseCase.kt`] = `package ${appId}.domain.usecase

import ${appId}.data.repository.MainRepository

class GetDataUseCase(private val repository: MainRepository) {
    operator fun invoke(): String = repository.getData()
}
`;
  }

  // --- activity_main.xml ---
  files[`app/src/main/res/layout/activity_main.xml`] = `<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/background">

    <com.google.android.material.appbar.AppBarLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content">
        <com.google.android.material.appbar.MaterialToolbar
            android:id="@+id/toolbar"
            android:layout_width="match_parent"
            android:layout_height="?attr/actionBarSize"
            app:title="@string/app_name" />
    </com.google.android.material.appbar.AppBarLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:gravity="center"
        android:padding="24dp"
        app:layout_behavior="@string/appbar_scrolling_view_behavior">

        <ImageView
            android:layout_width="120dp"
            android:layout_height="120dp"
            android:src="@mipmap/ic_launcher_round"
            android:layout_marginBottom="24dp"/>

        <TextView
            android:id="@+id/tvMessage"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="@string/welcome_message"
            android:textSize="22sp"
            android:textStyle="bold"
            android:textColor="@color/text_primary"
            android:gravity="center"
            android:layout_marginBottom="16dp"/>

        <com.google.android.material.button.MaterialButton
            android:id="@+id/btnAction"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="@string/btn_action"
            android:paddingHorizontal="32dp" />
    </LinearLayout>
</androidx.coordinatorlayout.widget.CoordinatorLayout>
`;

  // --- strings.xml ---
  files[`app/src/main/res/values/strings.xml`] = `<resources>
    <string name="app_name">${appName}</string>
    <string name="welcome_message">Welkom bij ${appName}!</string>
    <string name="btn_action">Aan de slag</string>
</resources>
`;

  // --- colors.xml ---
  files[`app/src/main/res/values/colors.xml`] = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#1976D2</color>
    <color name="colorPrimaryDark">#1565C0</color>
    <color name="colorAccent">#42A5F5</color>
    <color name="background">#FAFAFA</color>
    <color name="text_primary">#212121</color>
    <color name="text_secondary">#757575</color>
</resources>
`;

  // --- themes.xml ---
  const appNameSafe = appName.replace(/\s/g, '');
  files[`app/src/main/res/values/themes.xml`] = `<resources>
    <style name="Theme.${appNameSafe}" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryVariant">@color/colorPrimaryDark</item>
        <item name="colorOnPrimary">@android:color/white</item>
        <item name="colorSecondary">@color/colorAccent</item>
        <item name="android:statusBarColor">@color/colorPrimary</item>
    </style>
</resources>
`;

  // --- proguard-rules.pro ---
  files['app/proguard-rules.pro'] = `# Voeg projectspecifieke ProGuard regels hier toe
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception
${hasFirebase ? '-keep class com.google.firebase.** { *; }' : ''}
`;

  // --- README.md ---
  if (document.getElementById('opt-readme').checked) {
    files['README.md'] = generateReadme(appName, appId, minSdk, targetSdk, isKotlin, arch, getSelectedFeatures());
  }

  // --- .gitignore ---
  if (document.getElementById('opt-gitignore').checked) {
    files['.gitignore'] = `*.iml
.gradle
/local.properties
/.idea
.DS_Store
/build
/captures
.externalNativeBuild
.cxx
local.properties
*.keystore
google-services.json
`;
  }

  // --- libs.versions.toml ---
  files['gradle/libs.versions.toml'] = generateVersionCatalog(hasFirebase, hasBiometric, arch);

  return files;
}

function buildPermissions(internet, camera, location, storage, bluetooth, biometric) {
  let perms = '';
  if (internet) perms += '    <uses-permission android:name="android.permission.INTERNET" />\n';
  if (camera) perms += '    <uses-permission android:name="android.permission.CAMERA" />\n';
  if (location) perms += '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n';
  if (storage) perms += '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />\n    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="28" />\n';
  if (bluetooth) perms += '    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />\n    <uses-permission android:name="android.permission.BLUETOOTH_SCAN" />\n';
  if (biometric) perms += '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n';
  return perms;
}

function buildDependencies(firebase, biometric, arch, isKotlin) {
  let deps = `    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
`;
  if (arch === 'mvvm' || arch === 'clean') {
    deps += `    implementation(libs.lifecycle.viewmodel.ktx)
    implementation(libs.lifecycle.livedata.ktx)
`;
  }
  if (firebase) {
    deps += `    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.analytics)
    implementation(libs.firebase.auth)
    implementation(libs.firebase.firestore)
`;
  }
  if (biometric) {
    deps += `    implementation(libs.biometric)\n`;
  }
  return deps;
}

function generateVersionCatalog(firebase, biometric, arch) {
  return `[versions]
agp = "8.5.0"
kotlin = "2.0.0"
coreKtx = "1.13.1"
appcompat = "1.7.0"
material = "1.12.0"
constraintlayout = "2.1.4"
junit = "4.13.2"
junitVersion = "1.2.1"
espressoCore = "3.6.1"
${(arch === 'mvvm' || arch === 'clean') ? 'lifecycle = "2.8.4"' : ''}
${firebase ? 'firebaseBom = "33.1.2"' : ''}
${biometric ? 'biometric = "1.1.0"' : ''}

[libraries]
androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }
androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }
material = { group = "com.google.android.material", name = "material", version.ref = "material" }
androidx-constraintlayout = { group = "androidx.constraintlayout", name = "constraintlayout", version.ref = "constraintlayout" }
junit = { group = "junit", name = "junit", version.ref = "junit" }
androidx-junit = { group = "androidx.test.ext", name = "junit", version.ref = "junitVersion" }
androidx-espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version.ref = "espressoCore" }
${(arch === 'mvvm' || arch === 'clean') ? `lifecycle-viewmodel-ktx = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-ktx", version.ref = "lifecycle" }
lifecycle-livedata-ktx = { group = "androidx.lifecycle", name = "lifecycle-livedata-ktx", version.ref = "lifecycle" }` : ''}
${firebase ? `firebase-bom = { group = "com.google.firebase", name = "firebase-bom", version.ref = "firebaseBom" }
firebase-analytics = { group = "com.google.firebase", name = "firebase-analytics" }
firebase-auth = { group = "com.google.firebase", name = "firebase-auth" }
firebase-firestore = { group = "com.google.firebase", name = "firebase-firestore" }` : ''}
${biometric ? `biometric = { group = "androidx.biometric", name = "biometric", version.ref = "biometric" }` : ''}

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
${firebase ? 'google-services = { id = "com.google.gms.google-services", version = "4.4.2" }' : ''}
`;
}

function generateMainActivityKotlin(appId, arch) {
  return `package ${appId}

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
${arch === 'mvvm' ? `import androidx.activity.viewModels\nimport ${appId}.viewmodel.MainViewModel` : ''}
import ${appId}.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    ${arch === 'mvvm' ? 'private val viewModel: MainViewModel by viewModels()' : ''}

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        ${arch === 'mvvm' ? `viewModel.message.observe(this) { msg ->
            binding.tvMessage.text = msg
        }` : 'binding.tvMessage.text = "Welkom!"'}

        binding.btnAction.setOnClickListener {
            Toast.makeText(this, "Hoi! 👋", Toast.LENGTH_SHORT).show()
            ${arch === 'mvvm' ? 'viewModel.updateMessage("Je hebt geklikt!")' : ''}
        }
    }
}
`;
}

function generateMainActivityJava(appId, arch) {
  return `package ${appId};

import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import ${appId}.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {
    private ActivityMainBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        setSupportActionBar(binding.toolbar);

        binding.tvMessage.setText("Welkom!");

        binding.btnAction.setOnClickListener(v -> {
            Toast.makeText(this, "Hoi! 👋", Toast.LENGTH_SHORT).show();
        });
    }
}
`;
}

function generateReadme(appName, appId, minSdk, targetSdk, isKotlin, arch, features) {
  return `# ${appName}

![Android](https://img.shields.io/badge/Android-API${minSdk}+-3DDC84?logo=android&logoColor=white)
![Language](https://img.shields.io/badge/Language-${isKotlin ? 'Kotlin' : 'Java'}-${isKotlin ? 'F48024' : '5A7ABC'}?logo=${isKotlin ? 'kotlin' : 'java'}&logoColor=white)
![Architecture](https://img.shields.io/badge/Architecture-${arch.toUpperCase()}-blue)

## 📱 Over deze app

**Package:** \`${appId}\`
**Min SDK:** API ${minSdk} | **Target SDK:** API ${targetSdk}
**Taal:** ${isKotlin ? 'Kotlin' : 'Java'} | **Architectuur:** ${arch.toUpperCase()}

${features.length > 0 ? `## ✨ Features\n${features.map(f => `- ${f}`).join('\n')}` : ''}

## 🚀 Aan de slag

### Vereisten
- Android Studio Hedgehog (2023.1.1) of nieuwer
- JDK 17+
- Android SDK API ${targetSdk}

### Installatie
\`\`\`bash
git clone <jouw-repo-url>
cd ${appName.toLowerCase().replace(/\s/g, '-')}
\`\`\`

Open het project in Android Studio en klik op **Run ▶️**

## 📂 Projectstructuur

\`\`\`
app/
├── src/main/
│   ├── java/${appId.replace(/\./g, '/')}/
│   │   ├── MainActivity.${isKotlin ? 'kt' : 'java'}
│   │   ${arch === 'mvvm' ? '├── viewmodel/MainViewModel.kt' : ''}
│   │   ${arch === 'clean' ? '├── data/repository/\n│   │   └── domain/usecase/' : ''}
│   ├── res/
│   │   ├── layout/activity_main.xml
│   │   └── values/
│   └── AndroidManifest.xml
\`\`\`

## 📄 Licentie
MIT License — vrij te gebruiken en aanpassen.

---
*Gegenereerd met Android App Pro Builder ⚡*
`;
}

// ===== RENDER RESULT =====
function renderResult(appName, appId, packagePath, ext) {
  document.getElementById('resultAppName').textContent = appId;

  // Build file tree HTML
  const treeEl = document.getElementById('fileTree');
  const entries = Object.keys(generatedFiles);

  // Build tree structure
  const tree = {};
  entries.forEach(path => {
    const parts = path.split('/');
    let node = tree;
    parts.forEach((part, i) => {
      if (!node[part]) node[part] = i === parts.length - 1 ? null : {};
      node = node[part] || {};
    });
  });

  treeEl.innerHTML = renderTree(tree, '');

  // Setup guide
  const isKotlin = document.querySelector('input[name="lang"]:checked').value === 'kotlin';
  document.getElementById('setupSteps').innerHTML = `
    <div class="setup-step">
      <div class="setup-num">1</div>
      <div>
        <div>Download en uitpakken van de ZIP</div>
        <span class="setup-cmd">unzip ${appName.replace(/\s/g,'-')}.zip -d ${appName.replace(/\s/g,'-')}</span>
      </div>
    </div>
    <div class="setup-step">
      <div class="setup-num">2</div>
      <div>Open Android Studio → <strong>Open an existing project</strong> → selecteer de map</div>
    </div>
    <div class="setup-step">
      <div class="setup-num">3</div>
      <div>
        <div>Wacht tot Gradle sync voltooid is, dan:</div>
        <span class="setup-cmd">Run → Run 'app' (Shift+F10)</span>
      </div>
    </div>
    <div class="setup-step">
      <div class="setup-num">4</div>
      <div>Kies een emulator of sluit een Android-telefoon aan via USB (USB-debugging inschakelen)</div>
    </div>
  `;

  // Download button
  document.getElementById('downloadBtn').onclick = () => downloadZip(appName);
}

function renderTree(node, prefix) {
  let html = '';
  const keys = Object.keys(node).sort((a, b) => {
    const aIsDir = node[a] !== null && typeof node[a] === 'object';
    const bIsDir = node[b] !== null && typeof node[b] === 'object';
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  keys.forEach((key, i) => {
    const isLast = i === keys.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const child = node[key];
    const isDir = child !== null && typeof child === 'object';
    const ext = key.split('.').pop();

    let cls = 'file';
    if (isDir) cls = 'dir';
    else if (ext === 'kt') cls = 'file kotlin';
    else if (ext === 'xml') cls = 'file xml';
    else if (ext === 'kts' || key === 'build.gradle') cls = 'file gradle';

    html += `<div>${prefix}${connector}<span class="${cls}">${isDir ? '📁 ' : ''}${key}</span></div>`;
    if (isDir) {
      html += renderTree(child, prefix + (isLast ? '    ' : '│   '));
    }
  });
  return html;
}

// ===== DOWNLOAD ZIP =====
async function downloadZip(appName) {
  // Use JSZip via CDN if available, otherwise create a fake download
  showToast('📦 ZIP wordt voorbereid...');

  // Check if JSZip is available
  if (typeof JSZip === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  }

  const zip = new JSZip();
  const folderName = appName.replace(/\s/g, '-');
  const folder = zip.folder(folderName);

  for (const [path, content] of Object.entries(generatedFiles)) {
    folder.file(path, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${folderName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ ZIP gedownload!');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

// ===== COPY STRUCTURE =====
function copyStructure() {
  const text = Object.keys(generatedFiles).join('\n');
  navigator.clipboard.writeText(text).then(() => showToast('📋 Structuur gekopieerd!'));
}

// ===== RESTART =====
function restartBuilder() {
  document.querySelectorAll('input[type="text"], input[type="password"]').forEach(i => i.value = '');
  document.getElementById('iconPreview').innerHTML = '🖼️';
  iconDataUrl = null;
  generatedFiles = {};
  goToStep(1);
  document.querySelectorAll('.prog-step').forEach((s, i) => {
    s.classList.remove('done', 'active');
    if (i === 0) s.classList.add('active');
  });
}

// ===== TOAST =====
function showToast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3100);
}

// ===== AUTO APP ID =====
document.getElementById('appName').addEventListener('input', e => {
  const name = e.target.value.trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  if (name && !document.getElementById('appId').value.includes(name)) {
    document.getElementById('appId').placeholder = `com.example.${name || 'app'}`;
  }
});

// Init
goToStep(1);
