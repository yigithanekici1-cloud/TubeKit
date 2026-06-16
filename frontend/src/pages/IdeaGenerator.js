import { useState } from "react";
import { Loader2, Lightbulb, ArrowRight, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function IdeaGenerator() {
  const { lang, t } = useLang();
  const nav = useNavigate();
  const [niche, setNiche] = useState("");
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState([]);

  const submit = async (e) => {
    e.preventDefault();
    if (!niche.trim()) return;
    setLoading(true);
    setIdeas([]);
    try {
      const { data } = await api.post("/ideas/generate", { niche, count, language: lang });
      setIdeas(data.ideas || []);
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUseIdea = (idea) => {
    sessionStorage.setItem("tk_seed_prompt", idea.hook || idea.title);
    sessionStorage.setItem("tk_seed_title", idea.title);
    nav("/app/studio");
  };

  const viewColors = { low: "#A1A1AA", medium: "#F59E0B", high: "#10B981" };

  return (
    <div className="p-8 md:p-12 max-w-7xl fade-up" data-testid="ideas-page">
      <div className="mb-8">
        <div className="font-mono text-xs text-zinc-500 mb-2">IDEAS</div>
        <h1 className="font-display text-5xl">{t("ideaGen")}</h1>
        <p className="text-zinc-500 mt-3 max-w-xl">
          {lang === "tr" ? "Kanal nişine uygun, tıklanma potansiyeli yüksek video fikirleri." : "Click-worthy video ideas tailored to your niche."}
        </p>
      </div>

      <form onSubmit={submit} className="tk-card p-6 mb-6 grid md:grid-cols-[1fr_140px_auto] gap-3 items-end" data-testid="ideas-form">
        <div>
          <label className="font-mono text-xs text-zinc-500 mb-2 block">{t("niche").toUpperCase()}</label>
          <input
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder={lang === "tr" ? "Örn: oyun, yemek, finans, vlog" : "e.g. gaming, food, finance, vlog"}
            className="tk-input"
            data-testid="ideas-niche-input"
            required
          />
        </div>
        <div>
          <label className="font-mono text-xs text-zinc-500 mb-2 block">COUNT</label>
          <select value={count} onChange={(e) => setCount(+e.target.value)} className="tk-input" data-testid="ideas-count-select">
            {[3, 5, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button type="submit" disabled={loading} className="tk-btn-primary" data-testid="ideas-generate-btn">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
          {loading ? t("generating") : t("generate")}
        </button>
      </form>

      {loading && (
        <div className="tk-card p-12 flex flex-col items-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <div className="font-mono text-xs">{t("generating").toUpperCase()}</div>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="ideas-results">
        {ideas.map((idea, i) => {
          const viewKey = (idea.estimated_views || "").toLowerCase();
          const color = viewColors[viewKey] || "#A1A1AA";
          return (
            <div key={i} className="tk-card p-5 flex flex-col fade-up" style={{ animationDelay: `${i * 40}ms` }} data-testid={`idea-card-${i}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-xs uppercase text-zinc-500">{idea.format}</span>
                <span className="font-mono text-xs inline-flex items-center gap-1" style={{ color }}>
                  <TrendingUp className="w-3 h-3" /> {idea.estimated_views || "—"}
                </span>
              </div>
              <div className="font-display text-xl mb-2 leading-snug">{idea.title}</div>
              <p className="text-sm text-zinc-400 flex-1">{idea.hook}</p>
              <button
                onClick={() => handleUseIdea(idea)}
                className="tk-btn-secondary mt-4 justify-center"
                data-testid={`idea-use-${i}`}
              >
                {lang === "tr" ? "Thumbnail Oluştur" : "Create Thumbnail"} <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
