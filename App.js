// app.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Modal, Alert, I18nManager, PermissionsAndroid, Platform
} from "react-native";

/* ============================================================
   TechMate AI (with Voice) – LanguageSelect + Auth + Explain/Quiz + Voice Q/A
   ============================================================ */

/** ====== STORAGE (AsyncStorage shim) ====== */
let Storage;
try { Storage = require("@react-native-async-storage/async-storage").default; }
catch { const mem = new Map(); Storage = {
  async getItem(k){return mem.has(k)?mem.get(k):null;},
  async setItem(k,v){mem.set(k,v);}, async removeItem(k){mem.delete(k);},
  async clear(){mem.clear();}
};}

/** ====== OPTIONAL VOICE / TTS (graceful fallback) ====== */
// ---- Voice (STT) optional require ----
let Voice = null;
try {
  Voice = require("@react-native-voice/voice").default || require("@react-native-voice/voice");
} catch { Voice = null; } // if not linked, stays null (no crash)

let TTS = null;
try { TTS = require("react-native-tts"); } catch {}

/** ====== CONSTANTS / KEYS ====== */
const DEFAULT_API = "https://5d44ba8e-74b1-4d8b-90c1-a4b4fa7bc381-00-3fmuluz7gckzd.sisko.replit.dev";
const K_API="tm_api_base", K_TOKEN="tm_token", K_USER="tm_user",
      K_LAUTH_USERS="tm_local_users", K_NOTES="tm_notes", K_LANG="tm_lang";

