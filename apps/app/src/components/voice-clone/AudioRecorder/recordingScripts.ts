/**
 * Pre-built ~20 second reading passages for voice cloning recording.
 *
 * When a user taps "Record" on the IVC page, they see this passage
 * in their selected language. Reading it aloud gives the model a
 * clean, varied reference sample (~20 seconds of natural speech).
 *
 * Each passage uses proper punctuation so the reader naturally pauses
 * and varies their intonation — producing a richer voice sample.
 *
 * Coverage:
 *   - Top 10 Indian languages (hi, bn, te, ta, mr, gu, kn, ml, pa, ory)
 *   - Top 10 Global languages (en, zh, es, arb, fr, pt, ru, ja, de, ko)
 *
 * If the user's selected language isn't in this map, English is used.
 */

export const RECORDING_SCRIPTS: Record<string, string> = {
  // ── English (default fallback) ──
  en: "The old wooden bridge stretched across the quiet river, while a gentle breeze moved through the tall trees. Nearby, children laughed in the distance as a small fishing boat drifted slowly along the calm water.",

  // ── Top 10 Indian Languages ──
  hi: "पुराना लकड़ी का पुल शांत नदी के पार फैला था, जबकि हल्की हवा ऊँचे पेड़ों के बीच से बह रही थी। पास में बच्चे दूर से हँस रहे थे, जब एक छोटी मछली पकड़ने वाली नाव शांत पानी पर धीरे-धीरे बहती जा रही थी।",

  bn: "পুরানো কাঠের সেতুটি শান্ত নদীর ওপর বিস্তৃত ছিল, যখন মৃদু বাতাস লম্বা গাছের মধ্য দিয়ে বয়ে যাচ্ছিল। কাছেই দূরে শিশুরা হাসছিল, যখন একটি ছোট মাছ ধরার নৌকা ধীরে ধীরে শান্ত জলের ওপর ভেসে যাচ্ছিল।",

  te: "పాత కలప వంతెన ప్రశాంతమైన నదిపై విస్తరించి ఉంది; తేలికపాటి గాలి పొడవైన చెట్ల మధ్య నుండి వీస్తూ ఉంది. సమీపంలో పిల్లలు దూరంగా నవ్వుతూ ఉన్నారు, ఒక చిన్న చేపల పడవ ప్రశాంతమైన నీటిపై నెమ్మదిగా కదులుతూ ఉంది.",

  ta: "பழைய மரப்பாலம் அமைதியான ஆற்றின் குறுக்கே நீண்டிருந்தது, மென்மையான தென்றல் உயரமான மரங்களுக்கு இடையே வீசியது. அருகில் குழந்தைகள் தூரத்தில் சிரித்தனர்; ஒரு சிறிய மீன்பிடி படகு அமைதியான நீரில் மெதுவாக மிதந்து சென்றது.",

  mr: "जुना लाकडी पूल शांत नदीवर पसरला होता, तर सौम्य वारा उंच झाडांमधून वाहत होता. जवळच मुले दूरवर हसत होती, जेव्हा एक छोटी मासेमारीची नाव शांत पाण्यावर हळूहळू वाहत जात होती.",

  gu: "જૂનો લાકડાનો પુલ શાંત નદી પર ફેલાયેલો હતો, જ્યારે હળવી પવન ઊંચા વૃક્ષોની વચ્ચેથી વહેતો હતો. નજીકમાં બાળકો દૂરથી હસતા હતા, જ્યારે એક નાની માછીમારી નાવ શાંત પાણી પર ધીમે ધીમે તરતી જતી હતી.",

  kn: "ಹಳೆಯ ಮರದ ಸೇತುವೆ ಶಾಂತ ನದಿಯ ಮೇಲೆ ಹರಡಿತ್ತು, ಮೃದುವಾದ ಗಾಳಿ ಎತ್ತರದ ಮರಗಳ ನಡುವೆ ಬೀಸುತ್ತಿತ್ತು. ಹತ್ತಿರದಲ್ಲಿ ಮಕ್ಕಳು ದೂರದಲ್ಲಿ ನಗುತ್ತಿದ್ದರು; ಒಂದು ಸಣ್ಣ ಮೀನುಗಾರಿಕೆ ದೋಣಿ ಶಾಂತ ನೀರಿನ ಮೇಲೆ ನಿಧಾನವಾಗಿ ತೇಲುತ್ತಿತ್ತು.",

  ml: "പഴയ മരപ്പാലം ശാന്തമായ നദിക്ക് കുറുകെ നീണ്ടുകിടന്നു; മൃദുവായ കാറ്റ് ഉയരമുള്ള മരങ്ങൾക്കിടയിലൂടെ വീശി. അടുത്തുള്ള കുട്ടികൾ ദൂരെ ചിരിച്ചു, ഒരു ചെറിയ മീൻപിടുത്ത വള്ളം ശാന്തമായ വെള്ളത്തിലൂടെ പതുക്കെ ഒഴുകിനടന്നു.",

  pa: "ਪੁਰਾਣਾ ਲੱਕੜੀ ਦਾ ਪੁਲ ਸ਼ਾਂਤ ਨਦੀ ਤੇ ਫੈਲਿਆ ਹੋਇਆ ਸੀ, ਜਦੋਂ ਹਲਕੀ ਹਵਾ ਉੱਚੇ ਰੁੱਖਾਂ ਵਿਚੋਂ ਵਗ ਰਹੀ ਸੀ। ਨੇੜੇ ਬੱਚੇ ਦੂਰੋਂ ਹੱਸ ਰਹੇ ਸਨ, ਜਦੋਂ ਇੱਕ ਛੋਟੀ ਮੱਛੀ ਫੜਨ ਵਾਲੀ ਕਿਸ਼ਤੀ ਸ਼ਾਂਤ ਪਾਣੀ ਤੇ ਹੌਲੀ-ਹੌਲੀ ਵਗਦੀ ਜਾ ਰਹੀ ਸੀ।",

  ory: "ପୁରୁଣା କାଠ ପୋଲ ଶାନ୍ତ ନଦୀ ଉପରେ ବିସ୍ତାରିତ ହୋଇ ରହିଥିଲା, ଯେତେବେଳେ ହାଲୁକା ପବନ ଉଚ୍ଚ ଗଛ ମଧ୍ୟରେ ଦେଇ ବହୁଥିଲା। ନିକଟରେ ପିଲାମାନେ ଦୂରରୁ ହସୁଥିଲେ, ଯେତେବେଳେ ଏକ ଛୋଟ ମାଛ ଧରା ଡଙ୍ଗା ଶାନ୍ତ ଜଳ ଉପରେ ଧୀରେ ଧୀରେ ଭାସି ଯାଉଥିଲା।",

  // ── Top 10 Global Languages ──
  zh: "古老的木桥横跨在宁静的河面上，轻柔的微风穿过高大的树林。附近，孩子们在远处欢笑着；一艘小小的渔船在平静的水面上缓缓漂流。",

  es: "El viejo puente de madera se extendía sobre el río tranquilo, mientras una suave brisa se movía entre los árboles altos. Cerca, los niños reían a lo lejos, mientras un pequeño bote de pesca flotaba lentamente por el agua en calma.",

  arb: "امتدّ الجسر الخشبي القديم عبر النهر الهادئ، بينما كانت نسمة لطيفة تمرّ بين الأشجار العالية القريبة. وكان الأطفال يضحكون في البُعد، بينما كان قارب صيد صغير ينجرف ببطء على طول المياه الهادئة.",

  fr: "Le vieux pont de bois s'étendait au-dessus de la rivière tranquille, tandis qu'une douce brise traversait les grands arbres. Tout près, des enfants riaient au loin, alors qu'un petit bateau de pêche dérivait lentement sur l'eau calme.",

  pt: "A velha ponte de madeira se estendia sobre o rio tranquilo, enquanto uma brisa suave passava entre as árvores altas. Perto dali, crianças riam ao longe; um pequeno barco de pesca flutuava lentamente pela água calma.",

  ru: "Старый деревянный мост протянулся через тихую реку, а лёгкий ветерок проходил сквозь высокие деревья. Неподалёку дети смеялись вдалеке, пока маленькая рыбацкая лодка медленно плыла по спокойной воде.",

  ja: "古い木の橋が、静かな川に架かっていた。穏やかな風が背の高い木々の間を吹き抜けていた。近くで子供たちが遠くで笑っていた。小さな釣り船が、穏やかな水面をゆっくりと漂っていた。",

  de: "Die alte Holzbrücke erstreckte sich über den ruhigen Fluss, während eine sanfte Brise durch die hohen Bäume in der Nähe wehte. Kinder lachten in der Ferne, als ein kleines Fischerboot langsam über das ruhige Wasser trieb.",

  ko: "오래된 나무 다리가 조용한 강 위로 뻗어 있었고, 부드러운 바람이 키 큰 나무들 사이로 불어왔다. 가까이에서 아이들이 멀리서 웃고 있었고, 작은 낚시배가 잔잔한 물 위를 천천히 떠가고 있었다.",
};

/** Returns the recording script for a language code, falling back to English. */
export function getRecordingScript(languageCode: string): string {
  return RECORDING_SCRIPTS[languageCode] || RECORDING_SCRIPTS.en;
}

/**
 * Map from language code → human-readable language name.
 * Used to display "Selected language · Hindi" in the recorder UI.
 */
export const RECORDING_LANG_NAMES: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  te: "Telugu",
  ta: "Tamil",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi",
  ory: "Odia",
  zh: "Chinese",
  es: "Spanish",
  arb: "Arabic",
  fr: "French",
  pt: "Portuguese",
  ru: "Russian",
  ja: "Japanese",
  de: "German",
  ko: "Korean",
};

/** Returns readable language name, falling back to "English". */
export function getRecordingLangName(languageCode: string): string {
  return RECORDING_LANG_NAMES[languageCode] || "English";
}
