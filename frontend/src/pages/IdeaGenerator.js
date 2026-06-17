import { useState } from "react";
import { Loader2, Lightbulb, ArrowRight, TrendingUp, Link2, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import ChannelContextToggle from "@/components/ChannelContextToggle";

export default function IdeaGenerator() {
  const { lang, t } = useLang();
  const nav = useNavigate();
  const [niche, setNiche] = useState("");
  const [count, setCount] = useState(6);
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState([]);
  const [refUrls, setRefUrls] = useState([""]);
  const [refsMeta, setRefsMeta] = useState([]);
  const [showRefs, setShowRefs] = useState(false);
  const [useChannel, setUseChannel] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!niche.trim()) return;
    setLoading(true);
    setIdeas([]);
    setRefsMeta([]);
    try {
      const urls = refUrls.map((u) => u.trim()).filter(Boolean);
      const { data } = await api.post("/ideas/generate", {
        niche, count, language: lang, reference_urls: urls,
        use_channel_context: useChannel,
      });
      setIdeas(data.ideas || []);
      setRefsMeta(data.references || []);
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setLoading(false);
    }
  };

  const setRefUrl = (i, v) => {
    const copy = [...refUrls];
    copy[i] = v;
    setRefUrls(copy);
  };
  const addRef = () => refUrls.length < 3 && setRefUrls([...refUrls, ""]);
  const removeRef = (i) => setRefUrls(refUrls.filter((_, idx) => idx !== i));

  const handleUseIdea = (idea) => {
    sessionStorage.setItem("tk_seed_prompt", idea.hook || idea.title);
    sessionStorage.setItem("tk_seed_title", idea.title);
    nav("/app/studio");
  };

  const viewColors = { low: "#A1A1AA", medium: "#F59E0B", high: "#10B981" };

  return (
    <div className="p-4 sm:p-8 md:p-12 max-w-7xl fade-up" data-testid="ideas-page">
      <div className="mb-8">
        <div className="font-mono text-xs text-zinc-500 mb-2">IDEAS</div>
        <h1 className="font-display text-4xl sm:text-5xl">{t("ideaGen")}</h1>
        <p className="text-zinc-500 mt-3 max-w-xl">
          {lang === "tr" ? "Kanal nişine uygun, tıklanma potansiyeli yüksek video fikirleri." : "Click-worthy video ideas tailored to your niche."}
        </p>
      </div>

      <form onSubmit={submit} className="tk-card p-6 mb-6 space-y-4" data-testid="ideas-form">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_auto] gap-3 items-end">
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
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <ChannelContextToggle value={useChannel} onChange={setUseChannel} testid="ideas-channel-toggle" />
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <button
            type="button"
            onClick={() => setShowRefs(!showRefs)}
            className="text-xs font-mono text-zinc-400 hover:text-white inline-flex items-center gap-2"
            data-testid="ideas-toggle-refs-btn"
          >
            <Link2 className="w-3.5 h-3.5" />
            {lang === "tr" ? "+ REFERANS YOUTUBE LİNKİ EKLE (OPSİYONEL)" : "+ ADD REFERENCE YOUTUBE LINKS (OPTIONAL)"}
          </button>

          {showRefs && (
            <div className="mt-3 space-y-2" data-testid="ideas-refs-block">
              <p className="text-xs text-zinc-500 max-w-2xl">
                {lang === "tr"
                  ? "3'e kadar YouTube video linki ekle. AI bu videoların başlık ve formatlarını analiz edip benzer ruhta fikirler üretir."
                  : "Add up to 3 YouTube video links. AI will analyze their titles & formats and generate similar-style ideas."}
              </p>
              {refUrls.map((u, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={u}
                    onChange={(e) => setRefUrl(i, e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="tk-input font-mono text-sm"
                    data-testid={`ideas-ref-url-${i}`}
                  />
                  {refUrls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      className="tk-btn-secondary px-3"
                      data-testid={`ideas-ref-remove-${i}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {refUrls.length < 3 && (
                <button type="button" onClick={addRef} className="text-xs font-mono text-[#FF3B30] hover:underline" data-testid="ideas-ref-add-btn">
                  + {lang === "tr" ? "BİR LİNK DAHA" : "ADD ANOTHER"}
                </button>
              )}
            </div>
          )}
        </div>
      </form>

      {refsMeta.length > 0 && (
        <div className="tk-card p-4 mb-4" data-testid="ideas-refs-analyzed">
          <div className="font-mono text-xs text-zinc-500 mb-3">{lang === "tr" ? "ANALİZ EDİLEN VİDEOLAR" : "ANALYZED VIDEOS"}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {refsMeta.map((r, i) => (
              <a key={i} href={r.url} target="_blank" rel="noreferrer" className="flex gap-3 items-start group">
                {r.thumbnail && <img src={r.thumbnail} alt="" className="w-20 aspect-video object-cover border border-zinc-800 rounded-sm" />}
                <div className="min-w-0">
                  <div className="text-sm text-zinc-100 group-hover:text-[#FF3B30] line-clamp-2">{r.title}</div>
                  <div className="font-mono text-xs text-zinc-500 mt-1">{r.author}</div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="tk-card p-12 flex flex-col items-center text-zinc-500">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <div className="font-mono text-xs">{t("generating").toUpperCase()}</div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="ideas-results">
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
