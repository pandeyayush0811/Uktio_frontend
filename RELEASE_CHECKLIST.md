# 🚀 Utkio App — Production Release & Update Checklist

Yeh document har naye app release aur bug-fix update ke liye official step-by-step guide hai. Jab bhi aap codebase me koi naya change laayein, is checklist ko follow karein.

---

## 🔑 1. Permanent Keystore Credentials (CRITICAL BACKUP)

> **⚠️ WARNING:** Is keystore file aur credentials ka backup Google Drive / OneDrive me hamesha surakshit rakhein. Iske bina future updates install nahi honge.

- **Keystore File Location:** `frontend/android/app/utkio-release.jks`
- **Alias Name:** `utkio-alias`
- **Password:** `UtkioRelease2026!`
- **Properties Config:** `frontend/android/key.properties`

---

## 📋 2. Pre-Build Checklist (Code Change Ke Baad)

Har naye build se pehle ye 3 cheezein check karein:

- [ ] **1. Version Code (+1) Increment:**
  - File: `frontend/android/app/build.gradle`
  - `versionCode` ko purane number se +1 karein (e.g. `1` ➔ `2` ➔ `3`).
  - `versionName` update karein (e.g. `"1.0.0"` ➔ `"1.0.1"`).
- [ ] **2. UI Version Update (Optional but Recommended):**
  - File: `frontend/www/settings.html` (App version row)
  - File: `frontend/www/shared/config.js` (`APP_VERSION: 'utkio@1.0.1'`)
- [ ] **3. Production Backend Active:**
  - File: `frontend/www/shared/config.js`
  - Confirm karein: `const ACTIVE_BACKEND = 'main';` (`'local'` nahi hona chahiye).

---

## ⚡ 3. Exact Commands to Build Signed APK (Windows PowerShell)

Apne terminal me ye commands sequence me run karein:

```powershell
# Step 1: Frontend root directory me jayein
cd "c:\Users\pande\OneDrive\Desktop\Safe Version\v2\frontend_updated\frontend"

# Step 2: Latest Web Assets (HTML/CSS/JS) ko Android me sync karein
npx cap sync android

# Step 3: Android directory me jayein
cd android

# Step 4: JDK 21 Environment Set Karein
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot"

# Step 5: Official Signed Release APK Build Karein
.\gradlew.bat assembleRelease
```

---

## 📂 4. Output APK File Location

Build complete hone ke baad aapka signed APK yahan milega:
📍 `frontend/android/app/build/outputs/apk/release/app-release.apk`

**Recommended Action:** File ko rename karein version ke hisab se:
`Utkio-v1.0.1.apk`

---

## 🧪 5. Testing Checklist (Users Ko Bhejne Se Pehle)

- [ ] **1. Over-the-Top Update Test:**
  - Purana app uninstall KIYE BINA naya APK install karein.
  - Phone par direct **"Update"** popup aana chahiye (No signature conflict error).
- [ ] **2. Data Preservation:**
  - Verify karein ki purana login session aur saved Gemini Key safe rahe.
- [ ] **3. Core Features Check:**
  - Microphone access aur voice streaming test karein.
  - Naya bugfix / feature verify karein.

---

## 👥 6. Distribution Checklist

- [ ] APK ko Google Drive / Dropbox / Website / Telegram par upload karein.
- [ ] Link permission **"Anyone with link can download"** set karein.
- [ ] Users ke saath link share karein.
