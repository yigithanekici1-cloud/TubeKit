import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ImagePlus, FileText, Lightbulb, Youtube } from "lucide-react";
import LanguageToggle from "@/components/LanguageToggle";
import { useLang } from "@/contexts/LanguageContext";

export default function Landing() {
  const { lang } = useLang();
  const copy = lang === "tr" ? {
    badge: "Yaratıcılar için yapay zekâ stüdyosu",
    h1a: "YouTube videoların için ",
    h1b: "thumbnail, başlık ve fikir",
    h1c: " — tek bir yerde.",
    sub: "AI ile çarpıcı thumbnail tasarla, SEO uyumlu başlık ve açıklamalar yaz, bir sonraki videon için fikir al. Türkçe ve İngilizce.",
    cta: "Ücretsiz Dene",
    secondary: "Giriş Yap",
    f1t: "AI Thumbnail",
    f1d: "Promptla üret ya da kendi görselini düzenle. 16:9 hazır.",
    f2t: "SEO Başlık & Açıklama",
    f2d: "Algoritmaya uygun başlıklar, açıklamalar ve hashtag'ler.",
    f3t: "İçerik Fikirleri",
    f3d: "Nişine uygun, tıklanma potansiyeli yüksek fikirler.",
  } : {
    badge: "AI studio for creators",
    h1a: "YouTube ",
    h1b: "thumbnails, titles & ideas",
    h1c: " — in one place.",
    sub: "Generate stunning thumbnails with AI, write SEO titles and descriptions, and get content ideas in one click. Turkish & English.",
    cta: "Try it free",
    secondary: "Sign In",
    f1t: "AI Thumbnail",
    f1d: "Prompt to generate or edit your own image. 16:9 ready.",
    f2t: "SEO Title & Description",
    f2d: "Algorithm-friendly titles, descriptions, and hashtags.",
    f3t: "Content Ideas",
    f3d: "Niche-specific ideas with high CTR potential.",
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 grain relative">
      <header className="border-b border-zinc-800 px-8 py-5 flex items-center justify-between relative z-[2]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#FF3B30] rounded-sm flex items-center justify-center">
            <Youtube className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-display text-xl">TubeKit</span>
        </div>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <Link to="/login" className="tk-btn-secondary" data-testid="header-login-btn">{copy.secondary}</Link>
          <Link to="/register" className="tk-btn-primary" data-testid="header-register-btn">
            {copy.cta} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </header>

      <section className="px-8 md:px-16 pt-24 pb-20 relative z-[2] max-w-7xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 border border-zinc-800 rounded-sm font-mono text-xs text-zinc-400 mb-8 fade-up">
          <Sparkles className="w-3.5 h-3.5 text-[#FF3B30]" /> {copy.badge}
        </div>
        <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl leading-[0.95] mb-6 max-w-4xl fade-up" style={{ animationDelay: "80ms" }}>
          {copy.h1a}<span className="text-[#FF3B30]">{copy.h1b}</span>{copy.h1c}
        </h1>
        <p className="text-zinc-400 text-lg max-w-2xl mb-10 fade-up" style={{ animationDelay: "160ms" }}>
          {copy.sub}
        </p>
        <div className="flex flex-wrap items-center gap-3 fade-up" style={{ animationDelay: "240ms" }}>
          <Link to="/register" className="tk-btn-primary" data-testid="hero-cta-btn">
            {copy.cta} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link to="/login" className="tk-btn-secondary" data-testid="hero-secondary-btn">{copy.secondary}</Link>
        </div>
      </section>

      <section className="px-8 md:px-16 pb-24 relative z-[2] max-w-7xl">
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: ImagePlus, t: copy.f1t, d: copy.f1d },
            { icon: FileText, t: copy.f2t, d: copy.f2d },
            { icon: Lightbulb, t: copy.f3t, d: copy.f3d },
          ].map((f, i) => (
            <div key={i} className="tk-card p-6 fade-up" style={{ animationDelay: `${300 + i * 80}ms` }}>
              <f.icon className="w-6 h-6 text-[#FF3B30] mb-4" />
              <div className="font-display text-2xl mb-2">{f.t}</div>
              <p className="text-zinc-400 text-sm">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-8 py-6 font-mono text-xs text-zinc-600 relative z-[2]">
        © {new Date().getFullYear()} TubeKit — Built for creators.
      </footer>
    </div>
  );
}