/** ====== UI TRANSLATIONS (12 langs + voice keys) ====== */
const L = {
  en:{ start:"START", welcome:"Welcome to TechMate AI", choose:"Choose a Language", next:"Continue",
       login:"Login", emailOrId:"Email or User ID", password:"Password", needAcc:"Need an account? Register",
       createAcc:"Create Account", selectRole:"Select Role (first time only)", student:"Student", teacher:"Teacher",
       menu:"Main Menu", loggedAs:"Logged in as",
       topic:"Topic (for Explain/Quiz)", qcount:"Q# (5–20)", explain:"Explain", startQuiz:"Start Quiz",
       submit:"Submit Quiz", reset:"Reset", tryAgain:"Try Again", doubt:"Doubt (free text)", solve:"Solve Doubt",
       quizOn:"Quiz on", score:"Score", back:"Back", loading:"Loading recommendations…",
       trending:"Trending for you", noSignals:"No signals yet. Try any topic!",
       askByVoice:"Ask by Voice", stop:"Stop", listening:"Listening…", speak:"Play Answer" },

  hi:{ start:"शुरू करें", welcome:"TechMate AI में आपका स्वागत है", choose:"भाषा चुनें", next:"आगे बढ़ें",
       login:"लॉगिन", emailOrId:"ईमेल या यूज़र आईडी", password:"पासवर्ड", needAcc:"खाता नहीं? रजिस्टर करें",
       createAcc:"खाता बनाएं", selectRole:"भूमिका चुनें (पहली बार)", student:"विद्यार्थी", teacher:"शिक्षक",
       menu:"मुख्य मेनू", loggedAs:"लॉगिन हुआ:",
       topic:"विषय (Explain/Quiz)", qcount:"प्रश्न# (5–20)", explain:"समझाएँ", startQuiz:"क्विज़ शुरू करें",
       submit:"सबमिट", reset:"रीसेट", tryAgain:"फिर से प्रयास", doubt:"संदेह (फ्री टेक्स्ट)", solve:"उत्तर दें",
       quizOn:"क्विज़:", score:"स्कोर", back:"वापस", loading:"सुझाव लोड हो रहे हैं…",
       trending:"आपके लिए ट्रेंडिंग", noSignals:"अभी कोई संकेत नहीं। कोई भी टॉपिक अभ्यास करें!",
       askByVoice:"आवाज़ से पूछें", stop:"रोकें", listening:"सुन रहे हैं…", speak:"आवाज़ में सुनें" },

  es:{ start:"INICIAR", welcome:"Bienvenido a TechMate AI", choose:"Selecciona idioma", next:"Continuar",
       login:"Iniciar sesión", emailOrId:"Correo o ID", password:"Contraseña", needAcc:"¿Sin cuenta? Regístrate",
       createAcc:"Crear cuenta", selectRole:"Seleccionar rol (primera vez)", student:"Estudiante", teacher:"Profesor",
       menu:"Menú principal", loggedAs:"Conectado como",
       topic:"Tema (Explicación/Quiz)", qcount:"#P (5–20)", explain:"Explicar", startQuiz:"Iniciar Quiz",
       submit:"Enviar Quiz", reset:"Reiniciar", tryAgain:"Intentar de nuevo", doubt:"Duda (texto libre)", solve:"Resolver Duda",
       quizOn:"Quiz de", score:"Puntuación", back:"Atrás", loading:"Cargando recomendaciones…",
       trending:"Tendencias para ti", noSignals:"Sin señales aún. ¡Practica cualquier tema!",
       askByVoice:"Pregunta por voz", stop:"Detener", listening:"Escuchando…", speak:"Reproducir respuesta" },

  ar:{ start:"ابدأ", welcome:"مرحبًا بك في TechMate AI", choose:"اختر اللغة", next:"متابعة",
       login:"تسجيل الدخول", emailOrId:"البريد أو المعرّف", password:"كلمة المرور", needAcc:"لا تملك حسابًا؟ سجّل",
       createAcc:"إنشاء حساب", selectRole:"اختر الدور (أول مرة)", student:"طالب", teacher:"معلم",
       menu:"القائمة الرئيسية", loggedAs:"تم الدخول:",
       topic:"الموضوع (شرح/اختبار)", qcount:"عدد الأسئلة (5–20)", explain:"اشرح", startQuiz:"ابدأ الاختبار",
       submit:"إرسال الاختبار", reset:"إعادة", tryAgain:"حاول مرة أخرى", doubt:"سؤال حر", solve:"أجب",
       quizOn:"اختبار في", score:"النتيجة", back:"رجوع", loading:"جاري التحميل…",
       trending:"الشائع لديك", noSignals:"لا توجد إشارات بعد. جرّب أي موضوع!",
       askByVoice:"اسأل بالصوت", stop:"إيقاف", listening:"يستمع…", speak:"تشغيل الإجابة" },

  zh:{ start:"开始", welcome:"欢迎使用 TechMate AI", choose:"选择语言", next:"继续",
       login:"登录", emailOrId:"邮箱或用户ID", password:"密码", needAcc:"没有账号？注册",
       createAcc:"创建账号", selectRole:"选择角色（首次）", student:"学生", teacher:"老师",
       menu:"主菜单", loggedAs:"已登录：",
       topic:"主题（讲解/测验）", qcount:"题数 (5–20)", explain:"讲解", startQuiz:"开始测验",
       submit:"提交测验", reset:"重置", tryAgain:"再试一次", doubt:"疑问（自由输入）", solve:"解答",
       quizOn:"测验：", score:"得分", back:"返回", loading:"正在加载推荐…",
       trending:"为你推荐", noSignals:"暂无信号。试试任何主题！",
       askByVoice:"语音提问", stop:"停止", listening:"正在听…", speak:"播放答案" },

  pt:{ start:"INICIAR", welcome:"Bem-vindo ao TechMate AI", choose:"Selecionar idioma", next:"Continuar",
       login:"Entrar", emailOrId:"Email ou ID", password:"Senha", needAcc:"Sem conta? Registre-se",
       createAcc:"Criar conta", selectRole:"Selecionar função (primeira vez)", student:"Aluno", teacher:"Professor",
       menu:"Menu principal", loggedAs:"Conectado como",
       topic:"Tópico (Explicação/Quiz)", qcount:"Qtde (5–20)", explain:"Explicar", startQuiz:"Iniciar Quiz",
       submit:"Enviar Quiz", reset:"Resetar", tryAgain:"Tentar novamente", doubt:"Dúvida (texto livre)", solve:"Resolver",
       quizOn:"Quiz de", score:"Pontuação", back:"Voltar", loading:"Carregando recomendações…",
       trending:"Em alta para você", noSignals:"Sem sinais ainda. Pratique qualquer tema!",
       askByVoice:"Perguntar por voz", stop:"Parar", listening:"Ouvindo…", speak:"Reproduzir resposta" },

  fr:{ start:"DÉMARRER", welcome:"Bienvenue sur TechMate AI", choose:"Choisir la langue", next:"Continuer",
       login:"Connexion", emailOrId:"Email ou ID", password:"Mot de passe", needAcc:"Pas de compte ? Inscription",
       createAcc:"Créer un compte", selectRole:"Choisir un rôle (première fois)", student:"Élève", teacher:"Professeur",
       menu:"Menu principal", loggedAs:"Connecté en tant que",
       topic:"Sujet (Explication/Quiz)", qcount:"Nb (5–20)", explain:"Expliquer", startQuiz:"Lancer le quiz",
       submit:"Valider le quiz", reset:"Réinitialiser", tryAgain:"Recommencer", doubt:"Doute (texte libre)", solve:"Répondre",
       quizOn:"Quiz sur", score:"Score", back:"Retour", loading:"Chargement…",
       trending:"Tendance pour vous", noSignals:"Aucun signal. Essayez un sujet !",
       askByVoice:"Demander par voix", stop:"Arrêter", listening:"Écoute…", speak:"Lire la réponse" },

  id:{ start:"MULAI", welcome:"Selamat datang di TechMate AI", choose:"Pilih bahasa", next:"Lanjut",
       login:"Masuk", emailOrId:"Email atau ID", password:"Kata sandi", needAcc:"Belum punya akun? Daftar",
       createAcc:"Buat Akun", selectRole:"Pilih peran (pertama kali)", student:"Siswa", teacher:"Guru",
       menu:"Menu utama", loggedAs:"Masuk sebagai",
       topic:"Topik (Jelaskan/Kuis)", qcount:"Jumlah (5–20)", explain:"Jelaskan", startQuiz:"Mulai Kuis",
       submit:"Kirim Kuis", reset:"Reset", tryAgain:"Coba lagi", doubt:"Pertanyaan (teks bebas)", solve:"Jawab",
       quizOn:"Kuis:", score:"Nilai", back:"Kembali", loading:"Memuat rekomendasi…",
       trending:"Tren untuk Anda", noSignals:"Belum ada sinyal. Coba topik apa saja!",
       askByVoice:"Tanya dengan suara", stop:"Berhenti", listening:"Mendengarkan…", speak:"Putar jawaban" },

  vi:{ start:"BẮT ĐẦU", welcome:"Chào mừng đến với TechMate AI", choose:"Chọn ngôn ngữ", next:"Tiếp tục",
       login:"Đăng nhập", emailOrId:"Email hoặc ID", password:"Mật khẩu", needAcc:"Chưa có tài khoản? Đăng ký",
       createAcc:"Tạo tài khoản", selectRole:"Chọn vai trò (lần đầu)", student:"Học sinh", teacher:"Giáo viên",
       menu:"Menu chính", loggedAs:"Đăng nhập với",
       topic:"Chủ đề (Giải thích/Quiz)", qcount:"Số câu (5–20)", explain:"Giải thích", startQuiz:"Bắt đầu Quiz",
       submit:"Nộp Quiz", reset:"Đặt lại", tryAgain:"Làm lại", doubt:"Câu hỏi (tự do)", solve:"Giải đáp",
       quizOn:"Quiz về", score:"Điểm", back:"Quay lại", loading:"Đang tải gợi ý…",
       trending:"Xu hướng cho bạn", noSignals:"Chưa có tín hiệu. Hãy luyện bất kỳ chủ đề nào!",
       askByVoice:"Hỏi bằng giọng nói", stop:"Dừng lại", listening:"Đang nghe…", speak:"Phát câu trả lời" },

  tr:{ start:"BAŞLA", welcome:"TechMate AI'ye hoş geldiniz", choose:"Dil seçin", next:"Devam",
       login:"Giriş Yap", emailOrId:"E-posta veya ID", password:"Şifre", needAcc:"Hesabın yok mu? Kayıt ol",
       createAcc:"Hesap oluştur", selectRole:"Rol seç (ilk sefer)", student:"Öğrenci", teacher:"Öğretmen",
       menu:"Ana menü", loggedAs:"Giriş yapan:",
       topic:"Konu (Açıkla/Quiz)", qcount:"Sayı (5–20)", explain:"Açıkla", startQuiz:"Quiz Başlat",
       submit:"Quiz Gönder", reset:"Sıfırla", tryAgain:"Tekrar dene", doubt:"Soru (serbest metin)", solve:"Cevapla",
       quizOn:"Quiz:", score:"Puan", back:"Geri", loading:"Öneriler yükleniyor…",
       trending:"Sana özel trendler", noSignals:"Henüz sinyal yok. Herhangi bir konu deneyin!",
       askByVoice:"Sesle sor", stop:"Durdur", listening:"Dinleniyor…", speak:"Cevabı dinle" },

  ja:{ start:"スタート", welcome:"TechMate AIへようこそ", choose:"言語を選択", next:"続行",
       login:"ログイン", emailOrId:"メールまたはID", password:"パスワード", needAcc:"アカウント未作成？登録",
       createAcc:"アカウント作成", selectRole:"役割を選択（初回）", student:"学生", teacher:"先生",
       menu:"メインメニュー", loggedAs:"ログイン中：",
       topic:"トピック（説明/クイズ）", qcount:"問題数 (5–20)", explain:"説明する", startQuiz:"クイズ開始",
       submit:"クイズ送信", reset:"リセット", tryAgain:"もう一度", doubt:"疑問（自由入力）", solve:"回答する",
       quizOn:"クイズ：", score:"スコア", back:"戻る", loading:"おすすめを読み込み中…",
       trending:"あなたへのトレンド", noSignals:"まだシグナルがありません。どのトピックでも練習！",
       askByVoice:"音声で質問", stop:"停止", listening:"聞いています…", speak:"答えを再生" },

  ru:{ start:"СТАРТ", welcome:"Добро пожаловать в TechMate AI", choose:"Выберите язык", next:"Продолжить",
       login:"Вход", emailOrId:"Email или ID", password:"Пароль", needAcc:"Нет аккаунта? Регистрация",
       createAcc:"Создать аккаунт", selectRole:"Выберите роль (впервые)", student:"Ученик", teacher:"Учитель",
       menu:"Главное меню", loggedAs:"Вошли как:",
       topic:"Тема (Объяснение/Тест)", qcount:"Кол-во (5–20)", explain:"Объяснить", startQuiz:"Начать тест",
       submit:"Отправить тест", reset:"Сброс", tryAgain:"Повторить", doubt:"Вопрос (свободный текст)", solve:"Ответить",
       quizOn:"Тест по", score:"Счёт", back:"Назад", loading:"Загрузка рекомендаций…",
       trending:"Актуальное для вас", noSignals:"Пока нет сигналов. Потренируйтесь на любом!",
       askByVoice:"Спросить голосом", stop:"Стоп", listening:"Слушаю…", speak:"Озвучить ответ" }
};

const tt = (lang, key) => L[lang]?.[key] || L.en[key] || key;

