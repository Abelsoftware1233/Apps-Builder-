#!/usr/bin/env python3
"""
Android App Pro Builder — CLI versie
Gebruik: python3 generate_project.py --name "Mijn App" --id com.mijn.app
"""

import os
import sys
import json
import shutil
import zipfile
import argparse
from pathlib import Path

# ===== CONFIGURATIE =====
DEFAULT_MIN_SDK = 26
DEFAULT_TARGET_SDK = 34

def create_project(config: dict, output_dir: str = ".", make_zip: bool = True):
    app_name = config["app_name"]
    app_id = config.get("app_id", "com.example.app")
    min_sdk = config.get("min_sdk", DEFAULT_MIN_SDK)
    target_sdk = config.get("target_sdk", DEFAULT_TARGET_SDK)
    lang = config.get("lang", "kotlin")
    arch = config.get("arch", "mvvm")
    features = config.get("features", ["internet"])

    folder_name = app_name.replace(" ", "-").lower()
    project_dir = Path(output_dir) / folder_name
    package_path = app_id.replace(".", "/")
    ext = "kt" if lang == "kotlin" else "java"
    app_name_safe = app_name.replace(" ", "")

    print(f"\n🚀 Aanmaken van project: {app_name}")
    print(f"   Package: {app_id}")
    print(f"   Taal: {lang.capitalize()} | Arch: {arch.upper()}")
    print(f"   SDK: min={min_sdk}, target={target_sdk}")
    print(f"   Features: {', '.join(features)}\n")

    if project_dir.exists():
        print(f"⚠️  Map '{project_dir}' bestaat al — wordt overschreven.")
        shutil.rmtree(project_dir)

    files = generate_all_files(app_name, app_id, package_path, min_sdk, target_sdk,
                                lang == "kotlin", arch, ext, features, app_name_safe)

    for filepath, content in files.items():
        full_path = project_dir / filepath
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(content, encoding="utf-8")
        print(f"  ✅ {filepath}")

    if make_zip:
        zip_path = Path(output_dir) / f"{folder_name}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for filepath in files:
                full_path = project_dir / filepath
                zf.write(full_path, arcname=f"{folder_name}/{filepath}")
        print(f"\n📦 ZIP opgeslagen: {zip_path}")

    print(f"\n✅ Project aangemaakt in: {project_dir}")
    print_instructions(app_name, lang)
    return str(project_dir)


def generate_all_files(app_name, app_id, package_path, min_sdk, target_sdk,
                        is_kotlin, arch, ext, features, app_name_safe):
    files = {}

    has_internet = "internet" in features
    has_camera = "camera" in features
    has_location = "location" in features
    has_storage = "storage" in features
    has_push = "push" in features
    has_bluetooth = "bluetooth" in features
    has_biometric = "biometric" in features
    has_firebase = "firebase" in features

    # --- settings.gradle.kts ---
    files["settings.gradle.kts"] = f'''pluginManagement {{
    repositories {{
        google()
        mavenCentral()
        gradlePluginPortal()
    }}
}}
dependencyResolutionManagement {{
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {{
        google()
        mavenCentral()
    }}
}}
rootProject.name = "{app_name}"
include(":app")
'''

    # --- build.gradle.kts (root) ---
    files["build.gradle.kts"] = f'''plugins {{
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    {"alias(libs.plugins.google.services) apply false" if has_firebase else ""}
}}
'''

    # --- gradle.properties ---
    files["gradle.properties"] = '''android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
'''

    # --- app/build.gradle.kts ---
    files["app/build.gradle.kts"] = generate_app_gradle(app_id, min_sdk, target_sdk,
                                                         has_firebase, has_biometric, arch)

    # --- AndroidManifest.xml ---
    files["app/src/main/AndroidManifest.xml"] = generate_manifest(
        app_id, app_name_safe, has_internet, has_camera, has_location,
        has_storage, has_push, has_bluetooth, has_biometric)

    # --- MainActivity ---
    if is_kotlin:
        files[f"app/src/main/java/{package_path}/MainActivity.kt"] = generate_main_kotlin(app_id, arch)
    else:
        files[f"app/src/main/java/{package_path}/MainActivity.java"] = generate_main_java(app_id)

    # --- ViewModel (MVVM) ---
    if arch == "mvvm" and is_kotlin:
        files[f"app/src/main/java/{package_path}/viewmodel/MainViewModel.kt"] = f'''package {app_id}.viewmodel

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel

class MainViewModel : ViewModel() {{
    private val _message = MutableLiveData<String>()
    val message: LiveData<String> = _message

    init {{ _message.value = "Welkom bij {app_name}!" }}

    fun updateMessage(text: String) {{ _message.value = text }}
}}
'''

    # --- Clean Architecture ---
    if arch == "clean" and is_kotlin:
        files[f"app/src/main/java/{package_path}/data/repository/MainRepository.kt"] = f'''package {app_id}.data.repository

class MainRepository {{
    fun getData(): String = "Data van repository"
}}
'''
        files[f"app/src/main/java/{package_path}/domain/usecase/GetDataUseCase.kt"] = f'''package {app_id}.domain.usecase

import {app_id}.data.repository.MainRepository

class GetDataUseCase(private val repository: MainRepository) {{
    operator fun invoke(): String = repository.getData()
}}
'''

    # --- Layout ---
    files["app/src/main/res/layout/activity_main.xml"] = generate_layout()

    # --- Resources ---
    files["app/src/main/res/values/strings.xml"] = f'''<resources>
    <string name="app_name">{app_name}</string>
    <string name="welcome_message">Welkom bij {app_name}!</string>
    <string name="btn_action">Aan de slag</string>
</resources>'''

    files["app/src/main/res/values/colors.xml"] = '''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#1976D2</color>
    <color name="colorPrimaryDark">#1565C0</color>
    <color name="colorAccent">#42A5F5</color>
    <color name="background">#FAFAFA</color>
    <color name="text_primary">#212121</color>
    <color name="text_secondary">#757575</color>
</resources>'''

    files["app/src/main/res/values/themes.xml"] = f'''<resources>
    <style name="Theme.{app_name_safe}" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryVariant">@color/colorPrimaryDark</item>
        <item name="colorOnPrimary">@android:color/white</item>
        <item name="colorSecondary">@color/colorAccent</item>
        <item name="android:statusBarColor">@color/colorPrimary</item>
    </style>
</resources>'''

    # --- libs.versions.toml ---
    files["gradle/libs.versions.toml"] = generate_version_catalog(has_firebase, has_biometric, arch)

    # --- proguard ---
    files["app/proguard-rules.pro"] = "# ProGuard regels\n-keepattributes SourceFile,LineNumberTable\n"

    # --- README ---
    files["README.md"] = generate_readme(app_name, app_id, min_sdk, target_sdk,
                                          is_kotlin, arch, features)

    # --- .gitignore ---
    files[".gitignore"] = '''*.iml
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
'''

    return files


