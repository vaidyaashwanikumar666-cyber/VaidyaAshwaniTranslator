# 🏪 Play Store Launch Guide – Vaidya Ashwani Live Call Translator

Har step ke jawab yahan likhe hain. Play Console me bas copy-paste karte jaayein.

| Cheez | Value |
|---|---|
| Package name | `in.vaidyaashwani.livecalltranslator` |
| Upload file | Release me `VaidyaAshwaniTranslator-playstore.aab` (https://github.com/vaidyaashwanikumar666-cyber/VaidyaAshwaniTranslator/releases/latest) |
| Privacy policy | https://vaidyaashwanikumar666-cyber.github.io/VaidyaAshwaniTranslator/privacy.html |
| Listing text | `playstore/LISTING.md` (English) aur `playstore/LISTING-hi.md` (Hindi) |
| Graphics | `playstore/icon-512.png`, `playstore/feature-graphic-1024x500.png`, `playstore/screenshots/` (6 photo) |
| Release notes | `playstore/RELEASE-NOTES.md` |

---

## Step 1 – Developer account
https://play.google.com/console → **Personal** account → $25 (ek baar) → Aadhaar/PAN se identity verification (1–3 din) → phone aur email verify karein.

## Step 2 – App banayein
**Home → Create app**:
- App name: `Vaidya Ashwani Call Translator` (Play Store me 30 akshar ki limit hai; phone par poora naam dikhega)
- Default language: English (India) – en-IN
- App or game: **App** · Free or paid: **Free**
- Teeno declarations par tick karein → **Create app**

## Step 3 – App content (Policy → App content)
| Section | Jawab |
|---|---|
| Privacy policy | upar wala URL |
| App access | **All functionality is available without any access restrictions** |
| Ads | **No, my app does not contain ads** |
| Content rating | Email daalein → Category **"All Other App Types"** → violence/sexual/drugs/gambling sab **No**. "Does the app allow users to interact or exchange content?" **Yes**. "Share location?" **No**. "Digital purchases?" **No**. Result lagbhag **Everyone / 3+** (users interact) aayega. |
| Target audience | **18 and over** (bacchon ke liye nahi) |
| News app | No |
| COVID-19 apps | My app is not a publicly available COVID-19 contact tracing or status app |
| Data safety | Niche Step 4 |
| Government app | No |
| Financial features | My app doesn't provide any financial features |
| Health apps | My app does not have any health features |
| **Foreground service permissions** | Niche Step 5 |

## Step 4 – Data safety
- Does your app collect or share any of the required user data types? **Yes**
- Is all of the user data collected by your app encrypted in transit? **Yes**
- Do you provide a way for users to request that their data is deleted? **Yes** (History se delete, ya app uninstall; koi server copy nahi)

| Data type | Collected / Shared | Ephemeral? | Required? | Purpose |
|---|---|---|---|---|
| Personal info → **Name** | Collected | No | Required | App functionality |
| Personal info → **Phone number** | Collected | No | Required | App functionality (Call ID) |
| Audio → **Voice or sound recordings** | Collected | Yes | Required | App functionality |
| Photos and videos → **Videos** | Collected | Yes | Optional | App functionality (video call) |
| Messages → **Other in-app messages** | Collected + **Shared** | Yes | Required | App functionality (text translation ke liye Google Translate ko jaata hai) |

Baaki sab data types: **Not collected**.

## Step 5 – Foreground service declaration
App call ke dauran **microphone** aur **camera** foreground service chalata hai, taaki screen lock hone par bhi call na kate. Play Console isse poochega:
- Feature type: **Microphone** aur **Camera**
- Use case: *"User-initiated VoIP video/voice calls with live translation. The service runs only while a call is active, shows an ongoing notification and stops as soon as the call ends."*
- Video link: apne phone par **30 second ka screen recording** banayein (call shuru karein → screen lock karein → notification dikhayein → call khatam karein). Use YouTube par **Unlisted** daalkar link paste karein.

## Step 6 – Store listing (Grow → Store presence → Main store listing)
- App name, Short description, Full description: `playstore/LISTING.md` se
- **Add translation → Hindi (hi-IN)**: `playstore/LISTING-hi.md` se
- App icon: `icon-512.png` · Feature graphic: `feature-graphic-1024x500.png`
- Phone screenshots: `screenshots/` ki 6 photo (1080×2160)
- Category: **Communication** · Tags: Translator, Video calling
- Contact details: **email zaroori hai** (website optional: GitHub Pages wala link)

## Step 7 – Closed testing (naye personal account ke liye zaroori)
1. **Test and release → Testing → Closed testing → Create track** (ya "Alpha")
2. **Countries**: India (aur jahan chahein)
3. **Testers**: Google Group ya email list. Isme **kam se kam 12 log** hone chahiye.
4. **Create new release** → **Play App Signing** accept karein → `VaidyaAshwaniTranslator-playstore.aab` upload → Release notes paste → **Save → Review → Start rollout**
5. Testers ko **opt-in link** bhejein. Sab log link kholkar "Become a tester" dabayein aur Play Store se app install karein.
6. Ye 12 log **14 din lagaataar** opted-in rahein aur app use karein.

## Step 8 – Production
14 din baad **Dashboard → Apply for production** → kuch sawaalon ke jawab (testing kaise hui, kya feedback mila) → approval (aam taur par kuch din) → **Production → Create new release → wahi AAB → Rollout**.

## Step 9 – Launch ke baad
Mujhe bataayein, main ye 2 cheezein badal dunga:
- `web/app.js` me `PLAY_LIVE = true`. Iske baad invite aur web banner me Play Store ka link aayega, aur Settings me "⭐ Rating dein" dikhega.
- `SUPPORT_EMAIL` me aapka support email (Settings me "Madad / Feedback").

## Har naye update par
Code push karte hi naya AAB Release me apne aap aa jata hai, aur versionCode apne aap badhta hai. Phir Play Console → Production (ya testing) → Create new release → naya AAB upload karein.

## ⚠️ Dhyan rakhne wali baatein
- **Upload key** (`upload-key.jks` + password) kabhi na khoyein. Kho jaaye to Play Console → *App integrity* se reset ki request ho sakti hai, par usme samay lagta hai.
- Translation ke liye abhi Google ki **free public translation service** use hoti hai. Zyada users hone par ise rate-limit ho sakti hai. Tab Google Cloud Translation API (paid) jodna behtar rahega, main jod sakta hoon.
- Call jodne ke liye PeerJS ka **free public server** use hota hai. Bade launch ke liye apna server lagana behtar hai, aur app me uski setting pehle se hai.