/** ====== NETWORK HELPERS ====== */
async function safeFetch(url, options={}, token){
  const headers={"Content-Type":"application/json", ...(options.headers||{})};
  if(token) headers.Authorization=`Bearer ${token}`;
  let res;
  try{ res=await fetch(url,{...options,headers}); }
  catch(e){ const err=new Error("Server unreachable. Using local answer."); err.network=true; throw err; }
  const status=res.status;
  let text=""; try{ text=await res.text(); }catch{}
  let json=null; try{ json=text?JSON.parse(text):null; }catch{}
  if(!res.ok){
    const msg = json?.error || json?.message || `HTTP ${status}`;
    const err=new Error(msg); err.status=status; err.text=text; err.json=json;
    throw err;
  }
  return {status, json, text};
}
async function authFetch(base, token, path, opt={}){ const {json,text}=await safeFetch(`${base}${path}`,opt,token); return json??(text?{text}:{}) }

/** ====== LOCAL FALLBACK (Explain & Quiz) ====== */
function localExplain(topic){
  const t = topic.trim();
  return [
    { heading:"📌 Core Concept", content:`${t} ka simple overview: easy language me 2–3 lines.` },
    { heading:"📌 Key Points", content:`• Definition of ${t}\n• Important terms/formula\n• Typical exam use\n• Common mistakes` },
    { heading:"💡 Example", content:`Daily-life example relating to ${t}.` },
    { heading:"🧠 Mnemonic", content:`S.M.A.R.T → Summary, Meaning, Applications, Risks, Trick` }
  ];
}
function localQuiz(topic, n=10){
  const arr=[]; for(let i=1;i<=n;i++){ arr.push({
    q:`(${i}) ${topic}: choose the correct statement.`,
    options:[`Option A about ${topic}`,`Option B about ${topic}`,`Option C about ${topic}`,`Option D about ${topic}`],
    a: Math.floor(Math.random()*4)
  }); } return arr;
}

