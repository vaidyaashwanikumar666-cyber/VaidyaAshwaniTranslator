/* Vaidya Ashwani Live Call Translator – Language list
   Format: [translateCode, "English Name – Native Name", speechLocale]
   speechLocale = unique id + speech recognition / voice locale            */

// Bharat ke Samvidhan ki 8vi Anusuchi (8th Schedule) ki sabhi 22 bhashayein
const LANGS_8TH_SCHEDULE = [
  ['as',       'Assamese – অসমীয়া',      'as-IN'],
  ['bn',       'Bengali – বাংলা',          'bn-IN'],
  ['brx',      'Bodo – बड़ो',              'brx-IN'],
  ['doi',      'Dogri – डोगरी',            'doi-IN'],
  ['gu',       'Gujarati – ગુજરાતી',       'gu-IN'],
  ['hi',       'Hindi – हिन्दी',            'hi-IN'],
  ['kn',       'Kannada – ಕನ್ನಡ',           'kn-IN'],
  ['ks',       'Kashmiri – कॉशुर / كٲشُر',  'ks-IN'],
  ['gom',      'Konkani – कोंकणी',          'kok-IN'],
  ['mai',      'Maithili – मैथिली',         'mai-IN'],
  ['ml',       'Malayalam – മലയാളം',       'ml-IN'],
  ['mni-Mtei', 'Manipuri – ꯃꯤꯇꯩꯂꯣꯟ',      'mni-IN'],
  ['mr',       'Marathi – मराठी',           'mr-IN'],
  ['ne',       'Nepali – नेपाली',           'ne-NP'],
  ['or',       'Odia – ଓଡ଼ିଆ',              'or-IN'],
  ['pa',       'Punjabi – ਪੰਜਾਬੀ',          'pa-IN'],
  ['sa',       'Sanskrit – संस्कृतम्',       'sa-IN'],
  ['sat',      'Santali – ᱥᱟᱱᱛᱟᱲᱤ',        'sat-IN'],
  ['sd',       'Sindhi – سنڌي',            'sd-IN'],
  ['ta',       'Tamil – தமிழ்',             'ta-IN'],
  ['te',       'Telugu – తెలుగు',           'te-IN'],
  ['ur',       'Urdu – اردو',              'ur-IN'],
];

// Bharat ki anya pramukh bhashayein / boliyan
const LANGS_INDIA_OTHER = [
  ['en',  'English (India)',           'en-IN'],
  ['bho', 'Bhojpuri – भोजपुरी',        'bho-IN'],
  ['awa', 'Awadhi – अवधी',            'awa-IN'],
  ['mwr', 'Marwadi – मारवाड़ी',        'mwr-IN'],
  ['tcy', 'Tulu – ತುಳು',               'tcy-IN'],
  ['lus', 'Mizo – Mizo ṭawng',        'lus-IN'],
  ['kha', 'Khasi – Ka Ktien Khasi',   'kha-IN'],
  ['hne', 'Chhattisgarhi – छत्तीसगढ़ी', 'hne-IN'],
];

