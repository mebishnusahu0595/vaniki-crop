# 🌾 Vaniki Crop Science — Tally Auto-Sync Agent Setup Guide (Windows 10)

यह Agent आपके Ground Floor वाले Windows 10 PC पर चलेगा जहाँ **Tally.ERP 9 / TallyPrime** इनस्टॉल है।  
जैसे ही SuperAdmin किसी डीलर की प्रोडक्ट रिक्वेस्ट या ऑर्डर अप्रूव करेगा, यह एजेंट **ऑटोमेटिक Tally में GST Sales Bill बना देगा** और उसका बिल नंबर Dealers App व User App में भेज देगा।

---

## 🛠️ Step 1: Tally में XML Port 9000 चालू करें (सिर्फ 1 मिनट)

1. Windows 10 PC में **Tally.ERP 9 / TallyPrime** खोलें।
2. कीबोर्ड पर **`F12`** (Configure) दबाएं $\rightarrow$ **`Advanced Configuration`** में जाएं।
3. नीचे दी गई 3 सेटिंग्स चेक/बदलें:
   * **`Tally is acting as`**: `Both` (या `Server`)
   * **`Enable ODBC Server`**: `Yes`
   * **`Port`**: `9000`
4. **Enter** दबाकर सेव करें और **Tally को बंद करके दोबारा चालू (Restart) कर लें**।
5. Tally में अपनी **Company (उदा. Vaniki Crop Science)** खोल कर रखें।

---

## 🚀 Step 2: Windows 10 PC पर 24/7 Auto-Start Setup

1. इस पूरे **`tally-agent`** फ़ोल्डर को Ground Floor वाले Windows 10 PC पर कॉपी करें (उदा. Desktop पर)।
2. अगर PC में **Node.js** नहीं है, तो [nodejs.org](https://nodejs.org/) से **Node.js LTS** डाउनलोड करके 1 मिनट में इनस्टॉल कर लें।
3. फ़ोल्डर खोलकर **`enable-autostart-on-boot.bat`** पर **Double Click** करें!
   * ✅ **Computer restart होने के बाद भी यह अपने आप तुरंत चालू हो जाएगा!**
   * ✅ **Watchdog Loop** लगा हुआ है — अगर कभी गलती से विंडो बंद भी हो जाए, तो 5 सेकंड में खुद दोबारा रीस्टार्ट हो जाएगी।

---

## 📁 फ़ोल्डर में क्या-क्या है?

| फ़ाइल | काम |
| :--- | :--- |
| **`start-tally-agent.bat`** | लाइव स्क्रीन के साथ एजेंट चलाने के लिए (Watchdog Auto-Restart Enabled)। |
| **`enable-autostart-on-boot.bat`** | कंप्यूटर ऑन/रीस्टार्ट होने पर ऑटोमेटिक चालू करने के लिए। |
| **`start-silent-background.vbs`** | बिना किसी ब्लैक विंडो के बैकग्राउंड में साइलेंटली चलाने के लिए। |
| **`disable-autostart.bat`** | ऑटो-स्टार्ट हटाने के लिए। |
| **`vaniki-tally-sync.js`** | मुख्य सिंक इंजन जो Tally Port 9000 से बात करता है। |
| **`config.json`** | API URL और Port 9000 की सेटिंग्स। |
| **`tally-agent.log`** | सभी सिंक और एरर के लॉग्स यहाँ सुरक्षित रहते हैं। |