/** ====== Client translator fallback (if server returns wrong language) ====== */
const LangCheck = {
  ja: /[\u3040-\u30ff\u31f0-\u31ff\u4e00-\u9faf]/,
  ar: /[\u0600-\u06FF]/,
  hi: /[\u0900-\u097F]/,
  ru: /[\u0400-\u04FF]/,
  zh: /[\u4e00-\u9fff]/,
};
function seemsInLang(text, lang){
  if(!text) return false;
  if(lang in LangCheck) return LangCheck[lang].test(text);
  return true;
}
async function ensureLangText({ apiBase, token, text, lang }){
  try{
    if(seemsInLang(text, lang)) return text;
    const r = await fetch(`${apiBase}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token?{Authorization:`Bearer ${token}`}:{}) },
      body: JSON.stringify({ text, to: lang })
    });
    const j = await r.json().catch(()=>({}));
    return j?.text || text;
  }catch{
    return text;
  }
}

/** ====== NOTES (for Save buttons) ====== */
async function getNotes(){ const s=await Storage.getItem(K_NOTES); try{ return s?JSON.parse(s):[] }catch{ return [] } }
async function setNotes(arr){ await Storage.setItem(K_NOTES, JSON.stringify(arr||[])); }
async function addNote(note){
  const now=new Date().toISOString();
  const arr=await getNotes();
  arr.unshift({ id: `${Date.now()}`, createdAt: now, ...note });
  await setNotes(arr);
  Alert.alert("Saved","Added to Notes");
}

/** ====== TTS helpers (safe) ====== */
async function speak(text, lang="en"){
  if(!text) return;
  if(!TTS){ Alert.alert("TTS","Text-to-speech not available on this build."); return; }
  try{
    if(lang==="hi") await TTS.setDefaultLanguage("hi-IN"); else await TTS.setDefaultLanguage("en-US");
  }catch{}
  try{
    await TTS.stop();
    await TTS.speak(String(text));
  }catch(e){
    Alert.alert("TTS Error", String(e?.message||e));
  }
}

/** ====== VoiceButton component ====== */
function VoiceButton({ lang="en", onResult, style, tl=(k)=>k }){
  const [listening,setListening]=useState(false);
  const transcriptRef=useRef("");

  useEffect(()=>{
    if(!Voice) return;
    Voice.onSpeechResults = (e)=>{
      const vals=e?.value||[];
      const txt=vals[0]||"";
      transcriptRef.current=txt;
      if(onResult&&txt) onResult(txt);
    };
    Voice.onSpeechError = ()=> setListening(false);
    return ()=>{
      try{ Voice.destroy().then(()=>Voice.removeAllListeners&&Voice.removeAllListeners()); }catch{}
    };
  },[onResult]);

  const askMicPermission = async ()=>{
    if(Platform.OS!=="android") return true;
    try{
      const g = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      return g === PermissionsAndroid.RESULTS.GRANTED;
    }catch{ return false; }
  };

  const startListening = async ()=>{
    if(!Voice || typeof Voice.start!=="function"){
      Alert.alert("Voice","Speech library not available.\nRun: npx expo prebuild && npx expo run:android/ios");
      return;
    }
    const ok = await askMicPermission();
    if(!ok){ Alert.alert("Permission","Microphone permission is required."); return; }
    try{
      transcriptRef.current="";
      await Voice.start(lang==="hi"?"hi-IN":"en-US");
      setListening(true);
    }catch(e){
      Alert.alert("Voice Error", String(e?.message||e));
    }
  };

  const stopListening = async ()=>{
    if(!Voice){ setListening(false); return; }
    try{ await Voice.stop(); }catch{}
    setListening(false);
    if(!transcriptRef.current) Alert.alert("Voice","No speech captured.");
  };

  return (
    <TouchableOpacity
      onPress={listening?stopListening:startListening}
      style={[styles.micBtn, listening?{backgroundColor:"#ef4444"}:{} , style]}
      activeOpacity={0.85}
      accessibilityLabel="Voice button"
    >
      <Text style={{color:"#fff",fontWeight:"900"}}>{listening? tt(lang,"stop") : "🎙️"}</Text>
      <Text style={{color:"#fff",fontWeight:"800",marginLeft:6}}>
        {listening? tt(lang,"listening") : tt(lang,"askByVoice")}
      </Text>
    </TouchableOpacity>
  );
}

/** ====== APP ROOT ====== */
export default function App(){
  const [screen,setScreen]=useState("splash");
  const [drawerOpen,setDrawerOpen]=useState(false);
  const [apiBase,setApiBase]=useState(DEFAULT_API);
  const [token,setToken]=useState(null);
  const [user,setUser]=useState(null);
  const [lang,setLang]=useState("en");

  useEffect(()=>{ (async()=>{
    const savedApi=await Storage.getItem(K_API); if(savedApi) setApiBase(savedApi);
    const t=await Storage.getItem(K_TOKEN); const uStr=await Storage.getItem(K_USER);
    const savedLang=await Storage.getItem(K_LANG); if(savedLang) setLang(savedLang);
    if(t&&uStr){ try{ const u=JSON.parse(uStr); setToken(t); setUser(u); setScreen(u?.role==="teacher"?"teacher":"student"); return; }catch{} }
    setScreen("splash");
  })(); },[]);

  useEffect(()=>{ (async()=>{
    await Storage.setItem(K_LANG, lang);
    const wantRTL = (lang === "ar");
    if (I18nManager.isRTL !== wantRTL) {
      I18nManager.allowRTL(wantRTL);
      I18nManager.forceRTL(wantRTL);
      Alert.alert("Language","Please restart app to fully apply RTL.");
    }
  })(); },[lang]);

  const navigate=s=>{ setDrawerOpen(false); setScreen(s); };
  const role=user?.role||null;
  const homeTarget=useMemo(()=> role==="teacher"?"teacher":role==="student"?"student":"menu",[role]);

  const doLogout=async()=>{ setToken(null); setUser(null); await Storage.removeItem(K_TOKEN); await Storage.removeItem(K_USER); navigate("login"); };

  return (
    <View style={[{flex:1, backgroundColor:"#F3F6FF"}, lang==="ar"?{writingDirection:"rtl"}:{writingDirection:"ltr"}]}>
      <Header
        onBack={()=>{
          if (screen === "login") navigate("splash");
          else if (screen === "menu") navigate("login");
          else navigate("menu");
        }}
        onHome={()=>navigate(homeTarget)}
        onMenu={()=>setDrawerOpen(true)}
      />
      <SideDrawer visible={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        onProfile={()=>navigate("profile")}
        onFeedback={()=>navigate("feedback")}
        onSettings={()=>navigate("settings")}
        onHelp={()=>navigate("help")}
        onLogout={doLogout}
      />

      {/* Splash -> LanguageSelect -> Login */}
      {screen==="splash"    && <Splash  onStart={()=>navigate("language")} tl={(k)=>tt(lang,k)} />}
      {screen==="language"  && <LanguageSelect lang={lang} setLang={setLang} onNext={()=>navigate("login")} tl={(k)=>tt(lang,k)} />}

      {screen==="login" && <LoginScreen apiBase={apiBase} onLoggedIn={async p=>{
        setToken(p.token); setUser({id:p.id,email:p.email,role:p.role});
        await Storage.setItem(K_TOKEN,p.token); await Storage.setItem(K_USER,JSON.stringify({id:p.id,email:p.email,role:p.role}));
        navigate(p.role==="teacher"?"teacher":"student");
      }} tl={(k)=>tt(lang,k)} />}
      {screen==="menu"    && <MainMenu go={navigate} role={role} tl={(k)=>tt(lang,k)} />}

      {screen==="student" && <StudentScreen lang={lang} apiBase={apiBase} token={token} user={user} onBack={()=>navigate("menu")} tl={(k)=>tt(lang,k)} />}
      {screen==="teacher" && <TeacherScreen lang={lang} apiBase={apiBase} token={token} user={user} onBack={()=>navigate("menu")} tl={(k)=>tt(lang,k)} />}

      {screen==="subscriptions" && <Subscriptions onBack={()=>navigate("menu")} />}
      {screen==="settings" && <Settings apiBase={apiBase} setApiBase={async v=>{ setApiBase(v); await Storage.setItem(K_API,v); }} onBack={()=>navigate("menu")} />}
      {screen==="help" && <HelpScreen onBack={()=>navigate("menu")} />}
      {screen==="about" && <AboutScreen onBack={()=>navigate("menu")} />}
      {screen==="profile" && <ProfileScreen user={user} onBack={()=>navigate("menu")} />}
      {screen==="feedback" && <FeedbackScreen onSubmit={()=>navigate("menu")} onBack={()=>navigate("menu")} />}
      {screen==="roles" && <Roles onBack={()=>navigate("menu")} />}

      <Footer apiBase={apiBase} user={user} />
    </View>
  );
}

/* =================== HEADER / DRAWER =================== */
function Header({onBack,onHome,onMenu}){
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack}><Text style={styles.link}>◀ Back</Text></TouchableOpacity>
      <TouchableOpacity onPress={onHome} style={{flex:1, alignItems:"center"}}><Text style={[styles.brand,{textAlign:"center"}]}>TechMate AI</Text></TouchableOpacity>
      <TouchableOpacity onPress={onMenu}><Text style={[styles.link,{fontSize:24}]}>☰</Text></TouchableOpacity>
    </View>
  );
}
function SideDrawer({visible,onClose,onProfile,onFeedback,onSettings,onHelp,onLogout}){
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.drawerScrim} onPress={onClose}/>
      <View style={styles.drawer}>
        <View style={{flexDirection:"row",alignItems:"center",gap:12,marginBottom:14}}>
          <View style={styles.logo}><Text style={{color:"#fff",fontWeight:"900"}}>TM</Text></View>
          <Text style={{fontWeight:"900",fontSize:16,color:"#0B1B4D"}}>TechMate AI</Text>
        </View>
        <View style={{gap:10}}>
          <Btn title="View Profile" onPress={onProfile}/>
          <Btn title="Feedback" onPress={onFeedback}/>
          <Btn title="Settings" onPress={onSettings}/>
          <Btn title="Help & FAQ" onPress={onHelp}/>
          <Btn title="Logout" onPress={onLogout}/>
          <Btn title="Close" onPress={onClose}/>
        </View>
      </View>
    </Modal>
  );
}

/* =================== SPLASH =================== */
function Splash({ onStart, tl }) {
  return (
    <View style={styles.splash}>
      <View style={styles.splashCard}>
        <Text style={{ color: "#fff", fontSize: 64, fontWeight: "900", marginBottom: 4 }}>∞</Text>
        <Text style={{ color: "#fff", fontSize: 24, fontWeight: "900" }}>TechMateAI</Text>
        <Text style={{ color: "rgba(255,255,255,0.95)", marginTop: 6, fontSize: 14 }}>
          {tl("welcome")}
        </Text>
        <TouchableOpacity onPress={onStart} style={styles.bigBtn} activeOpacity={0.9}>
          <Text style={styles.bigBtnText}>{tl("start")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* =================== LANGUAGE SELECT =================== */
function LanguageSelect({ lang, setLang, onNext, tl }) {
  const langs = [
    { code:"en", label:"English" },
    { code:"es", label:"Español" },
    { code:"hi", label:"हिंदी" },
    { code:"ar", label:"العربية (RTL)" },
    { code:"zh", label:"中文 (简体)" },
    { code:"pt", label:"Português (BR)" },
    { code:"fr", label:"Français" },
    { code:"id", label:"Bahasa Indonesia" },
    { code:"vi", label:"Tiếng Việt" },
    { code:"tr", label:"Türkçe" },
    { code:"ja", label:"日本語" },
    { code:"ru", label:"Русский" }
  ];

  const [sel,setSel]=useState(lang);

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title={`🌐 ${tl("choose")}`}>
        <View style={{gap:10}}>
          {langs.map(l=>(
            <TouchableOpacity key={l.code} onPress={()=>setSel(l.code)}
              style={[styles.chip, sel===l.code && styles.chipActive]}>
              <Text style={{color: sel===l.code ? "#fff" : "#12308A", fontWeight:"700"}}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{height:12}}/>
        <Btn title={tl("next")} onPress={()=>{ setLang(sel); onNext(); }} />
      </Card>
    </ScrollView>
  );
}

/* =================== LOGIN (SELF-CONTAINED LOCAL AUTH) =================== */
function LoginScreen({ apiBase, onLoggedIn, tl }) {
  const [mode, setMode] = useState("login");
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [loading, setLoading] = useState(false);

  const LAUTH_KEY = K_LAUTH_USERS;

  const lauth_getUsers = async () => {
    const s = await Storage.getItem(LAUTH_KEY);
    if (!s) return [];
    try { return JSON.parse(s); } catch { return []; }
  };
  const lauth_setUsers = async (arr) => {
    await Storage.setItem(LAUTH_KEY, JSON.stringify(arr || []));
  };
  const lauth_find = async (idOrEmail) => {
    const users = await lauth_getUsers();
    if (typeof idOrEmail === "string" && idOrEmail.includes("@")) {
      return users.find(u => u.email === idOrEmail.toLowerCase()) || null;
    }
    const id = String(idOrEmail || "").replace(/\D+/g, "");
    return users.find(u => String(u.id) === id) || null;
  };
  const lauth_register = async ({ email, password, role }) => {
    const users = await lauth_getUsers();
    const em = (email || "").toLowerCase();
    if (!em || !em.includes("@")) throw new Error("Valid email required");
    if (!password) throw new Error("Password required");
    if (users.find(u => u.email === em)) throw new Error("Email already registered (local)");
    let id = String(Math.floor(10000000 + Math.random() * 90000000));
    while (users.find(u => String(u.id) === id)) {
      id = String(Math.floor(10000000 + Math.random() * 90000000));
    }
    const user = { id, email: em, password, role: role || "student" };
    users.push(user);
    await lauth_setUsers(users);
    return { id, email: em, role: user.role, token: `local-${id}` };
  };
  const lauth_login = async ({ identifier, password }) => {
    const u = await lauth_find(identifier);
    if (!u) throw new Error("User not found (local)");
    if (!password || u.password !== password) throw new Error("Incorrect password (local)");
    return { id: u.id, email: u.email, role: u.role, token: `local-${u.id}` };
  };

  const fallbackLogin = async (idOrEmail) => {
    try {
      const payload = await lauth_login({ identifier: idOrEmail, password });
      onLoggedIn(payload);
    } catch (e2) {
      Alert.alert(tl ? tl("login") : "Login", String(e2?.message || e2));
    }
  };

  const doLogin = async () => {
    const idOrEmail = identifier.trim();
    if (!idOrEmail) return Alert.alert(tl ? tl("login") : "Login", tl ? tl("emailOrId") : "Email or User ID");
    if (!password) return Alert.alert(tl ? tl("login") : "Login", tl ? tl("password") : "Password");
    setLoading(true);
    try {
      const payload = await authFetch(apiBase, null, "/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier: idOrEmail, password })
      });
      if (!payload?.token) throw new Error("Invalid response");
      onLoggedIn(payload);
    } catch {
      await fallbackLogin(idOrEmail);
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async () => {
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) return Alert.alert(tl ? tl("createAcc") : "Create Account", tl ? tl("emailOrId") : "Email or User ID");
    if (!password) return Alert.alert(tl ? tl("createAcc") : "Create Account", tl ? tl("password") : "Password");
    setLoading(true);
    try {
      const payload = await authFetch(apiBase, null, "/auth/register", {
        method: "POST",
        body: JSON.stringify({ email: em, password, role })
      });
      if (!payload?.token) throw new Error("Invalid response");
      Alert.alert(tl ? tl("createAcc") : "Create Account", "Account created.");
      onLoggedIn(payload);
    } catch {
      try {
        const payload = await lauth_register({ email: em, password, role });
        Alert.alert(tl ? tl("createAcc") : "Create Account", `Local ID: ${payload.id}`);
        onLoggedIn(payload);
      } catch (e2) {
        Alert.alert(tl ? tl("createAcc") : "Create Account", String(e2?.message || e2));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{flexGrow:1,justifyContent:"center",padding:16}}>
      <Card title={mode==="login" ? (tl?tl("login"):"Login") : (tl?tl("createAcc"):"Create Account")}>
        {mode==="login" ? (
          <>
            <Text>{tl ? tl("emailOrId") : "Email or User ID"}</Text>
            <Input placeholder={tl ? tl("emailOrId") : "Email or User ID"} autoCapitalize="none"
              keyboardType="email-address" value={identifier} onChangeText={setIdentifier}/>
            <Text>{tl ? tl("password") : "Password"}</Text>
            <Input placeholder={tl ? tl("password") : "Password"} secureTextEntry value={password} onChangeText={setPassword}/>
            <Btn title={loading ? "Please wait..." : (tl?tl("login"):"Login")} onPress={doLogin}/>
            <TouchableOpacity onPress={()=>setMode("register")} style={styles.ghostBtn}>
              <Text style={{color:"#12308A",fontWeight:"800"}}>{tl ? tl("needAcc") : "Need an account? Register"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text>{tl ? tl("emailOrId") : "Email or User ID"}</Text>
            <Input placeholder={tl ? tl("emailOrId") : "Email or User ID"} autoCapitalize="none"
              keyboardType="email-address" value={email} onChangeText={setEmail}/>
            <Text>{tl ? tl("password") : "Password"}</Text>
            <Input placeholder={tl ? tl("password") : "Password"} secureTextEntry value={password} onChangeText={setPassword}/>
            <Text style={{marginTop:12}}>{tl ? tl("selectRole") : "Select Role (first time only)"}</Text>
            <View style={{flexDirection:"row",gap:10,marginVertical:10}}>
              <Chip text={tl ? tl("student") : "Student"} active={role==="student"} onPress={()=>setRole("student")}/>
              <Chip text={tl ? tl("teacher") : "Teacher"} active={role==="teacher"} onPress={()=>setRole("teacher")}/>
            </View>
            <Btn title={loading ? "Please wait..." : (tl?tl("createAcc"):"Create Account")} onPress={doRegister}/>
            <TouchableOpacity onPress={()=>setMode("login")} style={styles.ghostBtn}>
              <Text style={{color:"#12308A",fontWeight:"800"}}>{tl ? tl("login") : "Login"}</Text>
            </TouchableOpacity>
          </>
        )}
      </Card>
    </ScrollView>
  );
}

/* =================== MAIN MENU =================== */
function MainMenu({go,role, tl}){
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title={tl("menu")}>
        {role?(
          <View style={{gap:10,marginBottom:8}}>
            <Text style={styles.muted}>{tl("loggedAs")} <Text style={{fontWeight:"800"}}>{role.toUpperCase()}</Text></Text>
            <Btn title={role==="teacher"?"Go to Teacher Dashboard":"Go to Student Dashboard"} onPress={()=>go(role)}/>
          </View>
        ):null}
        <View style={{gap:10}}>
          <Btn title="Student" onPress={()=>go("student")}/>
          <Btn title="Teacher" onPress={()=>go("teacher")}/>
          <Btn title="Subscriptions" onPress={()=>go("subscriptions")}/>
          <Btn title="Logout / Switch Role" onPress={()=>go("roles")}/>
        </View>
      </Card>
    </ScrollView>
  );
}

/* =================== EXPLAIN CARD =================== */
function ExplainCard({title,sections,onSave,onPractice,onShare, onSpeak, tl, lang}){
  return (
    <View style={styles.explainCard}>
      <Text style={styles.explainTitle}>✨ {title}</Text>
      <View style={{height:6}}/>
      {sections.map((sec,i)=>(
        <View key={String(i)} style={styles.explainBlock}>
          <Text style={styles.explainHeading}>{sec.heading}</Text>
          <Text style={styles.explainText}>{sec.content}</Text>
        </View>
      ))}
      <View style={{height:10}}/>
      <View style={{flexDirection:"row",gap:10, flexWrap:"wrap"}}>
        <SmallBtn title="📥 Save" onPress={onSave}/>
        <SmallBtn title="🧪 Practice" onPress={onPractice}/>
        <SmallBtn title="📤 Share" onPress={onShare}/>
        <SmallBtn title={`🔊 ${tt(lang,"speak")}`} onPress={onSpeak}/>
      </View>
    </View>
  );
}

/* =================== STUDENT (Explain/Doubt/Quiz + VOICE) =================== */
function StudentScreen({lang, apiBase, token, user, onBack, tl}){
  const [topic,setTopic]=useState("");
  const [question,setQuestion]=useState("");
  const [count,setCount]=useState("5");
  const [loading,setLoading]=useState(false);
  const [summarySections,setSummarySections]=useState([]);
  const [doubtSections,setDoubtSections]=useState([]);

  const [quiz,setQuiz]=useState([]);
  const [answers,setAnswers]=useState([]);
  const [submitted,setSubmitted]=useState(false);
  const [score,setScore]=useState(0);

  const hit=async(path,body)=>{
    if(!apiBase){ Alert.alert("API", "Not set"); return null; }
    setLoading(true);
    try{ const {json,text}=await safeFetch(`${apiBase}${path}`,{method:"POST",body:JSON.stringify(body)},token); return json??(text?{text}:{});
    }catch(e){ return {__error:String(e?.message||e)}; }
    finally{ setLoading(false); }
  };

  const onExplain=async(t=null)=>{
    const useTopic=(t??topic).trim(); if(!useTopic) return Alert.alert(tl("topic"), "Please enter a topic");
    const j=await hit("/ai/summary",{topic:useTopic,grade:"Class 10",board:"CBSE",lang});
    let txt=j?.summary||j?.text||"";
    txt = await ensureLangText({ apiBase, token, text: txt, lang });
    let secs=txt?parseExplanation(txt):localExplain(useTopic);
    if(j?.__error) Alert.alert("Notice","Offline preview");
    setTopic(useTopic); setSummarySections(secs);
  };

  const onDoubt=async()=>{
    if(!question.trim()) return Alert.alert(tl("doubt"), "Please enter a question");
    const j=await hit("/ai/doubt",{question,grade:"Class 10",lang});
    let txt=j?.answer||j?.text||"";
    txt = await ensureLangText({ apiBase, token, text: txt, lang });
    let secs=txt?parseExplanation(txt):localExplain(question);
    if(j?.__error) Alert.alert("Notice","Offline preview");
    setDoubtSections(secs);
  };

  const loadQuiz=async(t=null,n=null)=>{
    const useTopic=(t??topic).trim(); if(!useTopic) return Alert.alert(tl("topic"), "Please enter a topic");
    const qty=Math.max(1,Math.min(parseInt(n??count,10)||5,20));
    const j=await hit("/ai/test",{topic:useTopic,count:qty,board:"CBSE",grade:"Class 10",lang});
    let q=Array.isArray(j?.mcq)?j.mcq:localQuiz(useTopic,qty);
    if(j?.__error) Alert.alert("Notice","Offline quiz");
    setTopic(useTopic); setQuiz(q); setAnswers(Array(q.length).fill(null)); setSubmitted(false); setScore(0);
  };

  const chooseOption=(qi, oi)=>{ if(submitted) return; const next=[...answers]; next[qi]=oi; setAnswers(next); };
  const canSubmit = quiz.length>0 && answers.every(a=>a!==null);
  const submitQuiz=()=>{ if(!canSubmit) return Alert.alert("Complete","Please answer all questions before submit"); let s=0; quiz.forEach((q,i)=>{ if(answers[i]===q.a) s++; }); setScore(s); setSubmitted(true); };
  const tryAgain=()=>{ if(topic) loadQuiz(topic,quiz.length||10); };

  // VOICE handlers
  const onVoiceTopic = (txt)=>{ if(!txt) return; setTopic(txt); };
  const onVoiceDoubt = (txt)=>{ if(!txt) return; setQuestion(txt); };

  const speakDoubtAnswer = ()=>{
    const txt = doubtSections.map(s=>`${s.heading}. ${s.content}`).join(". ");
    speak(txt, lang);
  };
  const speakSummary = ()=>{
    const txt = summarySections.map(s=>`${s.heading}. ${s.content}`).join(". ");
    speak(txt, lang);
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title={`🔥 ${tl("trending")}`}>
        <View style={styles.trendItem}>
          <Text style={{fontWeight:"800", color:"#0B1B4D"}}>Photosynthesis</Text>
          <View style={{flexDirection:"row", gap:10, marginTop:8}}>
            <SmallBtn title="Quick Summary" onPress={()=>onExplain("Photosynthesis")} />
            <SmallBtn title="Practice 10Q" onPress={()=>loadQuiz("Photosynthesis",10)} />
          </View>
        </View>
      </Card>

      <Card title="Student (Explain · Doubt · Quiz · Voice)">
        <Text style={styles.muted}>Enter by text or use the mic to speak your topic/doubt.</Text>

        <Text style={styles.label}>{tt(lang,"topic")}</Text>
        <Input placeholder="e.g., Photosynthesis" value={topic} onChangeText={setTopic}/>
        <View style={{flexDirection:"row",gap:8,marginTop:8, alignItems:"center"}}>
          <Btn title={tt(lang,"explain")} onPress={()=>onExplain()}/>
          <Input style={{flex:0.35}} placeholder={tt(lang,"qcount")} value={String(count)} onChangeText={setCount} keyboardType="numeric"/>
          <Btn title={tt(lang,"startQuiz")} onPress={()=>loadQuiz()}/>
        </View>
        <VoiceButton lang={lang} onResult={onVoiceTopic} style={{marginTop:8}} tl={(k)=>tt(lang,k)} />

        {!!summarySections.length && (
          <ExplainCard
            title={`Explanation of ${topic}`}
            sections={summarySections}
            onSave={async()=>addNote({title:`Explanation — ${topic}`,topic,sections:summarySections})}
            onPractice={()=>loadQuiz(topic,10)}
            onShare={()=>Alert.alert("Share","Flow later")}
            onSpeak={speakSummary}
            tl={tl}
            lang={lang}
          />
        )}

        {!!quiz.length && (
          <View style={styles.quizCard}>
            <Text style={styles.sectionTitle}>{tt(lang,"quizOn")} {topic} ({quiz.length} Qs)</Text>

            {quiz.map((q,i)=>(
              <View key={String(i)} style={[styles.quizItem, submitted && answers[i]===q.a ? {borderColor:"#B7E4C7"} : {}]}>
                <Text style={{fontWeight:"700",color:"#0B1B4D"}}>{q.q}</Text>
                {q.options?.map((opt,oi)=> {
                  const isSelected = answers[i]===oi;
                  const isCorrect  = submitted && q.a===oi;
                  const isWrongSel = submitted && isSelected && q.a!==oi;

                  let bg="#fff", br="#DDE6FF", txt="#0B1B4D";
                  if(!submitted && isSelected){ bg="#E9F0FF"; br="#B7C7F3"; }
                  if(submitted && isCorrect){ bg="#E7F9EF"; br:"#34C759"; }
                  if(submitted && isWrongSel){ bg:"#FDECEC"; br:"#FF6B6B"; }

                  return (
                    <TouchableOpacity key={String(oi)} onPress={()=>chooseOption(i,oi)} activeOpacity={0.85}
                      style={{marginTop:8, padding:10, borderRadius:10, borderWidth:1, borderColor:br, backgroundColor:bg}}>
                      <Text style={{color:txt}}>• {opt}</Text>
                    </TouchableOpacity>
                  );
                })}
                {submitted && (
                  <Text style={{marginTop:6, color:"#5B6CA9"}}>
                    Correct Answer: {["A","B","C","D"][q.a]}
                  </Text>
                )}
              </View>
            ))}

            {!submitted ? (
              <View style={{marginTop:12, flexDirection:"row", gap:10}}>
                <SmallBtn title={tt(lang,"submit")} onPress={submitQuiz}/>
                <SmallBtn title={tt(lang,"reset")} onPress={()=>{ setAnswers(Array(quiz.length).fill(null)); setSubmitted(false); setScore(0); }}/>
              </View>
            ) : (
              <View style={{marginTop:12}}>
                <Text style={{fontWeight:"900", color:"#0B1B4D"}}>
                  {tt(lang,"score")}: {score} / {quiz.length}   ({Math.round((score/quiz.length)*100)}%)
                </Text>
                <View style={{height:8}}/>
                <SmallBtn title={tt(lang,"tryAgain")} onPress={tryAgain}/>
              </View>
            )}
          </View>
        )}

        <View style={{height:12}}/>

        <Text style={styles.label}>{tt(lang,"doubt")}</Text>
        <Input placeholder="e.g., Why is chlorophyll green?" value={question} onChangeText={setQuestion}/>
        <View style={{flexDirection:"row", gap:8, alignItems:"center", marginTop:8}}>
          <Btn title={tt(lang,"solve")} onPress={onDoubt}/>
        </View>
        <VoiceButton lang={lang} onResult={onVoiceDoubt} style={{marginTop:8}} tl={(k)=>tt(lang,k)} />

        {!!doubtSections.length && (
          <ExplainCard
            title="Doubt — Explained"
            sections={doubtSections}
            onSave={async()=>addNote({title:"Doubt — Explained",topic:question,sections:doubtSections})}
            onPractice={()=>loadQuiz(topic||"General",5)}
            onShare={()=>Alert.alert("Share","Flow later")}
            onSpeak={speakDoubtAnswer}
            tl={tl}
            lang={lang}
          />
        )}

        <View style={{height:12}}/>
        <Btn title={tt(lang,"back")} onPress={onBack}/>
      </Card>
    </ScrollView>
  );
}

/* =================== TEACHER (unchanged core) =================== */
function TeacherScreen({lang, apiBase, token, user, onBack, tl}){
  const [topic,setTopic]=useState("");
  const [planSections,setPlanSections]=useState([]);
  const [quiz,setQuiz]=useState([]);
  const [loading,setLoading]=useState(false);
  const teacherId=user?.id||null;
  const profile={grade:"Class 10",board:"CBSE",locale:"IN"};

  const hit=async(path,body)=>{
    if(!apiBase){ Alert.alert("API","Not set"); return null; }
    setLoading(true);
    try{ const {json,text}=await safeFetch(`${apiBase}${path}`,{method:"POST",body:JSON.stringify(body)},token); return json??(text?{text}:{});
    }catch(e){ return {__error:String(e?.message||e)}; }
    finally{ setLoading(false); }
  };
  const emit=async(action,t)=>{
    if(!apiBase||!teacherId) return;
    try{ await safeFetch(`${apiBase}/events/teacher`,{method:"POST",body:JSON.stringify({
      teacherId,action,topic:t||topic,grade:profile.grade,board:profile.board,locale:profile.locale
    })},token); }catch{}
  };

  const genPlan=async()=>{
    if(!topic.trim()) return Alert.alert("Topic?","Please enter a topic");
    await emit("open",topic);
    const j=await hit("/ai/summary",{topic,grade:profile.grade,board:profile.board,lang});
    let txt=j?.summary||j?.text||"";
    txt = await ensureLangText({ apiBase, token, text: txt, lang });
    let secs=txt?parseExplanation(txt):localExplain(topic);
    if(j?.__error) Alert.alert("Notice","Offline plan");
    setPlanSections(secs);
  };
  const genTest=async()=>{
    if(!topic.trim()) return Alert.alert("Topic?","Please enter a topic");
    await emit("test_generate",topic);
    const j=await hit("/ai/test",{topic,count:10,board:profile.board,grade:profile.grade,lang});
    let q=Array.isArray(j?.mcq)?j.mcq:localQuiz(topic,10);
    if(j?.__error) Alert.alert("Notice","Offline quiz");
    setQuiz(q);
  };
  const onSearch=async()=>{
    if(!topic.trim()) return Alert.alert("Search","Enter a topic to search");
    await emit("search",topic);
    Alert.alert("Search","Signal recorded.");
  };

  const speakPlan = ()=>{
    const txt = planSections.map(s=>`${s.heading}. ${s.content}`).join(". ");
    speak(txt, lang);
  };

  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title="Teacher (Lesson Plan · Test Generate)">
        <Text style={styles.muted}>Actions send anonymous signals to students' trending feed.</Text>

        <Text style={styles.label}>Topic</Text>
        <Input placeholder="e.g., Electricity — Ohm’s Law" value={topic} onChangeText={setTopic}/>
        <View style={{flexDirection:"row",gap:8,marginTop:8}}>
          <Btn title="Search" onPress={onSearch}/>
          <Btn title="Lesson Plan" onPress={genPlan}/>
          <Btn title="Generate Test" onPress={genTest}/>
        </View>

        {!!planSections.length && (
          <ExplainCard
            title={`Lesson Plan — ${topic}`}
            sections={planSections}
            onSave={async()=>addNote({title:`Lesson Plan — ${topic}`,topic,sections:planSections})}
            onPractice={()=>Alert.alert("Tip","Use Generate Test")}
            onShare={()=>Alert.alert("Share","Flow later")}
            onSpeak={speakPlan}
            tl={tl}
            lang={lang}
          />
        )}

        {!!quiz.length && (
          <View style={styles.quizCard}>
            <Text style={styles.sectionTitle}>Generated Test (Answers for Teacher)</Text>
            {quiz.map((q,i)=>(
              <View key={String(i)} style={styles.quizItem}>
                <Text style={{fontWeight:"700",color:"#0B1B4D"}}>{q.q}</Text>
                {Array.isArray(q.options)&&q.options.map((opt,idx)=><Text key={String(idx)}>• {opt}</Text>)}
                {"a" in q ? <Text style={{marginTop:4,color:"#5B6CA9"}}>Answer: {["A","B","C","D"][q.a]}</Text> : null}
              </View>
            ))}
          </View>
        )}

        <View style={{height:12}}/>
        <Btn title={tt("en","back")} onPress={onBack}/>
      </Card>
    </ScrollView>
  );
}

/* =================== HELPERS =================== */
function parseExplanation(text){
  // naive parser: split into sections by two newlines or headings
  const parts = String(text).trim().split(/\n{2,}/);
  const map = parts.map((p,idx)=>({
    heading: p.split("\n")[0].slice(0,64) || `Section ${idx+1}`,
    content: p.includes("\n") ? p.split("\n").slice(1).join("\n") : p
  }));
  return map.length ? map : [{heading:"Summary", content:text}];
}

/* =================== MISC SCREENS =================== */
const Subscriptions=({onBack})=>(
  <ScrollView contentContainerStyle={styles.body}>
    <Card title="Subscriptions">
      <Card><Text>Student Plan — ₹99 / month</Text><Btn title="Buy Student (mock)" onPress={()=>Alert.alert("Purchase","Student plan (mock)")}/></Card>
      <Card><Text>Teacher Plan — ₹199 / month</Text><Btn title="Buy Teacher (mock)" onPress={()=>Alert.alert("Purchase","Teacher plan (mock)")}/></Card>
      <Btn title={tt("en","back")} onPress={onBack}/>
    </Card>
  </ScrollView>
);
function Settings({apiBase,setApiBase,onBack}){
  const [url,setUrl]=useState(apiBase||"");
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title="Settings">
        <Text style={{color:"#0B1B4D",marginBottom:8}}>Replit Backend URL</Text>
        <Input value={url} onChangeText={setUrl} placeholder="https://<your>.replit.dev" autoCapitalize="none"/>
        <View style={{flexDirection:"row",gap:8}}>
          <Btn title="Save" onPress={async()=>{ const clean=(url||"").trim().replace(/\/+$/,""); await setApiBase(clean); await Storage.setItem(K_API,clean); Alert.alert("Saved","API URL updated"); }}/>
          <Btn title={tt("en","back")} onPress={onBack}/>
        </View>
      </Card>
    </ScrollView>
  );
}
const HelpScreen=({onBack})=>(
  <ScrollView contentContainerStyle={styles.body}>
    <Card title="How to use (Quick)">
      <Text>• Topic → Explain (structured){"\n"}• Doubt → 4–6 line answer + mnemonic{"\n"}• Quiz → answers after Submit + score{"\n"}• Voice → Speak topic/doubt; play answers</Text>
      <View style={{height:12}}/>
      <Btn title={tt("en","back")} onPress={onBack}/>
    </Card>
  </ScrollView>
);
const AboutScreen=({onBack})=>(
  <ScrollView contentContainerStyle={styles.body}>
    <Card title="About"><Text>TechMate AI — Smarter Learning, Smarter Teaching{"\n"}v2.2 (Voice Assistant)</Text><View style={{height:12}}/><Btn title={tt("en","back")} onPress={onBack}/></Card>
  </ScrollView>
);
function ProfileScreen({user,onBack}){
  const u=user||{};
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title="View Profile">
        <View style={{alignItems:"center",marginBottom:12}}>
          <View style={styles.avatar}><Text style={{color:"#12308A",fontWeight:"900"}}>{(u.email?u.email[0]:"U").toUpperCase()}</Text></View>
          <Text style={{marginTop:8,fontWeight:"800",color:"#0B1B4D"}}>{u.email||"-"}</Text>
          <Text style={{color:"#5B6CA9"}}>User ID: {u.id||"-"}</Text>
        </View>
        <Text>Role: {u.role||"-"}</Text>
        <View style={{height:12}}/><Btn title={tt("en","back")} onPress={onBack}/>
      </Card>
    </ScrollView>
  );
}
function FeedbackScreen({onSubmit,onBack}){
  const [msg,setMsg]=useState("");
  return (
    <ScrollView contentContainerStyle={styles.body}>
      <Card title="Feedback">
        <Input value={msg} onChangeText={setMsg} placeholder="Your message..." multiline/>
        <View style={{flexDirection:"row",gap:8}}>
          <Btn title="Send" onPress={()=>{ if(!msg.trim()) return Alert.alert("Feedback","Write something"); Alert.alert("Thanks!","Received"); onSubmit&&onSubmit(); setMsg(""); }}/>
          <Btn title={tt("en","back")} onPress={onBack}/>
        </View>
      </Card>
    </ScrollView>
  );
}
const Roles=({onBack})=>(
  <ScrollView contentContainerStyle={styles.body}>
    <Card title="Switch Role / Logout"><Text style={styles.muted}>Demo screen — advanced role management later.</Text><Btn title={tt("en","back")} onPress={onBack}/></Card>
  </ScrollView>
);

/* =================== COMMON UI =================== */
const Card=({title,children})=>(
  <View style={styles.card}>{title?<Text style={styles.title}>{title}</Text>:null}{children}</View>
);
const Input=props=>(<TextInput {...props} style={[styles.input,props.style]}/>);
function Btn({title,onPress}){ const[locked,setLocked]=useState(false); return(
  <TouchableOpacity onPress={()=>{ if(locked) return; setLocked(true); try{ onPress&&onPress(); } finally{ setTimeout(()=>setLocked(false),400); } }}
    style={styles.btn} activeOpacity={0.85}>
    <Text style={{color:"#fff",fontWeight:"700",textAlign:"center"}} numberOfLines={1}>{title}</Text>
  </TouchableOpacity>
);}
const SmallBtn=({title,onPress})=>(
  <TouchableOpacity onPress={onPress} style={styles.smallBtn}><Text style={{color:"#fff",fontWeight:"800"}}>{title}</Text></TouchableOpacity>
);
const Chip=({text,active,onPress})=>(
  <TouchableOpacity onPress={onPress} style={[styles.chip,active&&styles.chipActive]}>
    <Text style={{color:active?"#fff":"#12308A",fontWeight:"700"}}>{text}</Text>
  </TouchableOpacity>
);

/* =================== FOOTER =================== */
function Footer({apiBase,user}){
  return (
    <View style={{padding:8,alignItems:"center"}}>
      <Text style={{fontSize:12,color:"#5B6CA9"}}>API: {apiBase||"not set"} {user?` | ${user.role?.toUpperCase()} | ID:${user.id}`:""}</Text>
    </View>
  );
}

/* =================== STYLES =================== */
const styles = StyleSheet.create({
  header:{ paddingTop:36,paddingBottom:12,paddingHorizontal:16, backgroundColor:"#E9F0FF",
    borderBottomWidth:1,borderBottomColor:"#C7D3FB", flexDirection:"row",alignItems:"center",justifyContent:"space-between" },
  link:{ color:"#1e40af", fontWeight:"800", fontSize:16 },
  brand:{ fontWeight:"900", color:"#0B1B4D", fontSize:18 },

  drawerScrim:{ position:"absolute",left:0,right:0,top:0,bottom:0, backgroundColor:"rgba(0,0,0,0.25)" },
  drawer:{ position:"absolute", top:0,bottom:0,left:0,width:280, backgroundColor:"#fff", padding:16,
    borderTopRightRadius:16,borderBottomRightRadius:16, shadowColor:"#000",shadowOpacity:0.25,shadowRadius:12,elevation:12 },
  logo:{ width:40,height:40,borderRadius:12, backgroundColor:"#12308A", alignItems:"center",justifyContent:"center" },

  splash:{ flex:1,justifyContent:"center",alignItems:"center",backgroundColor:"#0d5ea6",padding:24 },
  splashCard:{ width:"92%", borderRadius:32, paddingVertical:40, alignItems:"center",
    backgroundColor:"rgba(255,255,255,0.09)", borderWidth:1, borderColor:"rgba(255,255,255,0.18)" },
  bigBtn:{ marginTop:26, backgroundColor:"#fff", paddingHorizontal:28, paddingVertical:12, borderRadius:12,
    shadowColor:"#000",shadowOpacity:0.25,shadowRadius:8,elevation:5 },
  bigBtnText:{ color:"#0d5ea6", fontWeight:"800", letterSpacing:1, textTransform:"uppercase" },

  body:{ padding:16, gap:12 },
  card:{ backgroundColor:"#fff", borderWidth:1, borderColor:"#D6E0FF", borderRadius:18, padding:14,
    shadowColor:"#000",shadowOpacity:0.06,shadowRadius:6,elevation:2 },
  title:{ fontSize:18, fontWeight:"900", color:"#0B1B4D", marginBottom:8 },
  muted:{ color:"#5B6CA9", marginBottom:12 },

  explainCard:{ marginTop:12, backgroundColor:"#FFFFFF", borderWidth:1, borderColor:"#DDE6FF",
    borderRadius:20, padding:14, shadowColor:"#000",shadowOpacity:0.08,shadowRadius:8,elevation:2 },
  explainTitle:{ fontSize:20, fontWeight:"900", color:"#0B1B4D" },
  explainBlock:{ marginTop:10, backgroundColor:"#F7FAFF", borderRadius:12, padding:10, borderWidth:1, borderColor:"#E6EEFF" },
  explainHeading:{ fontWeight:"900", color:"#12308A", marginBottom:6 },
  explainText:{ color:"#28324D", lineHeight:22 },

  quizCard:{ marginTop:12, borderWidth:1, borderColor:"#DDE6FF", borderRadius:16, padding:12, backgroundColor:"#fff" },
  quizItem:{ marginTop:8, padding:10, borderWidth:1, borderColor:"#E6EEFF", borderRadius:10 },

  label:{ fontWeight:"700", color:"#0B1B4D", marginTop:6, marginBottom:4 },
  sectionTitle:{ fontWeight:"900", color:"#0B1B4D", fontSize:16 },

  input:{ backgroundColor:"#fff", borderWidth:1, borderColor:"#B7C7F3", borderRadius:12, padding:10, minHeight:44 },
  btn:{ backgroundColor:"#12308A", paddingVertical:12, borderRadius:12, alignItems:"center", paddingHorizontal:12 },
  smallBtn:{ backgroundColor:"#12308A", paddingVertical:8, paddingHorizontal:12, borderRadius:10 },

  chip:{ paddingVertical:8, paddingHorizontal:14, borderWidth:1, borderColor:"#12308A", borderRadius:20, backgroundColor:"#fff" },
  chipActive:{ backgroundColor:"#12308A", borderColor:"#12308A" },

  avatar:{ width:72, height:72, borderRadius:36, backgroundColor:"#e9eefc", alignItems:"center", justifyContent:"center" },

  trendItem:{ borderWidth:1, borderColor:"#D6E0FF", borderRadius:16, padding:12 },

  ghostBtn:{ marginTop:10, paddingVertical:10, alignItems:"center" },

  micBtn:{ flexDirection:"row", alignItems:"center", justifyContent:"center",
    backgroundColor:"#10b981", paddingVertical:10, paddingHorizontal:12, borderRadius:12 }
});