// Duniya ki bhashayein
const LANGS_WORLD = [
  ['af','Afrikaans','af-ZA'],['sq','Albanian – Shqip','sq-AL'],['am','Amharic – አማርኛ','am-ET'],
  ['ar','Arabic – العربية','ar-SA'],['ar','Arabic (Egypt) – العربية','ar-EG'],['hy','Armenian – Հայերեն','hy-AM'],
  ['ay','Aymara','ay-BO'],['az','Azerbaijani – Azərbaycan','az-AZ'],['bm','Bambara','bm-ML'],
  ['eu','Basque – Euskara','eu-ES'],['be','Belarusian – Беларуская','be-BY'],['bs','Bosnian – Bosanski','bs-BA'],
  ['bg','Bulgarian – Български','bg-BG'],['my','Burmese – မြန်မာ','my-MM'],['ca','Catalan – Català','ca-ES'],
  ['ceb','Cebuano','ceb-PH'],['ny','Chichewa','ny-MW'],['zh-CN','Chinese (Mandarin, Simplified) – 中文','zh-CN'],
  ['zh-TW','Chinese (Traditional, Taiwan) – 中文','zh-TW'],['yue','Cantonese – 粵語','yue-HK'],['co','Corsican','co-FR'],
  ['hr','Croatian – Hrvatski','hr-HR'],['cs','Czech – Čeština','cs-CZ'],['da','Danish – Dansk','da-DK'],
  ['dv','Dhivehi – ދިވެހި','dv-MV'],['nl','Dutch – Nederlands','nl-NL'],['dz','Dzongkha – རྫོང་ཁ','dz-BT'],
  ['en','English (US)','en-US'],['en','English (UK)','en-GB'],['en','English (Australia)','en-AU'],
  ['eo','Esperanto','eo'],['et','Estonian – Eesti','et-EE'],['ee','Ewe','ee-GH'],
  ['tl','Filipino – Tagalog','fil-PH'],['fi','Finnish – Suomi','fi-FI'],['fr','French – Français','fr-FR'],
  ['fr','French (Canada) – Français','fr-CA'],['fy','Frisian','fy-NL'],['gl','Galician – Galego','gl-ES'],
  ['ka','Georgian – ქართული','ka-GE'],['de','German – Deutsch','de-DE'],['el','Greek – Ελληνικά','el-GR'],
  ['gn','Guarani','gn-PY'],['ht','Haitian Creole','ht-HT'],['ha','Hausa','ha-NG'],
  ['haw','Hawaiian','haw-US'],['iw','Hebrew – עברית','he-IL'],['hmn','Hmong','hmn'],
  ['hu','Hungarian – Magyar','hu-HU'],['is','Icelandic – Íslenska','is-IS'],['ig','Igbo','ig-NG'],
  ['ilo','Ilocano','ilo-PH'],['id','Indonesian – Bahasa Indonesia','id-ID'],['ga','Irish – Gaeilge','ga-IE'],
  ['it','Italian – Italiano','it-IT'],['ja','Japanese – 日本語','ja-JP'],['jw','Javanese – Basa Jawa','jv-ID'],
  ['kk','Kazakh – Қазақ','kk-KZ'],['km','Khmer – ខ្មែរ','km-KH'],['rw','Kinyarwanda','rw-RW'],
  ['ko','Korean – 한국어','ko-KR'],['kri','Krio','kri-SL'],['ku','Kurdish (Kurmanji)','ku-TR'],
  ['ckb','Kurdish (Sorani) – کوردی','ckb-IQ'],['ky','Kyrgyz – Кыргызча','ky-KG'],['lo','Lao – ລາວ','lo-LA'],
  ['la','Latin','la'],['lv','Latvian – Latviešu','lv-LV'],['ln','Lingala','ln-CD'],
  ['lt','Lithuanian – Lietuvių','lt-LT'],['lg','Luganda','lg-UG'],['lb','Luxembourgish','lb-LU'],
  ['mk','Macedonian – Македонски','mk-MK'],['mg','Malagasy','mg-MG'],['ms','Malay – Bahasa Melayu','ms-MY'],
  ['mt','Maltese – Malti','mt-MT'],['mi','Maori','mi-NZ'],['mn','Mongolian – Монгол','mn-MN'],
  ['no','Norwegian – Norsk','nb-NO'],['om','Oromo','om-ET'],['ps','Pashto – پښتو','ps-AF'],
  ['fa','Persian – فارسی','fa-IR'],['pl','Polish – Polski','pl-PL'],['pt','Portuguese (Brazil) – Português','pt-BR'],
  ['pt','Portuguese (Portugal) – Português','pt-PT'],['qu','Quechua','qu-PE'],['ro','Romanian – Română','ro-RO'],
  ['ru','Russian – Русский','ru-RU'],['sm','Samoan','sm-WS'],['gd','Scots Gaelic','gd-GB'],
  ['sr','Serbian – Српски','sr-RS'],['st','Sesotho','st-ZA'],['sn','Shona','sn-ZW'],
  ['si','Sinhala – සිංහල','si-LK'],['sk','Slovak – Slovenčina','sk-SK'],['sl','Slovenian – Slovenščina','sl-SI'],
  ['so','Somali – Soomaali','so-SO'],['es','Spanish – Español','es-ES'],['es','Spanish (Mexico) – Español','es-MX'],
  ['es','Spanish (US) – Español','es-US'],['su','Sundanese','su-ID'],['sw','Swahili – Kiswahili','sw-KE'],
  ['sv','Swedish – Svenska','sv-SE'],['tg','Tajik – Тоҷикӣ','tg-TJ'],['ta','Tamil (Sri Lanka) – தமிழ்','ta-LK'],
  ['ta','Tamil (Singapore) – தமிழ்','ta-SG'],['tt','Tatar – Татар','tt-RU'],['th','Thai – ไทย','th-TH'],
  ['bo','Tibetan – བོད་སྐད','bo-CN'],['ti','Tigrinya – ትግርኛ','ti-ER'],['ts','Tsonga','ts-ZA'],
  ['tr','Turkish – Türkçe','tr-TR'],['tk','Turkmen','tk-TM'],['ak','Twi (Akan)','ak-GH'],
  ['uk','Ukrainian – Українська','uk-UA'],['ug','Uyghur – ئۇيغۇرچە','ug-CN'],['ur','Urdu (Pakistan) – اردو','ur-PK'],
  ['uz','Uzbek – Oʻzbek','uz-UZ'],['vi','Vietnamese – Tiếng Việt','vi-VN'],['cy','Welsh – Cymraeg','cy-GB'],
  ['xh','Xhosa – isiXhosa','xh-ZA'],['yi','Yiddish – ייִדיש','yi'],['yo','Yoruba – Yorùbá','yo-NG'],
  ['zu','Zulu – isiZulu','zu-ZA'],['bn','Bengali (Bangladesh) – বাংলা','bn-BD'],['ne','Nepali (Nepal) – नेपाली','ne-NP2'],
  ['ar','Arabic (UAE) – العربية','ar-AE'],['fr','French (Africa) – Français','fr-SN'],['ms','Malay (Singapore)','ms-SG'],
];

const LANG_GROUPS = [
  { label: '🇮🇳 8vi Anusuchi – 22 Bhartiya Bhashayein', list: LANGS_8TH_SCHEDULE },
  { label: '🇮🇳 Anya Bhartiya Bhashayein', list: LANGS_INDIA_OTHER },
  { label: '🌍 Duniya ki Bhashayein', list: LANGS_WORLD },
];

const LANG_BY_ID = {};
LANG_GROUPS.forEach(g => g.list.forEach(([t, n, s]) => {
  LANG_BY_ID[s] = { t, n, s, speech: s === 'ne-NP2' ? 'ne-NP' : s };
}));
