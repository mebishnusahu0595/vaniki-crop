# 🌾 Vaniki Crop Science — Tally Auto-Sync Agent Setup Guide (Windows 10)

यह Agent आपके Ground Floor वाले Windows 10 PC पर चलेगा जहाँ **Tally.ERP 9 / TallyPrime** इनस्टॉल है।  
जैसे ही SuperAdmin किसी डीलर की प्रोडक्ट रिक्वेस्ट या ऑर्डर अप्रूव करेगा, यह एजेंट **ऑटोमेटिक Tally में GST Sales Bill बना देगा** और उसका बिल नंबर Dealers App व User App में भेज देगा।

---

## 🛠️ Step 1: Tally में XML Port 9000 चालू करें (सिर्फ 1 मिनट)

1. Windows 10 PC में **Tally.ERP 9 / TallyPrime** खोलें।
2. कीबोर्ड पर **`F12`** दबाएं (Configure) $\rightarrow$ **`Advanced Configuration`** में जाएं।
3. नीचे दी गई 3 सेटिंग्स चेक/बदलें:
   * **`Tally is acting as`**: `Both` (या `Server`)
   * **`Enable ODBC Server`**: `Yes`
   * **`Port`**: `9000`
4. **Enter** दबाकर सेव करें और **Tally को Restart कर लें**।
5. Tally में अपनी **Company (उदा. Vaniki Crop Science)** खोल कर रखें।

---

## 🚀 Step 2: Windows PC पर Sync Agent चलाना

1. इस पूरे **`tally-agent`** फ़ोल्डर को Ground Floor वाले Windows 10 PC पर कॉपी करें (उदा. Desktop या C: Drive पर)।
2. अगर PC में **Node.js** नहीं है, तो [nodejs.org](https://nodejs.org/) से **Node.js LTS** डाउनलोड करके 1 मिनट में इनस्टॉल कर लें।
3. फ़ोल्डर में जाकर **`start-tally-agent.bat`** पर **Double Click** करें!

---

## ⚙️ Configuration (`config.json`)

फ़ोल्डर के अंदर `config.json` फ़ाइल में:
```json
{
  "serverApiUrl": "https://vanikicrop.com/api/tally",
  "agentSecretKey": "vaniki_tally_sec_2026_x9k",
  "tallyHost": "127.0.0.1",
  "tallyPort": 9000,
  "pollIntervalSeconds": 10,
  "autoSync": true
}
```

* **`tallyPort`**: `9000` (Tally का डिफ़ॉल्ट पोर्ट)
* **`pollIntervalSeconds`**: `10` (हर 10 सेकंड में नए अप्रूव्ड इनवॉइस चेक करेगा)

---

## 📊 Tally Ledgers Requirement
Tally में ये Ledgers बने होने चाहिए (ताकि वाउचर पोस्ट हो सके):
1. **Sales Ledger**: `Sales - Agro Chemicals` (या जो नाम आप रखें)
2. **Tax Ledgers**: `CGST Output`, `SGST Output`, `IGST Output`
3. **Party Ledger**: Dealer/Customer Name (Sundry Debtors)
4. **Round Off**: `Round Off`
