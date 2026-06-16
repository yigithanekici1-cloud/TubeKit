import { useState } from "react";
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function SEOWriter() {
  const { lang, t } = useLang();
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState("");
  const [audience, setAudience] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const { data } = await api.post("/seo/generate", { topic, keywords, audience, language: lang });
      setResult(data);
    } catch (e2) {
      toast.error(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setLoading(false);
    }
  };

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