def generate_app_gradle(app_id, min_sdk, target_sdk, firebase, biometric, arch):
    deps = '''    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)'''
    if arch in ("mvvm", "clean"):
        deps += "\n    implementation(libs.lifecycle.viewmodel.ktx)\n    implementation(libs.lifecycle.livedata.ktx)"
    if firebase:
        deps += '\n    implementation(platform(libs.firebase.bom))\n    implementation(libs.firebase.analytics)'
    if biometric:
        deps += '\n    implementation(libs.biometric)'

    return f'''plugins {{
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    {"alias(libs.plugins.google.services)" if firebase else ""}
}}

android {{
    namespace = "{app_id}"
    compileSdk = {target_sdk}

    defaultConfig {{
        applicationId = "{app_id}"
        minSdk = {min_sdk}
        targetSdk = {target_sdk}
        versionCode = 1
        versionName = "1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }}

    buildTypes {{
        release {{
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }}
    }}
    compileOptions {{
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }}
    kotlinOptions {{ jvmTarget = "1.8" }}
    buildFeatures {{ viewBinding = true }}
}}

dependencies {{
{deps}
}}
'''


def generate_manifest(app_id, app_name_safe, internet, camera, location,
                       storage, push, bluetooth, biometric):
    perms = ""
    if internet: perms += '    <uses-permission android:name="android.permission.INTERNET" />\n'
    if camera: perms += '    <uses-permission android:name="android.permission.CAMERA" />\n'
    if location:
        perms += '    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />\n'
        perms += '    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n'
    if storage:
        perms += '    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />\n'
    if bluetooth:
        perms += '    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />\n'
    if biometric:
        perms += '    <uses-permission android:name="android.permission.USE_BIOMETRIC" />\n'

    return f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
{perms}
    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.{app_name_safe}">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>'''


def generate_main_kotlin(app_id, arch):
    vm_import = f"import {app_id}.viewmodel.MainViewModel\nimport androidx.activity.viewModels" if arch == "mvvm" else ""
    vm_decl = "private val viewModel: MainViewModel by viewModels()" if arch == "mvvm" else ""
    vm_observe = "viewModel.message.observe(this) { msg -> binding.tvMessage.text = msg }" if arch == "mvvm" else 'binding.tvMessage.text = "Welkom!"'

    return f'''package {app_id}

import android.os.Bundle
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
{vm_import}
import {app_id}.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {{
    private lateinit var binding: ActivityMainBinding
    {vm_decl}

    override fun onCreate(savedInstanceState: Bundle?) {{
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setSupportActionBar(binding.toolbar)

        {vm_observe}

        binding.btnAction.setOnClickListener {{
            Toast.makeText(this, "Hoi! 👋", Toast.LENGTH_SHORT).show()
        }}
    }}
}}
'''


def generate_main_java(app_id):
    return f'''package {app_id};

import android.os.Bundle;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import {app_id}.databinding.ActivityMainBinding;

public class MainActivity extends AppCompatActivity {{
    private ActivityMainBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {{
        super.onCreate(savedInstanceState);
        binding = ActivityMainBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());
        setSupportActionBar(binding.toolbar);

        binding.tvMessage.setText("Welkom!");

        binding.btnAction.setOnClickListener(v -> {{
            Toast.makeText(this, "Hoi! 👋", Toast.LENGTH_SHORT).show();
        }});
    }}
}}
'''


