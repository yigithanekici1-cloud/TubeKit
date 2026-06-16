import { createContext, useContext, useEffect, useMemo, useState } from "react";

const LangCtx = createContext(null);

const dict = {
  tr: {
    appName: "TubeKit",
    tagline: "YouTube içerikleri için tasarım + SEO + fikir motoru",
    login: "Giriş Yap",
    register: "Kayıt Ol",
    logout: "Çıkış",
    email: "E-posta",
    password: "Şifre",
    name: "İsim",
    dashboard: "Pano",
    thumbnailStudio: "Thumbnail Stüdyo",
    seoWriter: "SEO Yazar",
    ideaGen: "Fikir Üretici",
    generate: "Üret",
    generating: "Üretiliyor...",
    download: "İndir",
    save: "Kaydet",
    topic: "Konu",
    keywords: "Anahtar Kelimeler",
    audience: "Hedef Kitle",
    niche: "Niş / Kategori",
    titles: "Başlıklar",
    description: "Açıklama",
    tags: "Etiketler",
    hashtags: "Hashtag'ler",
    aiPrompt: "AI Promptu",
    titleOverlay: "Başlık Metni",
    style: "Stil",
    uploadImage: "Görsel Yükle",
    addText: "Metin Ekle",
    yourThumbnails: "Thumbnail'leriniz",
    recentActivity: "Son Aktiviteler",
    welcome: "Tekrar hoş geldin",
    statsThumbs: "Thumbnail",
    statsSEO: "SEO Taslağı",
    statsIdeas: "Fikir Oturumu",
    copy: "Kopyala",
    copied: "Kopyalandı",
    noData: "Henüz veri yok. İlk üretiminizi yapın.",
  },
  en: {
    appName: "TubeKit",
    tagline: "Design, SEO & ideas engine for YouTube creators",
    login: "Log In",
    register: "Sign Up",
    logout: "Sign out",
    email: "Email",
    password: "Password",
    name: "Name",
    dashboard: "Dashboard",
    thumbnailStudio: "Thumbnail Studio",
    seoWriter: "SEO Writer",
    ideaGen: "Idea Generator",
    generate: "Generate",
    generating: "Generating...",
    download: "Download",
    save: "Save",
    topic: "Topic",
    keywords: "Keywords",
    audience: "Audience",
    niche: "Niche / Category",
    titles: "Titles",
    description: "Description",
    tags: "Tags",
    hashtags: "Hashtags",
    aiPrompt: "AI Prompt",
    titleOverlay: "Title Text",
    style: "Style",
    uploadImage: "Upload Image",
    addText: "Add Text",
    yourThumbnails: "Your Thumbnails",
    recentActivity: "Recent Activity",
    welcome: "Welcome back",
    statsThumbs: "Thumbnails",
    statsSEO: "SEO Drafts",
    statsIdeas: "Idea Sessions",
    copy: "Copy",
    copied: "Copied",
    noData: "No data yet. Create your first one.",
  },
};

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("tk_lang") || "tr");
  useEffect(() => { localStorage.setItem("tk_lang", lang); }, [lang]);
  const t = (k) => dict[lang][k] || k;
  const value = useMemo(() => ({ lang, setLang, t }), [lang]);
  return (
    <LangCtx.Provider value={value}>
      {children}
    </LangCtx.Provider>
  );
}

export const useLang = () => useContext(LangCtx);
