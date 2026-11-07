import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "../../i18n.jsx";
import api from "../../services/api";
import platformApi from "../../services/platformApi";
import {
  SparklesIcon,
  PlusIcon,
  ClockIcon,
  TrashIcon,
  CheckIcon,
} from "../UiIcons.jsx";
import "./ai-assistant.css";

// 11-Language Native Script Localization Dictionary for AI Interface
const AI_TRANSLATIONS = {
  en: {
    title: "Svaadya AI",
    platformTitle: "Platform Intelligence AI",
    tagline: "Context-Aware Restaurant Assistant",
    platformTagline: "SaaS Operations & Telemetry",
    placeholder: "Ask about sales, 7d stock forecast, festival prep...",
    send: "Send",
    newChat: "New Chat",
    clearChat: "Clear Chat",
    confirmClear: "Clear this conversation history?",
    history: "Past Conversations",
    noHistory: "No saved conversations",
    proposedAction: "Proposed Action",
    approveAndExecute: "Approve & Execute",
    reject: "Reject",
    executed: "Executed Successfully",
    rejected: "Action Rejected",
    executing: "Executing...",
    suggestionsTitle: "Suggested Questions",
    shortcutHint: "Press Ctrl + / to toggle",
    errorRateLimit: "Rate limit reached. Please wait a moment.",
    errorGeneric: "Failed to communicate with AI Assistant.",
    online: "Online & Context Aware",
  },
  hi: {
    title: "स्वादिया AI",
    platformTitle: "प्लेटफ़ॉर्म इंटेलिजेंस AI",
    tagline: "संदर्भ-सचेत रेस्तरां सहायक",
    platformTagline: "SaaS संचालन और टेलीमेट्री",
    placeholder: "बिक्री, 7-दिवसीय स्टॉक पूर्वानुमान, त्योहार की तैयारी पूछें...",
    send: "भेजें",
    newChat: "नई बातचीत",
    clearChat: "चैट साफ़ करें",
    confirmClear: "क्या आप इस बातचीत को साफ़ करना चाहते हैं?",
    history: "पिछली बातचीत",
    noHistory: "कोई सहेजी गई बातचीत नहीं",
    proposedAction: "प्रस्तावित कार्रवाई",
    approveAndExecute: "स्वीकृत करें और निष्पादित करें",
    reject: "अस्वीकार करें",
    executed: "सफलतापूर्वक निष्पादित",
    rejected: "कार्रवाई अस्वीकार कर दी गई",
    executing: "निष्पादित हो रहा है...",
    suggestionsTitle: "सुझाए गए प्रश्न",
    shortcutHint: "खोलने/बंद करने के लिए Ctrl + / दबाएं",
    errorRateLimit: "अनुरोध सीमा पूरी हो गई। कृपया प्रतीक्षा करें।",
    errorGeneric: "AI सहायक से संपर्क विफल रहा।",
    online: "सक्रिय और संदर्भ-सचेत",
  },
  te: {
    title: "స్వాద్య AI",
    platformTitle: "ప్లాట్‌ఫాం ఇంటెలిజెన్స్ AI",
    tagline: "సందర్భ-అవగాహన రెస్టారెంట్ అసిస్టెంట్",
    platformTagline: "SaaS కార్యకలాపాలు & టెలిమెట్రీ",
    placeholder: "అమ్మకాలు, 7 రోజుల స్టాక్ అంచనా, పండుగ తయారీ గురించి అడగండి...",
    send: "పంపండి",
    newChat: "కొత్త సంభాషణ",
    clearChat: "చాట్ క్లియర్ చేయండి",
    confirmClear: "ఈ సంభాషణ చరిత్రను క్లియర్ చేయాలా?",
    history: "గత సంభాషణలు",
    noHistory: "సేవ్ చేసిన సంభాషణలు లేవు",
    proposedAction: "ప్రతిపాదిత చర్య",
    approveAndExecute: "ఆమోదించి అమలు చేయండి",
    reject: "తిరస్కరించండి",
    executed: "విజయవంతంగా అమలు చేయబడింది",
    rejected: "చర్య తిరస్కరించబడింది",
    executing: "అమలు అవుతోంది...",
    suggestionsTitle: "సూచించిన ప్రశ్నలు",
    shortcutHint: "Ctrl + / నొక్కి టోగుల్ చేయండి",
    errorRateLimit: "పరిమితి ముగిసింది. దయచేసి వేచి ఉండండి.",
    errorGeneric: "AI అసిస్టెంట్ కమ్యూనికేషన్ విఫలమైంది.",
    online: "ఆన్‌లైన్ & సిద్ధంగా ఉంది",
  },
  ta: {
    title: "ஸ்வாத்யா AI",
    platformTitle: "பிளாட்ஃபார்ம் நுண்ணறிவு AI",
    tagline: "சூழல் உணர்வுள்ள உணவக உதவியாளர்",
    platformTagline: "SaaS செயல்பாடுகள் மற்றும் அளவீடுகள்",
    placeholder: "விற்பனை, 7 நாள் இருப்பு முன்னறிவிப்பு, பண்டிகை தயாரிப்பு...",
    send: "அனுப்பு",
    newChat: "புதிய உரையாடல்",
    clearChat: "அரட்டையை அழிக்கவும்",
    confirmClear: "இந்த உரையாடலை அழிக்க விரும்புகிறீர்களா?",
    history: "முந்தைய உரையாடல்கள்",
    noHistory: "சேமிக்கப்பட்ட உரையாடல்கள் இல்லை",
    proposedAction: "முன்மொழியப்பட்ட செயல்",
    approveAndExecute: "ஒப்புதல் அளித்து செயல்படுத்தவும்",
    reject: "நிராகரி",
    executed: "வெற்றிகரமாக செயல்படுத்தப்பட்டது",
    rejected: "செயல் நிராகரிக்கப்பட்டது",
    executing: "செயல்படுத்துகிறது...",
    suggestionsTitle: "பரிந்துரைக்கப்பட்ட கேள்விகள்",
    shortcutHint: "மாற்ற Ctrl + / ஐ அழுத்தவும்",
    errorRateLimit: "அனுமதி வரம்பு மீறப்பட்டது. காத்திருக்கவும்.",
    errorGeneric: "AI உதவியாளர் தொடர்பு தோல்வியடைந்தது.",
    online: "செயலில் உள்ளது",
  },
  kn: {
    title: "ಸ್ವಾದ್ಯ AI",
    platformTitle: "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಇಂಟೆಲಿಜೆನ್ಸ್ AI",
    tagline: "ಸಂದರ್ಭ-ತಿಳುವಳಿಕೆಯ ರೆಸ್ಟೋರೆಂಟ್ ಸಹಾಯಕ",
    platformTagline: "SaaS ಕಾರ್ಯಾಚರಣೆಗಳು & ಟೆಲಿಮೆಟ್ರಿ",
    placeholder: "ಮಾರಾಟ, 7 ದಿನಗಳ ದಾಸ್ತಾನು ಮುನ್ಸೂಚನೆ, ಹಬ್ಬದ ತಯಾರಿ ಕುರಿತು ಕೇಳಿ...",
    send: "ಕಳುಹಿಸಿ",
    newChat: "ಹೊಸ ಚಾಟ್",
    clearChat: "ಚಾಟ್ ತೆರವುಗೊಳಿಸಿ",
    confirmClear: "ಈ ಸಂಭಾಷಣೆಯನ್ನು ಅಳಿಸಬೇಕೆ?",
    history: "ಹಿಂದಿನ ಸಂಭಾಷಣೆಗಳು",
    noHistory: "ಯಾವುದೇ ಸಂಭಾಷಣೆ ಉಳಿಸಲಾಗಿಲ್ಲ",
    proposedAction: "ಪ್ರಸ್ತಾವಿತ ಕ್ರಿಯೆ",
    approveAndExecute: "ಅನುಮೋದಿಸಿ & ಕಾರ್ಯಗತಗೊಳಿಸಿ",
    reject: "ತಿರಸ್ಕರಿಸಿ",
    executed: "ಯಶಸ್ವಿಯಾಗಿ ಕಾರ್ಯಗತಗೊಂಡಿದೆ",
    rejected: "ಕ್ರಿಯೆ ತಿರಸ್ಕರಿಸಲಾಗಿದೆ",
    executing: "ಕಾರ್ಯಗತಗೊಳಿಸಲಾಗುತ್ತಿದೆ...",
    suggestionsTitle: "ಸೂಚಿಸಲಾದ ಪ್ರಶ್ನೆಗಳು",
    shortcutHint: "ಟಾಗಲ್ ಮಾಡಲು Ctrl + / ಒತ್ತಿರಿ",
    errorRateLimit: "ವಿನಂತಿ ಮಿತಿ ಮೀರಿದೆ. ದಯವಿಟ್ಟು ನಿರೀಕ್ಷಿಸಿ.",
    errorGeneric: "AI ಸಹಾಯಕ ಸಂಪರ್ಕ ವಿಫಲವಾಗಿದೆ.",
    online: "ಆನ್‌ಲೈನ್ ಮತ್ತು ಸಕ್ರಿಯ",
  },
  ml: {
    title: "സ്വാദ്യ AI",
    platformTitle: "പ്ലാറ്റ്ഫോം ഇന്റലിജൻസ് AI",
    tagline: "റെസ്റ്റോറന്റ് ഓപ്പറേറ്റിംഗ് അസിസ്റ്റന്റ്",
    platformTagline: "SaaS പ്രവർത്തനങ്ങളും ടെലിമെട്രിയും",
    placeholder: "വിൽപ്പന, 7 ദിവസത്തെ സ്റ്റോക്ക് പ്രവചനം, ഉത്സവ ഒരുക്കങ്ങൾ...",
    send: "അയക്കുക",
    newChat: "പുതിയ ചാറ്റ്",
    clearChat: "ചാറ്റ് മായ്‌ക്കുക",
    confirmClear: "ഈ സംഭാഷണം മായ്‌ക്കണോ?",
    history: "മുൻകാല സംഭാഷണങ്ങൾ",
    noHistory: "സംരക്ഷിച്ച സംഭാഷണങ്ങളൊന്നുമില്ല",
    proposedAction: "നിർദ്ദേശിച്ച പ്രവർത്തനം",
    approveAndExecute: "അംഗീകരിച്ച് നടപ്പിലാക്കുക",
    reject: "നിരസിക്കുക",
    executed: "വിജയകരമായി നടപ്പിലാക്കി",
    rejected: "പ്രവർത്തനം നിരസിച്ചു",
    executing: "നടപ്പിലാക്കുന്നു...",
    suggestionsTitle: "നിർദ്ദേശിച്ച ചോദ്യങ്ങൾ",
    shortcutHint: "തുറക്കാൻ Ctrl + / അമർത്തുക",
    errorRateLimit: "പരിധി കഴിഞ്ഞു. അൽപ്പസമയം കാത്തിരിക്കുക.",
    errorGeneric: "AI അസിസ്റ്റന്റ് കണക്ഷൻ പരാജയപ്പെട്ടു.",
    online: "ഓൺലൈൻ & സജീവം",
  },
  mr: {
    title: "स्वादिया AI",
    platformTitle: "प्लॅटफॉर्म इंटेलिजन्स AI",
    tagline: "रेस्टॉरंट ऑपरेटिंग असिस्टंट",
    platformTagline: "SaaS ऑपरेशन्स आणि टेलिमेट्री",
    placeholder: "विक्री, ७ दिवसांचा साठा अंदाज, सणांची तयारी विचारा...",
    send: "पाठवा",
    newChat: "नवीन संभाषण",
    clearChat: "चॅट साफ करा",
    confirmClear: "हे संभाषण साफ करायचे आहे का?",
    history: "मागील संभाषणे",
    noHistory: "कोणतेही संभाषण सेव्ह केलेले नाही",
    proposedAction: "प्रस्तावित कृती",
    approveAndExecute: "मंजूर करा आणि कार्यान्वित करा",
    reject: "नाकारा",
    executed: "यशस्वीरित्या कार्यान्वित",
    rejected: "कृती नाकारली",
    executing: "कार्यान्वित होत आहे...",
    suggestionsTitle: "सुचवलेले प्रश्न",
    shortcutHint: "उघडण्यासाठी Ctrl + / दाबा",
    errorRateLimit: "मर्यादा गाठली आहे. कृपया प्रतीक्षा करा.",
    errorGeneric: "AI सहाय्यक संपर्क अयशस्वी.",
    online: "सक्रिय आणि ऑनलाइन",
  },
  bn: {
    title: "স্বাদ্যা AI",
    platformTitle: "প্ল্যাটফর্ম ইন্টেলিজেন্স AI",
    tagline: "রেস্তোরাঁ অপারেটিং সহকারী",
    platformTagline: "SaaS অপারেশন ও টেলিমেট্রি",
    placeholder: "বিক্রয়, ৭ দিনের স্টক পূর্বাভাস, উৎসবের প্রস্তুতি জিজ্ঞাসা করুন...",
    send: "পাঠান",
    newChat: "নতুন চ্যাট",
    clearChat: "চ্যাট মুছুন",
    confirmClear: "এই কথোপকথনটি মুছতে চান?",
    history: "পূর্ববর্তী কথোপকথন",
    noHistory: "কোনো কথোপকথন সংরক্ষিত নেই",
    proposedAction: "প্রস্তাবিত পদক্ষেপ",
    approveAndExecute: "অনুমোদন করুন ও কার্যকর করুন",
    reject: "প্রত্যাখ্যান",
    executed: "সফলভাবে কার্যকর হয়েছে",
    rejected: "পদক্ষেপ প্রত্যাখ্যাত",
    executing: "কার্যকর হচ্ছে...",
    suggestionsTitle: "প্রস্তাবিত প্রশ্নাবলী",
    shortcutHint: "টগল করতে Ctrl + / টিপুন",
    errorRateLimit: "অনুরোধের সীমা শেষ। অপেক্ষা করুন।",
    errorGeneric: "AI সহকারীর সাথে যোগাযোগ ব্যর্থ হয়েছে।",
    online: "অনলাইন ও প্রস্তুত",
  },
  gu: {
    title: "સ્વાદ્યા AI",
    platformTitle: "પ્લેટફોર્મ ઇન્ટેલિજન્સ AI",
    tagline: "રેસ્ટોરન્ટ ઓપરેટિંગ સહાયક",
    platformTagline: "SaaS ઓપરેશન્સ અને ટેલિમેટ્રી",
    placeholder: "વેચાણ, ૭ દિવસનો સ્ટોક અંદાજ, તહેવારની તૈયારી પૂછો...",
    send: "મોકલો",
    newChat: "નવી વાતચીત",
    clearChat: "ચેટ સાફ કરો",
    confirmClear: "શું તમે આ વાતચીત સાફ કરવા માંગો છો?",
    history: "અગાઉની વાતચીતો",
    noHistory: "કોઈ વાતચીત સાચવેલ નથી",
    proposedAction: "સૂચિત ક્રિયા",
    approveAndExecute: "મંજૂર કરો અને અમલ કરો",
    reject: "અસ્વીકાર કરો",
    executed: "સફળતાપૂર્વક અમલમાં મુકાયેલ",
    rejected: "ક્રિયા અસ્વીકાર થઈ",
    executing: "અમલમાં મુકાઈ રહ્યું છે...",
    suggestionsTitle: "સૂચવેલા પ્રશ્નો",
    shortcutHint: "ટોગલ કરવા માટે Ctrl + / દબાવો",
    errorRateLimit: "મર્યાદા સમાપ્ત થઈ. થોડીવાર રાહ જુઓ.",
    errorGeneric: "AI સહાયક સાથે સંપર્ક નિષ્ફળ ગયો.",
    online: "ઑનલાઇન અને સક્રિય",
  },
  pa: {
    title: "ਸਵਾਦਿਆ AI",
    platformTitle: "ਪਲੇਟਫਾਰਮ ਇੰਟੈਲੀਜੈਂਸ AI",
    tagline: "ਰੈਸਟੋਰੈਂਟ ਓਪਰੇਟਿੰਗ ਸਹਾਇਕ",
    platformTagline: "SaaS ਕਾਰਜ ਅਤੇ ਟੈਲੀਮੈਟਰੀ",
    placeholder: "ਵਿਕਰੀ, 7 ਦਿਨਾਂ ਦੇ ਸਟਾਕ ਅਨੁਮਾਨ, ਤਿਉਹਾਰਾਂ ਦੀ ਤਿਆਰੀ ਬਾਰੇ ਪੁੱਛੋ...",
    send: "ਭੇਜੋ",
    newChat: "ਨਵੀਂ ਗੱਲਬਾਤ",
    clearChat: "ਚੈਟ ਸਾਫ਼ ਕਰੋ",
    confirmClear: "ਕੀ ਤੁਸੀਂ ਇਹ ਗੱਲਬਾਤ ਸਾਫ਼ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?",
    history: "ਪਿਛਲੀਆਂ ਗੱਲਬਾਤਾਂ",
    noHistory: "ਕੋਈ ਗੱਲਬਾਤ ਸੁਰੱਖਿਅਤ ਨਹੀਂ",
    proposedAction: "ਸੁਝਾਈ ਗਈ ਕਾਰਵਾਈ",
    approveAndExecute: "ਮਨਜ਼ੂਰ ਕਰੋ ਅਤੇ ਲਾਗੂ ਕਰੋ",
    reject: "ਰੱਦ ਕਰੋ",
    executed: "ਸਫਲਤਾਪੂਰਵਕ ਲਾਗੂ ਕੀਤਾ ਗਿਆ",
    rejected: "ਕਾਰਵਾਈ ਰੱਦ ਕੀਤੀ ਗਈ",
    executing: "ਲਾਗੂ ਕੀਤਾ ਜਾ ਰਿਹਾ ਹੈ...",
    suggestionsTitle: "ਸੁਝਾਏ ਗਏ ਸਵਾਲ",
    shortcutHint: "ਟੌਗਲ ਕਰਨ ਲਈ Ctrl + / ਦਬਾਓ",
    errorRateLimit: "ਬੇਨਤੀ ਸੀਮਾ ਖਤਮ ਹੋ ਗਈ। ਉਡੀਕ ਕਰੋ ਜੀ।",
    errorGeneric: "AI ਸਹਾਇਕ ਨਾਲ ਸੰਪਰਕ ਅਸਫਲ ਰਿਹਾ।",
    online: "ਔਨਲਾਈਨ ਅਤੇ ਤਿਆਰ",
  },
  ar: {
    title: "سوادهيا الذكاء الاصطناعي",
    platformTitle: "ذكاء المنصة الاصطناعي",
    tagline: "مساعد تشغيل المطاعم الذكي",
    platformTagline: "عمليات الساس والقياس عن بعد",
    placeholder: "اسأل عن المبيعات، توقعات المخزون لـ 7 أيام، وتجهيزات المناسبات...",
    send: "إرسال",
    newChat: "محادثة جديدة",
    clearChat: "مسح المحادثة",
    confirmClear: "هل أنت متأكد من مسح هذه المحادثة؟",
    history: "المحادثات السابقة",
    noHistory: "لا توجد محادثات محفوظة",
    proposedAction: "إجراء مقترح",
    approveAndExecute: "موافقة وتنفيذ",
    reject: "رفض",
    executed: "تم التنفيذ بنجاح",
    rejected: "تم رفض الإجراء",
    executing: "جاري التنفيذ...",
    suggestionsTitle: "أسئلة مقترحة",
    shortcutHint: "اضغط على Ctrl + / للتبديل",
    errorRateLimit: "تم الوصول إلى الحد الأقصى للطلبات. يُرجى الانتظار.",
    errorGeneric: "فشل الاتصال بمساعد الذكاء الاصطناعي.",
    online: "متصل وواعي بالسياق",
  },
};

