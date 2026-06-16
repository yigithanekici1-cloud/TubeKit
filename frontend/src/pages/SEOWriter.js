import { useState } from "react";
import { Loader2, Sparkles, Copy, Check, Settings2 } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import ChannelContextToggle from "@/components/ChannelContextToggle";

export default function SEOWriter() {
  const { lang, t } = useLang();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [audience, setAudience] = useState("");
  const [videoFormat, setVideoFormat] = useState("");
  const [duration, setDuration] = useState("");
  const [tone, setTone] = useState("");
  const [uniqueAngle, setUniqueAngle] = useState("");
  const [cta, setCta] = useState("");
  const [useChannel, setUseChannel] = useState(false);
  const [showAdv, setShowAdv] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/seo/generate", {
        topic, keywords, audience, language: lang,
        video_format: videoFormat, duration, tone,
        unique_angle: uniqueAngle, cta,
        use_channel_context: useChannel,
      });
      setResult(data);
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setLoading(false);
    }
  };

  const formatOpts = lang === "tr"
    ? ["", "Tutorial", "Vlog", "İnceleme", "Liste", "Hikaye", "Deney", "Reaction", "Shorts"]
    : ["", "Tutorial", "Vlog", "Review", "List", "Story", "Experiment", "Reaction", "Shorts"];
  const durationOpts = lang === "tr"
    ? ["", "< 60sn (Shorts)", "1-5 dk", "5-10 dk", "10-20 dk", "20+ dk"]
    : ["", "< 60s (Shorts)", "1-5 min", "5-10 min", "10-20 min", "20+ min"];
  const toneOpts = lang === "tr"
    ? ["", "Samimi", "Enerjik", "Eğitici", "Dramatik", "Mizahi", "Profesyonel"]
    : ["", "Casual", "Energetic", "Educational", "Dramatic", "Humorous", "Professional"];

  return (
    <div className="p-8 md:p-12 max-w-7xl fade-up" data-testid="seo-page">
      <div className="mb-8">
        <div className="font-mono text-xs text-zinc-500 mb-2">SEO</div>
        <h1 className="font-display text-5xl">{t("seoWriter")}</h1>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr] gap-4">
        <form onSubmit={submit} className="tk-card p-6 space-y-4" data-testid="seo-form">
          <div>
            <label className="font-mono text-xs text-zinc-500 mb-2 block">{t("topic").toUpperCase()}</label>
            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              required
              placeholder={lang === "tr" ? "Örn: ev tipi mantı tarifi" : "e.g. homemade pasta recipe"}
              className="tk-input resize-none"
              data-testid="seo-topic-input"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-zinc-500 mb-2 block">{t("keywords").toUpperCase()}</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="tk-input" data-testid="seo-keywords-input" />
          </div>
          <div>
            <label className="font-mono text-xs text-zinc-500 mb-2 block">{t("audience").toUpperCase()}</label>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} className="tk-input" data-testid="seo-audience-input" />
          </div>

          <div className="border-t border-zinc-800 pt-4">
            <button
              type="button"
              onClick={() => setShowAdv(!showAdv)}
              className="text-xs font-mono text-zinc-400 hover:text-white inline-flex items-center gap-2 mb-3"
              data-testid="seo-toggle-advanced-btn"
            >
              <Settings2 className="w-3.5 h-3.5" />
              {showAdv ? (lang === "tr" ? "− DETAYLI ALANLARI GİZLE" : "− HIDE ADVANCED FIELDS") : (lang === "tr" ? "+ DETAYLI ALANLAR (OPSİYONEL)" : "+ ADVANCED FIELDS (OPTIONAL)")}
            </button>

            {showAdv && (
              <div className="space-y-3" data-testid="seo-advanced-block">
                <p className="text-xs text-zinc-500">
                  {lang === "tr" ? "Bu alanlar AI'a daha keskin başlık ve açıklama üretmesi için yardımcı olur." : "These fields help AI craft sharper, more targeted output."}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-xs text-zinc-500 mb-1.5 block">{lang === "tr" ? "FORMAT" : "FORMAT"}</label>
                    <select value={videoFormat} onChange={(e) => setVideoFormat(e.target.value)} className="tk-input" data-testid="seo-format-select">
                      {formatOpts.map((o) => <option key={o} value={o}>{o || (lang === "tr" ? "— Seç —" : "— Select —")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-zinc-500 mb-1.5 block">{lang === "tr" ? "SÜRE" : "DURATION"}</label>
                    <select value={duration} onChange={(e) => setDuration(e.target.value)} className="tk-input" data-testid="seo-duration-select">
                      {durationOpts.map((o) => <option key={o} value={o}>{o || (lang === "tr" ? "— Seç —" : "— Select —")}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-mono text-xs text-zinc-500 mb-1.5 block">{lang === "tr" ? "TON" : "TONE"}</label>
                  <select value={tone} onChange={(e) => setTone(e.target.value)} className="tk-input" data-testid="seo-tone-select">
                    {toneOpts.map((o) => <option key={o} value={o}>{o || (lang === "tr" ? "— Seç —" : "— Select —")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-xs text-zinc-500 mb-1.5 block">{lang === "tr" ? "FARKLI YÖN / USP" : "UNIQUE ANGLE / USP"}</label>
                  <textarea
                    value={uniqueAngle}
                    onChange={(e) => setUniqueAngle(e.target.value)}
                    rows={2}
                    placeholder={lang === "tr" ? "Bu videoyu diğerlerinden ne ayırıyor?" : "What makes this video different?"}
                    className="tk-input resize-none"
                    data-testid="seo-angle-input"
                  />
                </div>
                <div>
                  <label className="font-mono text-xs text-zinc-500 mb-1.5 block">{lang === "tr" ? "EYLEM ÇAĞRISI (CTA)" : "CALL TO ACTION"}</label>
                  <input
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder={lang === "tr" ? "Örn: kanalıma abone ol, e-kitabımı indir" : "e.g. subscribe, download my ebook"}
                    className="tk-input"
                    data-testid="seo-cta-input"
                  />
                </div>
              </div>
            )}
          </div>

          <ChannelContextToggle value={useChannel} onChange={setUseChannel} testid="seo-channel-toggle" />

          <button type="submit" disabled={loading} className="tk-btn-primary w-full justify-center" data-testid="seo-generate-btn">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? t("generating") : t("generate")}
          </button>
        </form>

        <div className="space-y-4" data-testid="seo-results">
          {!result && !loading && (
            <div className="tk-card p-12 text-center text-zinc-600">
              <Sparkles className="w-10 h-10 mx-auto mb-3" />
              <div className="font-mono text-xs">{lang === "tr" ? "SONUÇLAR BURADA GÖRÜNECEK" : "RESULTS WILL APPEAR HERE"}</div>
            </div>
          )}
          {loading && (
            <div className="tk-card p-12 flex flex-col items-center text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <div className="font-mono text-xs">{t("generating").toUpperCase()}</div>
            </div>
          )}
          {result && (
            <>
              <Block label={t("titles")}>
                <div className="space-y-2">
                  {result.titles?.map((tt, i) => (
                    <CopyableLine key={i} text={tt} testid={`seo-title-${i}`} />
                  ))}
                </div>
              </Block>

              <Block label={t("description")}>
                <CopyableBlock text={result.description} testid="seo-description" />
              </Block>

              <Block label={t("tags")}>
                <div className="flex flex-wrap gap-1.5">
                  {result.tags?.map((tg, i) => (
                    <span key={i} className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 text-xs font-mono text-zinc-300 rounded-sm">{tg}</span>
                  ))}
                </div>
                <div className="mt-3">
                  <CopyableLine text={(result.tags || []).join(", ")} testid="seo-tags-line" small />
                </div>
              </Block>

              <Block label={t("hashtags")}>
                <CopyableLine text={(result.hashtags || []).join(" ")} testid="seo-hashtags-line" />
              </Block>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ label, children }) {
  return (
    <div className="tk-card p-5">
      <div className="font-mono text-xs text-zinc-500 mb-3">{label.toUpperCase()}</div>
      {children}
    </div>
  );
}

function CopyableLine({ text, testid, small }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center justify-between gap-3 group">
      <div className={`${small ? "text-xs font-mono text-zinc-400" : "text-sm text-zinc-100"} flex-1`}>{text}</div>
      <button onClick={onCopy} className="opacity-60 hover:opacity-100 transition" data-testid={`copy-${testid}`}>
        {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function CopyableBlock({ text, testid }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div>
      <div className="whitespace-pre-line text-sm text-zinc-200 mb-3" data-testid={testid}>{text}</div>
      <button onClick={onCopy} className="text-xs font-mono text-zinc-500 hover:text-white inline-flex items-center gap-1" data-testid={`copy-${testid}-btn`}>
        {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "COPIED" : "COPY"}
      </button>
    </div>
  );
}
