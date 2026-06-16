import { useEffect, useState } from "react";
import { Youtube, Edit3, Check, X, Loader2, Wand2, Palette, Users, Hash, Type } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function ChannelProfileCard() {
  const { lang, t } = useLang();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const reload = async () => {
    const { data } = await api.get("/profile/channel");
    setProfile(data);
    setDescription(data.description || "");
    setUrl(data.url || "");
  };

  useEffect(() => {
    api.get("/profile/channel")
      .then((r) => {
        setProfile(r.data);
        setDescription(r.data.description || "");
        setUrl(r.data.url || "");
        if (!r.data.description && !r.data.url) setEditing(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const analyze = async () => {
    setAnalyzing(true);
    try {
      await api.post("/profile/channel/analyze");
      await reload();
      toast.success(lang === "tr" ? "Kanal analiz edildi" : "Channel analyzed");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/profile/channel", { description, url });
      const { data } = await api.get("/profile/channel");
      setProfile(data);
      setEditing(false);
      toast.success(lang === "tr" ? "Kanal profili kaydedildi" : "Channel profile saved");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDescription(profile?.description || "");
    setUrl(profile?.url || "");
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="tk-card p-6 mb-6 flex items-center gap-3 text-zinc-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="font-mono text-xs">LOADING...</span>
      </div>
    );
  }

  const hasProfile = profile && (profile.description || profile.url);

  return (
    <div className="tk-card p-6 mb-6" data-testid="channel-profile-card">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FF3B30]/10 border border-[#FF3B30]/30 rounded-sm flex items-center justify-center">
            <Youtube className="w-5 h-5 text-[#FF3B30]" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-display text-2xl">{lang === "tr" ? "Kanal Profilim" : "My Channel"}</div>
            <div className="text-xs font-mono text-zinc-500 mt-0.5">
              {lang === "tr" ? "AI bu bilgiyi her hizmette referans alabilir" : "AI can reference this across every tool"}
            </div>
          </div>
        </div>
        {!editing && hasProfile && (
          <button
            onClick={() => setEditing(true)}
            data-testid="channel-edit-btn"
            className="text-xs font-mono text-zinc-400 hover:text-white inline-flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" /> {lang === "tr" ? "DÜZENLE" : "EDIT"}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <div>
            <label className="font-mono text-xs text-zinc-500 mb-1.5 block">
              {lang === "tr" ? "KANAL TANIMI" : "CHANNEL DESCRIPTION"}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder={lang === "tr"
                ? "Örn: Türkçe teknoloji incelemeleri ve oyun videoları yapan, 25-35 yaş kitleye hitap eden, mizahi tonda bir kanal..."
                : "e.g. A tech review and gaming channel in English, targeting 25-35 year olds, with a humorous tone..."}
              className="tk-input resize-none"
              data-testid="channel-description-input"
            />
          </div>
          <div>
            <label className="font-mono text-xs text-zinc-500 mb-1.5 block">
              {lang === "tr" ? "YOUTUBE KANAL LİNKİ (OPSİYONEL)" : "YOUTUBE CHANNEL URL (OPTIONAL)"}
            </label>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/@mychannel"
              className="tk-input font-mono text-sm"
              data-testid="channel-url-input"
            />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="tk-btn-primary" data-testid="channel-save-btn">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? (lang === "tr" ? "Kaydediliyor..." : "Saving...") : (lang === "tr" ? "Kaydet" : "Save")}
            </button>
            {hasProfile && (
              <button onClick={cancel} className="tk-btn-secondary" data-testid="channel-cancel-btn">
                <X className="w-4 h-4" /> {lang === "tr" ? "İptal" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {profile.description && (
            <p className="text-sm text-zinc-300 whitespace-pre-line">{profile.description}</p>
          )}
          {profile.url && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <a
                href={profile.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-mono text-[#FF3B30] hover:underline inline-flex items-center gap-1"
              >
                <Youtube className="w-3 h-3" /> {profile.url}
              </a>
              <button
                onClick={analyze}
                disabled={analyzing}
                data-testid="channel-analyze-btn"
                className="tk-btn-secondary text-xs px-3 py-1.5"
              >
                {analyzing
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Wand2 className="w-3.5 h-3.5" />}
                {analyzing
                  ? (lang === "tr" ? "Analiz ediliyor..." : "Analyzing...")
                  : profile.auto_profile
                    ? (lang === "tr" ? "Yeniden Analiz Et" : "Re-analyze")
                    : (lang === "tr" ? "Kanalı Otomatik Analiz Et" : "Auto-analyze Channel")}
              </button>
            </div>
          )}
          {profile.meta?.title && (
            <div className="text-xs font-mono text-zinc-500">
              {lang === "tr" ? "TESPİT EDİLEN" : "DETECTED"}: <span className="text-zinc-300">{profile.meta.title}</span>
            </div>
          )}

          {profile.auto_profile && (
            <div className="mt-4 pt-4 border-t border-zinc-800" data-testid="channel-auto-profile">
              <div className="font-mono text-xs text-zinc-500 mb-3 inline-flex items-center gap-2">
                <Wand2 className="w-3 h-3 text-[#FF3B30]" />
                {lang === "tr" ? "AI KANAL STİL ANALİZİ" : "AI CHANNEL STYLE ANALYSIS"}
              </div>
              {profile.auto_profile.summary && (
                <p className="text-sm text-zinc-200 mb-3">{profile.auto_profile.summary}</p>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                {profile.auto_profile.tone && (
                  <AutoField icon={Type} label={lang === "tr" ? "Ton" : "Tone"} value={profile.auto_profile.tone} />
                )}
                {profile.auto_profile.audience && (
                  <AutoField icon={Users} label={lang === "tr" ? "Kitle" : "Audience"} value={profile.auto_profile.audience} />
                )}
                {profile.auto_profile.title_pattern && (
                  <AutoField icon={Hash} label={lang === "tr" ? "Başlık Formülü" : "Title Pattern"} value={profile.auto_profile.title_pattern} />
                )}
                {profile.auto_profile.color_palette && (
                  <AutoField icon={Palette} label={lang === "tr" ? "Renk Paleti" : "Color Palette"} value={profile.auto_profile.color_palette} />
                )}
              </div>
              {profile.auto_profile.themes?.length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[10px] text-zinc-500 mb-1.5">{lang === "tr" ? "TEMALAR" : "THEMES"}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.auto_profile.themes.map((th, i) => (
                      <span key={i} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-sm">{th}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AutoField({ icon: Icon, label, value }) {
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-sm p-3">
      <div className="font-mono text-[10px] text-zinc-500 mb-1 inline-flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label.toUpperCase()}
      </div>
      <div className="text-xs text-zinc-200">{value}</div>
    </div>
  );
}