def generate_layout():
    return '''<?xml version="1.0" encoding="utf-8"?>
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
</androidx.coordinatorlayout.widget.CoordinatorLayout>'''


def generate_version_catalog(firebase, biometric, arch):
    lifecycle = arch in ("mvvm", "clean")
    lines = ["[versions]",
             'agp = "8.5.0"',
             'kotlin = "2.0.0"',
             'coreKtx = "1.13.1"',
             'appcompat = "1.7.0"',
             'material = "1.12.0"',
             'constraintlayout = "2.1.4"',
             'junit = "4.13.2"',
             'junitVersion = "1.2.1"',
             'espressoCore = "3.6.1"']
    if lifecycle: lines.append('lifecycle = "2.8.4"')
    if firebase: lines.append('firebaseBom = "33.1.2"')
    if biometric: lines.append('biometric = "1.1.0"')

    lines += ["", "[libraries]",
              'androidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }',
              'androidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }',
              'material = { group = "com.google.android.material", name = "material", version.ref = "material" }',
              'androidx-constraintlayout = { group = "androidx.constraintlayout", name = "constraintlayout", version.ref = "constraintlayout" }',
              'junit = { group = "junit", name = "junit", version.ref = "junit" }',
              'androidx-junit = { group = "androidx.test.ext", name = "junit", version.ref = "junitVersion" }',
              'androidx-espresso-core = { group = "androidx.test.espresso", name = "espresso-core", version.ref = "espressoCore" }']
    if lifecycle:
        lines += ['lifecycle-viewmodel-ktx = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-ktx", version.ref = "lifecycle" }',
                  'lifecycle-livedata-ktx = { group = "androidx.lifecycle", name = "lifecycle-livedata-ktx", version.ref = "lifecycle" }']
    if firebase:
        lines += ['firebase-bom = { group = "com.google.firebase", name = "firebase-bom", version.ref = "firebaseBom" }',
                  'firebase-analytics = { group = "com.google.firebase", name = "firebase-analytics" }']
    if biometric:
        lines.append('biometric = { group = "androidx.biometric", name = "biometric", version.ref = "biometric" }')

    lines += ["", "[plugins]",
              'android-application = { id = "com.android.application", version.ref = "agp" }',
              'kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }']
    if firebase:
        lines.append('google-services = { id = "com.google.gms.google-services", version = "4.4.2" }')

    return "\n".join(lines) + "\n"


def generate_readme(app_name, app_id, min_sdk, target_sdk, is_kotlin, arch, features):
    lang = "Kotlin" if is_kotlin else "Java"
    return f'''# {app_name}

![Android](https://img.shields.io/badge/Android-API{min_sdk}+-3DDC84?logo=android)
![Language](https://img.shields.io/badge/Language-{lang}-{"F48024" if is_kotlin else "5A7ABC"})

**Package:** `{app_id}` | **SDK:** min {min_sdk} / target {target_sdk}
**Taal:** {lang} | **Arch:** {arch.upper()}

{"**Features:** " + ", ".join(features) if features else ""}

## Aan de slag
```bash
# Open in Android Studio en klik Run ▶️
```

---
*Gegenereerd met Android App Pro Builder ⚡*
'''


def print_instructions(app_name, lang):
    folder = app_name.replace(" ", "-").lower()
    print("\n📋 INSTALLATIE-INSTRUCTIES")
    print("=" * 40)
    print(f"1. Open Android Studio")
    print(f"2. File → Open → selecteer map: {folder}/")
    print(f"3. Wacht op Gradle sync")
    print(f"4. Run → Run 'app' (Shift+F10)")
    print()


# ===== CLI =====
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Android App Pro Builder CLI")
    parser.add_argument("--name", "-n", required=True, help="App naam (bijv. 'Mijn App')")
    parser.add_argument("--id", "-i", required=True, help="App package ID (bijv. com.mijn.app)")
    parser.add_argument("--lang", "-l", choices=["kotlin", "java"], default="kotlin")
    parser.add_argument("--arch", "-a", choices=["mvvm", "mvc", "clean", "none"], default="mvvm")
    parser.add_argument("--min-sdk", type=int, default=26)
    parser.add_argument("--target-sdk", type=int, default=34)
    parser.add_argument("--features", "-f", nargs="*",
                        choices=["internet","camera","location","storage","push","bluetooth","biometric","firebase"],
                        default=["internet"])
    parser.add_argument("--output", "-o", default=".", help="Output map")
    parser.add_argument("--no-zip", action="store_true", help="Geen ZIP aanmaken")
    parser.add_argument("--config", "-c", help="JSON config bestand")

    args = parser.parse_args()

    if args.config:
        with open(args.config) as f:
            config = json.load(f)
    else:
        config = {
            "app_name": args.name,
            "app_id": args.id,
            "lang": args.lang,
            "arch": args.arch,
            "min_sdk": args.min_sdk,
            "target_sdk": args.target_sdk,
            "features": args.features or ["internet"],
        }

    create_project(config, output_dir=args.output, make_zip=not args.no_zip)
