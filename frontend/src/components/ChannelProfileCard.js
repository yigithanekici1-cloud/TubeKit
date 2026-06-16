import { useEffect, useState } from "react";
import { Youtube, Edit3, Check, X, Loader2, Wand2, Palette, Users, Hash, Type } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";

export default function ChannelProfileCard() {
  const { lang, t } = useLang();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editAuto, setEditAuto] = useState(false);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  const reload = async () => {
    const { data } = await api.get("/profile/channel");
    setProfile(data);
    setDescription(data.description || "");
    setName(data.name || "");
    setUrl(data.url || "");
  };

  useEffect(() => {
    api.get("/profile/channel")
      .then((r) => {
        setProfile(r.data);
        setDescription(r.data.description || "");
        setName(r.data.name || "");
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
      await api.post("/profile/channel", { description, url, name });
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
              {lang === "tr" ? "KANAL ADI (OPSİYONEL)" : "CHANNEL NAME (OPTIONAL)"}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={lang === "tr" ? "Ana Kanalım" : "My Main Channel"}
              className="tk-input"
              data-testid="channel-name-input"
            />
          </div>
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
          {profile.name && (
            <div className="font-display text-lg text-zinc-100" data-testid="channel-name-display">{profile.name}</div>
          )}
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
          {profile.auto_profile?.thumbnails_analyzed > 0 && (
            <div className="text-xs font-mono text-zinc-500" data-testid="channel-thumbs-analyzed">
              {lang === "tr" ? "GÖRSEL ANALİZİ" : "VISUAL ANALYSIS"}: <span className="text-[#10B981]">{profile.auto_profile.thumbnails_analyzed}</span> thumbnail
            </div>
          )}
          {profile.meta?.title && (
            <div className="text-xs font-mono text-zinc-500">
              {lang === "tr" ? "TESPİT EDİLEN" : "DETECTED"}: <span className="text-zinc-300">{profile.meta.title}</span>
            </div>
          )}

          {profile.auto_profile && (
            <div className="mt-4 pt-4 border-t border-zinc-800" data-testid="channel-auto-profile">
              <div className="flex items-center justify-between mb-3">
                <div className="font-mono text-xs text-zinc-500 inline-flex items-center gap-2">
                  <Wand2 className="w-3 h-3 text-[#FF3B30]" />
                  {lang === "tr" ? "AI KANAL STİL ANALİZİ" : "AI CHANNEL STYLE ANALYSIS"}
                </div>
                <button
                  onClick={() => setEditAuto(!editAuto)}
                  data-testid="channel-auto-edit-toggle"
                  className="text-xs font-mono text-zinc-400 hover:text-white inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3 h-3" />
                  {editAuto ? (lang === "tr" ? "BİTİR" : "DONE") : (lang === "tr" ? "DÜZENLE" : "EDIT")}
                </button>
              </div>
              <AutoProfileView
                data={profile.auto_profile}
                editing={editAuto}
                lang={lang}
                onSave={async (patch) => {
                  try {
                    await api.patch("/profile/channel/auto", patch);
                    await reload();
                    toast.success(lang === "tr" ? "Güncellendi" : "Updated");
                  } catch (e) {
                    toast.error(formatApiError(e.response?.data?.detail) || e.message);
                  }
                }}
              />
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

function EditableField({ icon: Icon, label, value, onCommit, multiline }) {
  const [v, setV] = useState(value || "");
  const [touched, setTouched] = useState(false);
  return (
    <div className="bg-zinc-950/50 border border-zinc-800 rounded-sm p-3">
      <div className="font-mono text-[10px] text-zinc-500 mb-1 inline-flex items-center gap-1.5">
        <Icon className="w-3 h-3" /> {label.toUpperCase()}
      </div>
      {multiline ? (
        <textarea
          value={v}
          rows={2}
          onChange={(e) => { setV(e.target.value); setTouched(true); }}
          onBlur={() => touched && onCommit(v)}
          className="tk-input text-xs resize-none"
        />
      ) : (
        <input
          value={v}
          onChange={(e) => { setV(e.target.value); setTouched(true); }}
          onBlur={() => touched && onCommit(v)}
          className="tk-input text-xs"
        />
      )}
    </div>
  );
}

function AutoProfileView({ data, editing, lang, onSave }) {
  const [themes, setThemes] = useState((data?.themes || []).join(", "));

  if (editing) {
    return (
      <div>
        <div className="font-mono text-[10px] text-zinc-500 mb-1">SUMMARY</div>
        <textarea
          defaultValue={data.summary || ""}
          rows={2}
          onBlur={(e) => e.target.value !== (data.summary || "") && onSave({ summary: e.target.value })}
          className="tk-input text-sm resize-none mb-3"
        />
        <div className="grid sm:grid-cols-2 gap-3">
          <EditableField icon={Type} label={lang === "tr" ? "Ton" : "Tone"} value={data.tone} onCommit={(v) => onSave({ tone: v })} />
          <EditableField icon={Users} label={lang === "tr" ? "Kitle" : "Audience"} value={data.audience} onCommit={(v) => onSave({ audience: v })} />
          <EditableField icon={Hash} label={lang === "tr" ? "Başlık Formülü" : "Title Pattern"} value={data.title_pattern} onCommit={(v) => onSave({ title_pattern: v })} multiline />
          <EditableField icon={Palette} label={lang === "tr" ? "Renk Paleti" : "Color Palette"} value={data.color_palette} onCommit={(v) => onSave({ color_palette: v })} />
        </div>
        <div className="mt-3">
          <div className="font-mono text-[10px] text-zinc-500 mb-1.5">{lang === "tr" ? "TEMALAR (VİRGÜLLE AYIR)" : "THEMES (COMMA-SEPARATED)"}</div>
          <input
            value={themes}
            onChange={(e) => setThemes(e.target.value)}
            onBlur={() => onSave({ themes: themes.split(",").map((s) => s.trim()).filter(Boolean) })}
            className="tk-input text-xs"
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      {data.summary && <p className="text-sm text-zinc-200 mb-3">{data.summary}</p>}
      <div className="grid sm:grid-cols-2 gap-3">
        {data.tone && <AutoField icon={Type} label={lang === "tr" ? "Ton" : "Tone"} value={data.tone} />}
        {data.audience && <AutoField icon={Users} label={lang === "tr" ? "Kitle" : "Audience"} value={data.audience} />}
        {data.title_pattern && <AutoField icon={Hash} label={lang === "tr" ? "Başlık Formülü" : "Title Pattern"} value={data.title_pattern} />}
        {data.color_palette && <AutoField icon={Palette} label={lang === "tr" ? "Renk Paleti" : "Color Palette"} value={data.color_palette} />}
        {data.typography_style && <AutoField icon={Type} label={lang === "tr" ? "Tipografi" : "Typography"} value={data.typography_style} />}
        {data.face_presence && <AutoField icon={Users} label={lang === "tr" ? "Yüz Kullanımı" : "Face Presence"} value={data.face_presence} />}
        {data.composition_pattern && <AutoField icon={Hash} label={lang === "tr" ? "Kompozisyon" : "Composition"} value={data.composition_pattern} />}
        {data.visual_summary && <AutoField icon={Palette} label={lang === "tr" ? "Görsel Özet" : "Visual Summary"} value={data.visual_summary} />}
      </div>
      {data.themes?.length > 0 && (
        <div className="mt-3">
          <div className="font-mono text-[10px] text-zinc-500 mb-1.5">{lang === "tr" ? "TEMALAR" : "THEMES"}</div>
          <div className="flex flex-wrap gap-1.5">
            {data.themes.map((th, i) => (
              <span key={i} className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-sm">{th}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
