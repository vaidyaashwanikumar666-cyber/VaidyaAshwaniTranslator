# Vaidya Ashwani Live Call Translator

Aap Hindi me boliye, saamne wala apni bhasha me sunega. Wo apni bhasha me bolega, aap Hindi me sunenge.

- 🎥 **Video Call** aur 📞 **Voice Call**, live translation ke saath (aapka mobile number hi aapki Call ID hai)
- 🔊 **Speaker Translator**: WhatsApp ya SIM call ko speaker par daalkar translation
- 📄 Har call ki **PDF** aur 🎧 **voice recording**
- 🇮🇳 8vi Anusuchi ki **sabhi 22 bhashayein**, saath me Bhojpuri, Awadhi, Marwadi, Tulu, Mizo, Khasi aur Chhattisgarhi
- 🌍 Duniya ki **120 se zyada** bhashayein

## 📲 Phone me download (bina ZIP)
**APK:** https://github.com/vaidyaashwanikumar666-cyber/VaidyaAshwaniTranslator/releases/latest/download/VaidyaAshwaniTranslator.apk

Link kholte hi APK download hoga. Download hone ke baad use kholein aur **Install** dabayein. Pehli baar Android "Unknown apps" ki permission maangega, use allow karein.

**Web version (bina install):** https://vaidyaashwanikumar666-cyber.github.io/VaidyaAshwaniTranslator/

## 🏪 Play Store
Poori step-by-step guide [PLAYSTORE.md](PLAYSTORE.md) me hai. Listing ka text aur graphics `playstore/` folder me hain.

## 🧱 Project kaise bana hai
| Folder | Kya hai |
|---|---|
| `web/` | App ka poora design aur logic (HTML/CSS/JS). Ye web link par bhi chalta hai aur APK ke andar bhi jaata hai. |
| `app/` | Android app (Kotlin). Isme WebView me design dikhta hai. Bolna-sunna phone ki native Google speech aur voice se hota hai, aur PDF/recording Download folder me save hoti hai. |
| `.github/workflows/android.yml` | Har push par APK aur Play Store AAB banata hai aur GitHub Release me daalta hai. |
| `.github/workflows/pages.yml` | `web/` ko GitHub Pages par daalta hai (web link). |
| `playstore/` | Store listing ka text, icon, feature graphic aur screenshots. |

Translation ke liye Google ki free translation service use hoti hai. Calls do phones ke beech seedhi WebRTC se hoti hain, aur dono ko jodne ke liye PeerJS ka free server use hota hai.

## ⚠️ Zaroori baatein
- WhatsApp aur SIM call ki awaaz ko koi bhi app seedha badal nahi sakti, kyunki Android/iOS ise allow nahi karte. Isliye uske liye **Speaker Translator** mode hai.
- Is app ki apni call me translation tab hota hai jab dono phones me ye app ho.
- App band (swipe-away) ho to call nahi aayegi. Saamne wale ka app khula ya background me hona chahiye.
- Kuch phones par video call ke dauran mic ek saath call aur awaaz-pehchaan dono ko nahi milta. Aisa ho to **earphone** lagayein, ya likh kar bhejein (call screen par type box hai).
