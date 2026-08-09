#!/usr/bin/env bash
#
# setup_build_server.sh — installeert alles wat nodig is om echte APK's
# te bouwen met de Web2App Pro backend: JDK 17, Android SDK command-line
# tools, de benodigde SDK-packages, en de gradle-wrapper.jar.
#
# Gebruik:
#   chmod +x setup_build_server.sh
#   ./setup_build_server.sh
#
# Getest op Ubuntu 22.04 / 24.04. Draai NIET als root (gebruik een gewone
# user met sudo-rechten) — de Android SDK hoort niet in /root te staan.

set -euo pipefail

if [ "$EUID" -eq 0 ]; then
  echo "❌ Draai dit script niet als root. Gebruik een gewone gebruiker met sudo-rechten."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANDROID_HOME_DIR="$HOME/android-sdk"
CMDLINE_TOOLS_VERSION="11076708"
CMDLINE_TOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip"

echo "======================================================"
echo " Web2App Pro — build server setup"
echo "======================================================"
echo ""
echo "Dit script installeert:"
echo "  1. OpenJDK 17"
echo "  2. Android SDK command-line tools -> $ANDROID_HOME_DIR"
echo "  3. platform-tools, platform android-34, build-tools 34.0.0"
echo "  4. gradle-wrapper.jar in backend/gradle_wrapper_template/"
echo ""
read -p "Doorgaan? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Geannuleerd."
  exit 0
fi

# --- Stap 1: JDK 17 ---
echo ""
echo "--- Stap 1/4: OpenJDK 17 installeren ---"
sudo apt update -qq
sudo apt install -y openjdk-17-jdk unzip curl
java -version

# --- Stap 2: Android SDK command-line tools ---
echo ""
echo "--- Stap 2/4: Android SDK command-line tools ---"
if [ -d "$ANDROID_HOME_DIR/cmdline-tools/latest" ]; then
  echo "Al aanwezig op $ANDROID_HOME_DIR/cmdline-tools/latest — sla download over."
else
  mkdir -p "$ANDROID_HOME_DIR/cmdline-tools"
  TMP_ZIP="$(mktemp)"
  echo "Downloaden van $CMDLINE_TOOLS_URL ..."
  curl -fsSL -o "$TMP_ZIP" "$CMDLINE_TOOLS_URL"
  unzip -q "$TMP_ZIP" -d "$ANDROID_HOME_DIR/cmdline-tools"
  mv "$ANDROID_HOME_DIR/cmdline-tools/cmdline-tools" "$ANDROID_HOME_DIR/cmdline-tools/latest"
  rm -f "$TMP_ZIP"
fi

export ANDROID_HOME="$ANDROID_HOME_DIR"
export ANDROID_SDK_ROOT="$ANDROID_HOME_DIR"
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"

# Omgevingsvariabelen persistent maken in .bashrc (idempotent — niet dubbel toevoegen)
BASHRC="$HOME/.bashrc"
if ! grep -q "ANDROID_HOME=$ANDROID_HOME_DIR" "$BASHRC" 2>/dev/null; then
  {
    echo ""
    echo "# --- Web2App Pro Android SDK ---"
    echo "export ANDROID_HOME=$ANDROID_HOME_DIR"
    echo "export ANDROID_SDK_ROOT=$ANDROID_HOME_DIR"
    echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/platform-tools"
  } >> "$BASHRC"
  echo "Omgevingsvariabelen toegevoegd aan $BASHRC"
else
  echo "Omgevingsvariabelen staan al in $BASHRC"
fi

# --- Stap 3: SDK-packages installeren ---
echo ""
echo "--- Stap 3/4: SDK-licenties accepteren + packages installeren ---"
yes | sdkmanager --licenses > /dev/null || true
sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"

# --- Stap 4: gradle-wrapper.jar genereren ---
echo ""
echo "--- Stap 4/4: gradle-wrapper.jar genereren ---"
WRAPPER_DIR="$SCRIPT_DIR/gradle_wrapper_template"
if [ -f "$WRAPPER_DIR/gradle/wrapper/gradle-wrapper.jar" ]; then
  echo "gradle-wrapper.jar bestaat al — sla over."
else
  if ! command -v gradle &> /dev/null; then
    echo "Gradle niet gevonden, installeren via apt (kan een oudere versie zijn, alleen nodig om de wrapper te genereren)..."
    sudo apt install -y gradle
  fi
  cd "$WRAPPER_DIR"
  gradle wrapper --gradle-version 8.7
  cd "$SCRIPT_DIR"
  if [ -f "$WRAPPER_DIR/gradle/wrapper/gradle-wrapper.jar" ]; then
    echo "✅ gradle-wrapper.jar gegenereerd."
  else
    echo "❌ gradle-wrapper.jar genereren is mislukt — controleer de Gradle-installatie handmatig."
    exit 1
  fi
fi
chmod +x "$WRAPPER_DIR/gradlew"

# --- Klaar ---
echo ""
echo "======================================================"
echo " ✅ Setup voltooid"
echo "======================================================"
echo ""
echo "Herstart je shell (of: source ~/.bashrc) zodat ANDROID_HOME"
echo "beschikbaar is. Start daarna de backend:"
echo ""
echo "  cd $SCRIPT_DIR"
echo "  pip install -r requirements.txt"
echo "  python3 app.py"
echo ""
echo "Let op: als je de backend als systemd-service draait, moet je"
echo "ANDROID_HOME/ANDROID_SDK_ROOT ook in die service-file zetten —"
echo "~/.bashrc wordt niet door systemd ingelezen. Zie README-webview-setup.md."
