#!/usr/bin/env python3
"""
Web2App Pro — genereert een compleet, buildbaar Android Studio project
dat een opgegeven URL in een WebView toont (native app-achtige wrapper
om een website).

Losstaand van generate_project.py met eigen, minimale gradle-opzet
(geen version catalog) om het aantal faalpunten bij een geautomatiseerde
Gradle-build zo klein mogelijk te houden.
"""

import re
import io
import base64
from generate_project import (
    xml_escape, kt_escape, safe_resource_name, safe_folder_name,
    ProjectConfigError, DEFAULT_MIN_SDK, DEFAULT_TARGET_SDK,
)

URL_RE = re.compile(r'^https?://[^\s]+$')

# Standaard Android mipmap-dichtheden en hun icoongrootte in pixels
_ICON_DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def generate_launcher_icons(letter: str, bg_color_hex: str) -> dict:
    """Genereert app-icoon PNG's (ic_launcher + ic_launcher_round) op alle
    standaard dichtheden, plus een los grotere PNG voor de adaptive-icon
    voorgrond. Gebruikt Pillow indien beschikbaar; valt anders terug op een
    pure-XML vector zodat de build nooit faalt door een ontbrekende dependency."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return _generate_launcher_icons_vector_fallback(letter, bg_color_hex)

    files = {}
    bg = bg_color_hex if bg_color_hex.startswith("#") else f"#{bg_color_hex}"

    def render_png(size: int) -> bytes:
        img = Image.new("RGBA", (size, size), bg)
        draw = ImageDraw.Draw(img)
        font_size = int(size * 0.55)
        try:
            font = ImageFont.load_default(size=font_size)
        except TypeError:
            # Oudere Pillow-versies ondersteunen geen size-argument op load_default
            font = ImageFont.load_default()
        bbox = draw.textbbox((0, 0), letter, font=font)
        text_w, text_h = bbox[2] - bbox[0], bbox[3] - bbox[1]
        draw.text(
            ((size - text_w) / 2 - bbox[0], (size - text_h) / 2 - bbox[1]),
            letter, fill="#FFFFFF", font=font,
        )
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    for folder, size in _ICON_DENSITIES.items():
        png_bytes = render_png(size)
        files[f"app/src/main/res/{folder}/ic_launcher.png"] = png_bytes
        files[f"app/src/main/res/{folder}/ic_launcher_round.png"] = png_bytes

    # Grotere voorgrond-PNG voor de adaptive icon (108dp @ xxxhdpi-equivalent = 432px)
    files["app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png"] = render_png(432)
    for folder, size in _ICON_DENSITIES.items():
        files[f"app/src/main/res/{folder}/ic_launcher_foreground.png"] = render_png(int(size * 2.25))

    return files


def _generate_launcher_icons_vector_fallback(letter: str, bg_color_hex: str) -> dict:
    """Fallback zonder Pillow: een pure-XML vector drawable als icoon.
    Minder mooi dan een echte gerenderde letter, maar altijd geldig en
    vereist geen extra Python-dependency op de buildserver."""
    bg = bg_color_hex if bg_color_hex.startswith("#") else f"#{bg_color_hex}"
    vector = f'''<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path android:fillColor="{bg}" android:pathData="M0,0h108v108h-108z" />
    <path android:fillColor="#FFFFFF" android:pathData="M44,34 L64,34 L64,44 L58,44 L58,74 L50,74 L50,44 L44,44 Z" />
</vector>'''
    # Deze vector wordt via mipmap-anydpi-v26/ic_launcher*.xml aangeroepen als
    # @drawable ipv @mipmap PNG — daarom hier een drawable-bestand teruggeven,
    # de caller (generate_webview_project) verwijst er via de juiste sleutel naar.
    return {
        "app/src/main/res/drawable/ic_launcher_foreground.xml": vector,
    }


def validate_webview_config(config: dict):
    """Validatie specifiek voor Web2App: naam, package ID én een geldige URL."""
    app_name = (config.get("app_name") or "").strip()
    app_id = (config.get("app_id") or "").strip()
    url = (config.get("url") or "").strip()

    if not app_name:
        raise ProjectConfigError("app_name is verplicht")
    if not app_id or "." not in app_id:
        raise ProjectConfigError("app_id moet een geldig package ID zijn (bijv. com.mijn.app)")
    if not re.match(r'^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$', app_id):
        raise ProjectConfigError("app_id bevat ongeldige tekens voor een Android package naam")
    if not url:
        raise ProjectConfigError("url is verplicht")
    if not URL_RE.match(url):
        raise ProjectConfigError("url moet beginnen met http:// of https://")
    if len(url) > 2048:
        raise ProjectConfigError("url is te lang")

    try:
        min_sdk = int(config.get("min_sdk", DEFAULT_MIN_SDK))
        target_sdk = int(config.get("target_sdk", DEFAULT_TARGET_SDK))
    except (TypeError, ValueError):
        raise ProjectConfigError("min_sdk en target_sdk moeten getallen zijn")
    if min_sdk > target_sdk:
        raise ProjectConfigError("min_sdk mag niet groter zijn dan target_sdk")
    if min_sdk < 21:
        raise ProjectConfigError("min_sdk moet minstens 21 zijn voor een moderne WebView")


def generate_webview_project(app_name: str, app_id: str, url: str,
                              min_sdk: int = DEFAULT_MIN_SDK,
                              target_sdk: int = DEFAULT_TARGET_SDK,
                              show_progress_bar: bool = True,
                              allow_zoom: bool = False,
                              app_icon_color: str = "#1976D2") -> dict:
    """Bouwt de volledige bestandenset voor een Web2App WebView-project.
    Retourneert een dict {relatief_pad: bestandsinhoud}."""
    package_path = app_id.replace(".", "/")
    app_name_safe = safe_resource_name(app_name)
    uses_cleartext = url.strip().lower().startswith("http://")
    files = {}

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
rootProject.name = "{kt_escape(app_name)}"
include(":app")
'''

    # --- build.gradle.kts (root) ---
    files["build.gradle.kts"] = '''plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
'''

    # --- gradle.properties ---
    files["gradle.properties"] = '''android.useAndroidX=true
kotlin.code.style=official
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.parallel=true
'''

    # --- app/build.gradle.kts ---
    files["app/build.gradle.kts"] = f'''plugins {{
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
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
    }}

    buildTypes {{
        release {{
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }}
    }}

    compileOptions {{
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }}

    kotlinOptions {{
        jvmTarget = "17"
    }}

    buildFeatures {{
        viewBinding = true
    }}
}}

dependencies {{
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
}}
'''

    # --- AndroidManifest.xml ---
    files["app/src/main/AndroidManifest.xml"] = f'''<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:usesCleartextTraffic="{"true" if uses_cleartext else "false"}"
        android:networkSecurityConfig="@xml/network_security_config"
        android:theme="@style/Theme.{app_name_safe}">
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>'''

    # --- MainActivity.kt ---
    zoom_setup = '''
        webView.settings.setSupportZoom(true)
        webView.settings.builtInZoomControls = true
        webView.settings.displayZoomControls = false''' if allow_zoom else '''
        webView.settings.setSupportZoom(false)
        webView.settings.builtInZoomControls = false'''

    progress_setup = '''
        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                super.onProgressChanged(view, newProgress)
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }
        }''' if show_progress_bar else ''

    files[f"app/src/main/java/{package_path}/MainActivity.kt"] = f'''package {app_id}

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {{

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var swipeRefresh: SwipeRefreshLayout

    private val startUrl = "{kt_escape(url)}"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {{
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        swipeRefresh = findViewById(R.id.swipeRefresh)

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.loadWithOverviewMode = true
        webView.settings.useWideViewPort = true
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        {zoom_setup.strip()}

        webView.webViewClient = object : WebViewClient() {{
            override fun onPageFinished(view: WebView?, url: String?) {{
                super.onPageFinished(view, url)
                swipeRefresh.isRefreshing = false
            }}
        }}
        {progress_setup.strip()}

        swipeRefresh.setOnRefreshListener {{ webView.reload() }}

        if (savedInstanceState != null) {{
            webView.restoreState(savedInstanceState)
        }} else {{
            webView.loadUrl(startUrl)
        }}
    }}

    override fun onSaveInstanceState(outState: Bundle) {{
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }}

    override fun onBackPressed() {{
        if (webView.canGoBack()) {{
            webView.goBack()
        }} else {{
            super.onBackPressed()
        }}
    }}
}}
'''

    # --- Layout ---
    files["app/src/main/res/layout/activity_main.xml"] = '''<?xml version="1.0" encoding="utf-8"?>
<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <ProgressBar
        android:id="@+id/progressBar"
        style="?android:attr/progressBarStyleHorizontal"
        android:layout_width="0dp"
        android:layout_height="4dp"
        android:max="100"
        android:visibility="gone"
        app:layout_constraintTop_toTopOf="parent"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent" />

    <androidx.swiperefreshlayout.widget.SwipeRefreshLayout
        android:id="@+id/swipeRefresh"
        android:layout_width="0dp"
        android:layout_height="0dp"
        app:layout_constraintTop_toBottomOf="@id/progressBar"
        app:layout_constraintStart_toStartOf="parent"
        app:layout_constraintEnd_toEndOf="parent"
        app:layout_constraintBottom_toBottomOf="parent">

        <WebView
            android:id="@+id/webView"
            android:layout_width="match_parent"
            android:layout_height="match_parent" />

    </androidx.swiperefreshlayout.widget.SwipeRefreshLayout>

</androidx.constraintlayout.widget.ConstraintLayout>
'''

    # --- Resources ---
    files["app/src/main/res/values/strings.xml"] = f'''<resources>
    <string name="app_name">{xml_escape(app_name)}</string>
</resources>'''

    files["app/src/main/res/values/colors.xml"] = f'''<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">{app_icon_color}</color>
    <color name="colorPrimaryDark">{app_icon_color}</color>
</resources>'''

    files["app/src/main/res/values/themes.xml"] = f'''<resources>
    <style name="Theme.{app_name_safe}" parent="Theme.Material3.DayNight.NoActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryVariant">@color/colorPrimaryDark</item>
        <item name="android:statusBarColor">@color/colorPrimary</item>
    </style>
</resources>'''

    # --- Netwerk-beveiliging ---
    files["app/src/main/res/xml/network_security_config.xml"] = f'''<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="{"true" if uses_cleartext else "false"}">
        <trust-anchors>
            <certificates src="system" />
        </trust-anchors>
    </base-config>
</network-security-config>'''

    files["app/proguard-rules.pro"] = "# ProGuard regels\n-keepattributes SourceFile,LineNumberTable\n"

    # --- App-icoon ---
    # Zonder icoon-resources faalt de AAPT2-build met "resource mipmap/ic_launcher
    # not found", want de manifest verwijst er al naar. We genereren een simpel
    # icoon (achtergrondkleur + eerste letter van de app-naam) als PNG's op de
    # standaard mipmap-dichtheden, plus een adaptive-icon XML voor Android 8+.
    icon_letter = next((c for c in app_name.strip().upper() if c.isalnum()), "A")
    icon_files = generate_launcher_icons(icon_letter, app_icon_color)
    files.update(icon_files)

    # Pillow-pad genereert PNG's op @mipmap/ic_launcher_foreground; de vector-
    # fallback (geen Pillow op de server) genereert @drawable/ic_launcher_foreground.
    # De adaptive-icon XML moet naar het pad verwijzen dat daadwerkelijk bestaat.
    foreground_ref = ("@drawable/ic_launcher_foreground"
                       if "app/src/main/res/drawable/ic_launcher_foreground.xml" in icon_files
                       else "@mipmap/ic_launcher_foreground")

    adaptive_icon_xml = f'''<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/colorPrimary" />
    <foreground android:drawable="{foreground_ref}" />
</adaptive-icon>'''
    files["app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml"] = adaptive_icon_xml
    files["app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml"] = adaptive_icon_xml

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
'''

    files["README.md"] = f'''# {app_name}

Web2App wrapper voor: {url}

Gegenereerd met Web2App Pro. Open dit project in Android Studio,
of bouw de APK met:

```bash
./gradlew assembleDebug
```

De APK staat daarna in `app/build/outputs/apk/debug/app-debug.apk`.
'''

    return files
