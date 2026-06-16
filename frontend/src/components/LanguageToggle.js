import { useLang } from "@/contexts/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="inline-flex border border-zinc-800 rounded-sm overflow-hidden font-mono text-xs" data-testid="language-toggle">
      <button
        onClick={() => setLang("tr")}
        data-testid="lang-tr-btn"
        className={`px-3 py-1.5 transition-colors ${lang === "tr" ? "bg-[#FF3B30] text-white" : "bg-transparent text-zinc-400 hover:text-white"}`}
      >TR</button>
      <button
        onClick={() => setLang("en")}
        data-testid="lang-en-btn"
        className={`px-3 py-1.5 transition-colors ${lang === "en" ? "bg-[#FF3B30] text-white" : "bg-transparent text-zinc-400 hover:text-white"}`}
      >EN</button>
    </div>
  );
}