// Formats basic markdown elements (tables, headers, bold, bullet points)
function renderFormattedContent(text) {
  if (!text) return null;

  // Check if text has markdown table
  const lines = text.split("\n");
  const parsedElements = [];
  let currentTable = null;
  let inCodeBlock = false;
  let codeLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        parsedElements.push(
          <pre key={`code-${i}`} className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-xs overflow-x-auto my-2">
            <code>{codeLines.join("\n")}</code>
          </pre>
        );
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Markdown Table Detection
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      if (!currentTable) {
        currentTable = { headers: [], rows: [] };
      }
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (cells.some((c) => c.match(/^:?-+:?$/))) {
        // separator row, skip
        continue;
      }
      if (currentTable.headers.length === 0) {
        currentTable.headers = cells;
      } else {
        currentTable.rows.push(cells);
      }
      continue;
    } else if (currentTable) {
      // Flush completed table
      parsedElements.push(
        <div key={`table-${i}`} className="overflow-x-auto my-2">
          <table>
            <thead>
              <tr>
                {currentTable.headers.map((h, hi) => (
                  <th key={hi}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentTable.rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTable = null;
    }

    // List items
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      parsedElements.push(
        <li key={`li-${i}`} className="text-xs text-slate-700 py-0.5">
          {formatInline(line.trim().substring(2))}
        </li>
      );
      continue;
    }

    // Regular paragraphs / headers
    if (line.trim().startsWith("### ")) {
      parsedElements.push(
        <h4 key={`h4-${i}`} className="text-xs font-bold text-slate-900 mt-2 mb-1">
          {line.trim().substring(4)}
        </h4>
      );
    } else if (line.trim().startsWith("## ")) {
      parsedElements.push(
        <h3 key={`h3-${i}`} className="text-sm font-bold text-indigo-900 mt-2.5 mb-1">
          {line.trim().substring(3)}
        </h3>
      );
    } else if (line.trim()) {
      parsedElements.push(
        <p key={`p-${i}`} className="text-xs text-slate-800 leading-relaxed mb-1.5">
          {formatInline(line)}
        </p>
      );
    }
  }

  if (currentTable) {
    parsedElements.push(
      <div key="table-end" className="overflow-x-auto my-2">
        <table>
          <thead>
            <tr>
              {currentTable.headers.map((h, hi) => (
                <th key={hi}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentTable.rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return parsedElements;
}

// Inline formatting (bold, code pills)
function formatInline(str) {
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index} className="bg-slate-100 text-indigo-700 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function AiAssistantPanel({ scope = "RESTAURANT" }) {
  const { language, direction } = useTranslation();
  const location = useLocation();

  const isPlatform = scope === "PLATFORM";
  const client = isPlatform ? platformApi : api;
  const strings = AI_TRANSLATIONS[language] || AI_TRANSLATIONS.en;

  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [executingProposalId, setExecutingProposalId] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);

  const messagesEndRef = useRef(null);

  // Derive active module from current route
  const currentModule = React.useMemo(() => {
    const path = location.pathname.toLowerCase();
    if (isPlatform) return "platform_telemetry";
    if (path.includes("/inventory")) return "inventory";
    if (path.includes("/orders")) return "orders";
    if (path.includes("/tables")) return "tables";
    if (path.includes("/menu")) return "menu";
    if (path.includes("/reports")) return "reports";
    if (path.includes("/coupons")) return "coupons";
    if (path.includes("/staff")) return "staff";
    if (path.includes("/payments")) return "payments";
    return "overview";
  }, [location.pathname, isPlatform]);

  // Contextual question chips
  const contextualPrompts = React.useMemo(() => {
    if (isPlatform) {
      return [
        "Active SaaS subscriptions & MRR breakdown",
        "Recent payment failures & webhook diagnostics",
        "System telemetry & database latency status",
      ];
    }
    switch (currentModule) {
      case "inventory":
        return [
          "Show low stock items & 7-day burn forecast",
          "Upcoming Indian festival ingredient checklist",
          "Calculate suggested stock reorder quantities",
        ];
      case "orders":
        return [
          "Today's live revenue & active orders breakdown",
          "Identify order prep bottlenecks & average ticket time",
          "Best selling dishes by order volume today",
        ];
      case "tables":
        return [
          "Current table occupancy & turn rates",
          "Seating efficiency suggestions for peak hours",
        ];
      case "menu":
        return [
          "Top 5 best selling menu items this week",
          "Identify slow moving dishes to review",
        ];
      default:
        return [
          "Today's restaurant operational summary",
          "Upcoming festivals in the next 30 days",
          "Inventory stockout alert check",
        ];
    }
  }, [currentModule, isPlatform]);

  // Keyboard shortcut listener (Ctrl + / or Cmd + /)
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch conversations when opening
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  async function loadConversations() {
    try {
      const res = await client.get("/ai/conversations?limit=10");
      const list = res.items || [];
      setConversations(list);
      if (list.length > 0 && !currentConvId) {
        selectConversation(list[0].id);
      }
    } catch {
      // Ignored if unconfigured
    }
  }

  async function selectConversation(id) {
    setCurrentConvId(id);
    setShowHistoryDropdown(false);
    try {
      const res = await client.get(`/ai/conversations/${id}`);
      if (res.conversation) {
        setMessages(res.conversation.messages || []);
      }
    } catch (err) {
      setErrorMessage(err.message || strings.errorGeneric);
    }
  }

  async function handleNewChat() {
    try {
      const res = await client.post("/ai/conversations", {
        title: "New Conversation",
        currentModule,
        language,
      });
      if (res.conversation) {
        setConversations((prev) => [res.conversation, ...prev]);
        setCurrentConvId(res.conversation.id);
        setMessages([]);
      }
    } catch (err) {
      setErrorMessage(err.message || strings.errorGeneric);
    }
  }

  async function handleClearChat() {
    if (!currentConvId) return;
    if (!window.confirm(strings.confirmClear)) return;
    try {
      await client.post(`/ai/conversations/${currentConvId}/clear`);
      setMessages([]);
    } catch (err) {
      setErrorMessage(err.message || strings.errorGeneric);
    }
  }

  async function handleSendMessage(customPrompt = null) {
    const textToSend = customPrompt || inputValue.trim();
    if (!textToSend || loading) return;

    setInputValue("");
    setErrorMessage("");
    setLoading(true);

    // Optimistically append user message
    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: textToSend,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await client.post("/ai/chat", {
        conversationId: currentConvId,
        message: textToSend,
        currentModule,
        language,
      });

      if (res.conversationId && (!currentConvId || currentConvId !== res.conversationId)) {
        setCurrentConvId(res.conversationId);
      }

      if (res.message) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, tempUserMsg, res.message];
        });
      }
      loadConversations();
    } catch (err) {
      setErrorMessage(err.status === 429 ? strings.errorRateLimit : err.message || strings.errorGeneric);
    } finally {
      setLoading(false);
    }
  }

  async function handleExecuteProposal(proposalId) {
    setExecutingProposalId(proposalId);
    try {
      const res = await client.post(`/ai/proposals/${proposalId}/execute`);
      // Update local message proposal status
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.actionProposal && msg.actionProposal.id === proposalId) {
            return {
              ...msg,
              actionProposal: {
                ...msg.actionProposal,
                status: "EXECUTED",
                executionResult: res.result,
              },
            };
          }
          return msg;
        })
      );
    } catch (err) {
      alert(`Action execution failed: ${err.message}`);
    } finally {
      setExecutingProposalId(null);
    }
  }

  async function handleRejectProposal(proposalId) {
    const reason = window.prompt("Reason for rejecting action (optional):", "Not required right now");
    try {
      const res = await client.post(`/ai/proposals/${proposalId}/reject`, { reason });
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.actionProposal && msg.actionProposal.id === proposalId) {
            return {
              ...msg,
              actionProposal: {
                ...msg.actionProposal,
                status: "REJECTED",
                executionResult: { reason },
              },
            };
          }
          return msg;
        })
      );
    } catch (err) {
      alert(`Failed to reject proposal: ${err.message}`);
    }
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        className="svaadya-ai-fab"
        onClick={() => setIsOpen((prev) => !prev)}
        title={`${isPlatform ? strings.platformTitle : strings.title} (${strings.shortcutHint})`}
        aria-label="Open AI Assistant"
      >
        <SparklesIcon className="w-4 h-4 text-emerald-300 shrink-0" />
        <span className="font-medium text-xs">{isPlatform ? strings.platformTitle : strings.title}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ms-1 shrink-0" />
      </button>

      {/* Drawer Overlay for Mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-Over Drawer */}
      <div className={`svaadya-ai-drawer ${isOpen ? "open" : "closed"}`}>
        {/* Header */}
        <div className="p-3.5 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#0F4C45] text-white flex items-center justify-center shrink-0">
              <SparklesIcon className="w-4 h-4 text-emerald-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[var(--text-primary)] leading-tight">
                  {isPlatform ? strings.platformTitle : strings.title}
                </h3>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)] border border-[var(--border)] uppercase tracking-wider">
                  {currentModule}
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{strings.online}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* New Chat */}
            <button
              type="button"
              onClick={handleNewChat}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition border border-[var(--border)]"
              title={strings.newChat}
              aria-label={strings.newChat}
            >
              <PlusIcon className="w-3.5 h-3.5" />
            </button>

            {/* Conversation History Dropdown Toggle */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowHistoryDropdown((prev) => !prev)}
                className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition border border-[var(--border)]"
                title={strings.history}
                aria-label={strings.history}
              >
                <ClockIcon className="w-3.5 h-3.5" />
              </button>

              {showHistoryDropdown && (
                <div className="absolute end-0 mt-2 w-64 bg-[var(--surface)] rounded-md shadow-lg border border-[var(--border)] py-1.5 z-70">
                  <div className="px-3 py-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">
                    {strings.history}
                  </div>
                  {conversations.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-[var(--text-muted)] italic">{strings.noHistory}</div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {conversations.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => selectConversation(c.id)}
                          className={`w-full text-start px-3 py-2 text-xs truncate transition flex items-center justify-between ${
                            currentConvId === c.id ? "bg-[#EBF5F3] dark:bg-[#12332F] text-[#0F4C45] dark:text-[#67B5AA] font-semibold" : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          <span className="truncate max-w-[180px]">{c.title}</span>
                          <span className="text-[10px] text-[var(--text-muted)] ms-1">{c.messageCount || 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Clear Chat */}
            <button
              type="button"
              onClick={handleClearChat}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition border border-[var(--border)]"
              title={strings.clearChat}
              aria-label={strings.clearChat}
            >
              <TrashIcon className="w-3.5 h-3.5" />
            </button>

            {/* Close */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition border border-[var(--border)]"
              aria-label="Close"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="bg-rose-50 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800 px-4 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
            <span>{errorMessage}</span>
            <button type="button" onClick={() => setErrorMessage("")} className="text-rose-600 hover:text-rose-800 text-xs font-semibold">✕</button>
          </div>
        )}

        {/* Message Thread Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[var(--app-bg)]">
          {messages.length === 0 ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-10 h-10 mx-auto rounded-lg bg-[#EBF5F3] dark:bg-[#12332F] text-[#0F4C45] dark:text-[#67B5AA] flex items-center justify-center border border-[#C4E5E1] dark:border-[#1D4742]">
                <SparklesIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[var(--text-primary)]">{isPlatform ? strings.platformTitle : strings.title}</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                  {isPlatform ? strings.platformTagline : strings.tagline}
                </p>
              </div>

              {/* Contextual Suggestions Chips */}
              <div className="pt-2 text-start">
                <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                  {strings.suggestionsTitle}
                </p>
                <div className="space-y-1.5">
                  {contextualPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-start p-2.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:border-[#0F4C45] hover:bg-[#EBF5F3]/30 text-xs text-[var(--text-primary)] font-normal transition flex items-center justify-between group"
                    >
                      <span>{prompt}</span>
                      <span className="text-[#0F4C45] opacity-0 group-hover:opacity-100 transition text-xs">→</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[88%] rounded-md p-3 text-xs ${
                      isUser
                        ? "bg-[#0F4C45] text-white"
                        : "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-primary)] svaadya-ai-markdown"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      renderFormattedContent(msg.content)
                    )}

                    {/* Action Proposal Card if attached */}
                    {msg.actionProposal && (
                      <div className="mt-3 pt-2.5 border-t border-[var(--border)] bg-[var(--surface-muted)] p-2.5 rounded border border-[var(--border)]">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                            {strings.proposedAction}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              msg.actionProposal.status === "EXECUTED"
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200"
                                : msg.actionProposal.status === "REJECTED"
                                ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200"
                                : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200"
                            }`}
                          >
                            {msg.actionProposal.status}
                          </span>
                        </div>

                        <div className="text-[11px] text-[var(--text-primary)] font-mono bg-[var(--surface)] p-2 rounded border border-[var(--border)] mb-2 overflow-x-auto">
                          <div className="font-semibold text-xs">{msg.actionProposal.actionType}</div>
                          {msg.actionProposal.actionPayload && (
                            <pre className="text-[10px] text-[var(--text-secondary)] mt-1">
                              {JSON.stringify(msg.actionProposal.actionPayload, null, 2)}
                            </pre>
                          )}
                        </div>

                        {msg.actionProposal.status === "PROPOSED" && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={executingProposalId === msg.actionProposal.id}
                              onClick={() => handleExecuteProposal(msg.actionProposal.id)}
                              className="flex-1 py-1.5 px-3 rounded-md bg-[#0F4C45] hover:bg-[#0D3E38] text-white font-medium text-xs transition disabled:opacity-50"
                            >
                              {executingProposalId === msg.actionProposal.id ? strings.executing : strings.approveAndExecute}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectProposal(msg.actionProposal.id)}
                              className="py-1.5 px-3 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] font-medium text-xs transition"
                            >
                              {strings.reject}
                            </button>
                          </div>
                        )}

                        {msg.actionProposal.status === "EXECUTED" && (
                          <div className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 mt-1">
                            <CheckIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>{strings.executed}</span>
                          </div>
                        )}

                        {msg.actionProposal.status === "REJECTED" && (
                          <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1.5 mt-1">
                            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            <span>{strings.rejected}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] bg-[var(--surface)] p-2 rounded-md border border-[var(--border)] max-w-[160px]">
              <span className="w-2 h-2 rounded-full bg-[#0F4C45] animate-ping shrink-0" />
              <span>Analyzing data...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Composer Footer */}
        <div className="p-3 bg-[var(--surface)] border-t border-[var(--border)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={strings.placeholder}
              className="flex-1 bg-[var(--surface)] border border-[var(--border)] focus:border-[#0F4C45] rounded-md px-3 py-1.5 text-xs text-[var(--text-primary)] outline-none transition"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || loading}
              className="px-3 py-1.5 rounded-md bg-[#0F4C45] hover:bg-[#0D3E38] text-white font-medium text-xs transition disabled:opacity-50 shrink-0"
            >
              {strings.send}
            </button>
          </form>
          <div className="text-[10px] text-[var(--text-muted)] mt-1.5 text-center">
            {strings.shortcutHint}
          </div>
        </div>
      </div>
    </>
  );
}
