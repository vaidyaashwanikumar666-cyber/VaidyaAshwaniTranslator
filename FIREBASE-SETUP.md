# 🔑 Admin "Password bhool gaye" – OTP setup (Firebase, ek baar)

OTP SMS bhejne ke liye Google ki **Firebase Phone Authentication** service use hoti hai. Ye setup ek baar karna hai, aur lagbhag 10 minute lagte hain.

1. https://console.firebase.google.com kholein → **Add project** → naam: `Vaidya Ashwani Translator` → Google Analytics **off** → **Create project**
2. Left menu me **Build → Authentication → Get started** → **Sign-in method** tab → **Phone** → **Enable** → Save
3. **Authentication → Settings → Authorized domains → Add domain** → ye do domain jodein:
   - `vaidyaashwanikumar666-cyber.github.io`
   - `appassets.androidplatform.net` (Android app ke liye)
4. ⚙️ **Project settings → General → Your apps → Web (`</>`)** → naam `web` → **Register app**. Wahan jo `firebaseConfig` dikhega (apiKey, authDomain, projectId, appId), use copy karke mujhe bhej dein. Main use `web/firebase-config.js` me daal dunga. Ye values secret nahi hoti.
5. **Billing:** Firebase SMS bhejne ke liye project ko **Blaze (pay-as-you-go)** plan par rakhne ko keh sakta hai. Har OTP SMS ka bahut chhota kharcha hota hai. **Usage and billing → Budget alert** zaroor lagayein, jaise ₹100.

Iske baad: Settings → Admin Login → **"🔑 Password bhool gaye?"** → registered number daalein → OTP → naya password.

- OTP **sirf registered recovery number** par hi jaata hai. Koi aur number daalne par OTP bheja hi nahi jaata.
- Number code me nahi likha hai, sirf uska hash hai, kyunki repo public hai.
- Password badalne par patient ka data surakshit rehta hai.
