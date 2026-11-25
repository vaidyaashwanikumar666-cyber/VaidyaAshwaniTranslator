# 🏪 Play Store par app kaise daalein

## 1. Signing secrets (sirf ek baar)
Play Store wali **AAB** file sirf tab banegi jab ye 4 secrets GitHub me add honge.

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `KEYSTORE_BASE64` | `KEYSTORE_BASE64.txt` file ka poora text |
| `KEYSTORE_PASSWORD` | `passwords.txt` se |
| `KEY_ALIAS` | `vaidya-upload` |
| `KEY_PASSWORD` | `passwords.txt` se |

Ye files aapko alag se di gayi hain (`upload-key.jks`, `KEYSTORE_BASE64.txt`, `passwords.txt`). **Inhe safe rakhein aur kabhi public na karein.** Ye repo me nahi hain.

Secrets daalne ke baad: **Actions → "Android App (APK + Play Store AAB)" → Run workflow**. 5–8 minute me **Releases** me ye dono file aa jayengi:
- `VaidyaAshwaniTranslator.apk`: phone me seedha install karne ke liye
- `VaidyaAshwaniTranslator-playstore.aab`: Play Console me upload karne ke liye

## 2. Google Play Console account
https://play.google.com/console → Developer account (ek baar $25) → identity verification (1–3 din).

## 3. App banayein
**Create app** →
- App name: **Vaidya Ashwani Call Translator** (Play Store me naam 30 akshar tak hi ho sakta hai; phone par poora naam "Vaidya Ashwani Live Call Translator" dikhega)
- Default language: English (India) ya Hindi
- App, **Free**

## 4. Store listing (`playstore/LISTING.md` se copy karein)
- App icon: `playstore/icon-512.png`
- Feature graphic: `playstore/feature-graphic-1024x500.png`
- Phone screenshots: `playstore/screenshots/` ki saari 6 photo
- Privacy policy URL: **https://vaidyaashwanikumar666-cyber.github.io/VaidyaAshwaniTranslator/privacy.html**

## 5. App content (Policy) – jawab
| Section | Jawab |
|---|---|
| Privacy policy | upar wala URL |
| Ads | No, app me ads nahi hain |
| App access | All functionality available without special access |
| Content rating | Questionnaire bharein → Category: *Communication*; violence/sexual content sab **No**; "users can interact/communicate" **Yes** |
| Target audience | 18+ (ya 13+) |
| News app | No |
| Data safety | Niche dekhein |
| Government app | No |
| Financial features | None |
| Health | No (ye medical app nahi hai) |

### Data safety form
- **Does your app collect or share user data?** Yes
- **Encrypted in transit?** Yes
- **Can users request deletion?** Yes (app ki History se delete ya app uninstall)
- Data types:
  - **Personal info → Name, Phone number**: *Collected*, purpose **App functionality**. Ye Call ID ke liye hai aur phone par hi store hota hai. Optional nahi hai.
  - **Audio → Voice or sound recordings**: *Collected*, purpose **App functionality**. Ye call aur speech recognition ke liye hai, aur recording sirf phone par rehti hai.
  - **Photos and videos → Videos**: *Collected* (video call ke liye), ephemeral, purpose **App functionality**.
  - **Messages → Other in-app messages**: *Shared* with a translation service (Google Translate) for **App functionality**, processed ephemerally.

## 6. Testing → Production
Naye **personal** developer account ke liye Google ka niyam:
1. **Testing → Closed testing** → naya track → `VaidyaAshwaniTranslator-playstore.aab` upload karein.
2. **Play App Signing** accept karein (Google final signing key rakhta hai, aapki key sirf upload key hai).
3. **Kam se kam 12 testers** (Gmail IDs) add karein, jo **14 din lagaataar** opt-in rahein.
4. 14 din baad: **Dashboard → Apply for production** → approve hone par **Production** me release karein.

(Organization account ho to seedha Production me ja sakte hain.)

## 7. Har update par
Code me badlaav karke `main` branch par push karein. Naya APK/AAB apne aap Release me aa jayega, aur versionCode apne aap badhta hai. Phir Play Console → naya release → AAB upload karein.
