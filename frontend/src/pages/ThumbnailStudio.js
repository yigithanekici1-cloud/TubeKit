import { useEffect, useRef, useState } from "react";
import { Sparkles, Upload, Type, Download, Save, Loader2, Wand2, Image as ImageIcon, Trash2, X } from "lucide-react";
import api, { formatApiError } from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import ChannelContextToggle from "@/components/ChannelContextToggle";

const STYLES = [
  { id: "vibrant", labelTr: "Canlı", labelEn: "Vibrant" },
  { id: "minimal", labelTr: "Minimal", labelEn: "Minimal" },
  { id: "dramatic", labelTr: "Dramatik", labelEn: "Dramatic" },
  { id: "tech", labelTr: "Tech", labelEn: "Tech" },
  { id: "lifestyle", labelTr: "Yaşam", labelEn: "Lifestyle" },
];

export default function ThumbnailStudio() {
  const { lang, t } = useLang();
  const [mode, setMode] = useState("ai"); // ai | editor
  return (
    <div className="p-8 md:p-12 max-w-7xl fade-up" data-testid="studio-page">
      <div className="flex items-end justify-between mb-8">
        <div>
          <div className="font-mono text-xs text-zinc-500 mb-2">STUDIO</div>
          <h1 className="font-display text-5xl">{t("thumbnailStudio")}</h1>
        </div>
        <div className="inline-flex border border-zinc-800 rounded-sm overflow-hidden font-mono text-xs">
          <button
            onClick={() => setMode("ai")}
            data-testid="mode-ai-btn"
            className={`px-4 py-2 ${mode === "ai" ? "bg-[#FF3B30] text-white" : "text-zinc-400 hover:text-white"}`}
          >AI {lang === "tr" ? "ÜRET" : "GENERATE"}</button>
          <button
            onClick={() => setMode("editor")}
            data-testid="mode-editor-btn"
            className={`px-4 py-2 ${mode === "editor" ? "bg-[#FF3B30] text-white" : "text-zinc-400 hover:text-white"}`}
          >{lang === "tr" ? "EDITÖR" : "EDITOR"}</button>
        </div>
      </div>

      {mode === "ai" ? <AIPanel /> : <EditorPanel />}
    </div>
  );
}

function AIPanel() {
  const { lang, t } = useLang();
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [style, setStyle] = useState("vibrant");
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [refImages, setRefImages] = useState([]); // array of data URLs, max 3
  const [useChannel, setUseChannel] = useState(false);
  const refFileInput = useRef(null);

  useEffect(() => {
    api.get("/thumbnail/list").then((r) => setHistory(r.data.items)).catch(() => {});
  }, []);

  const onUploadRef = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const slots = 3 - refImages.length;
    const accepted = files.slice(0, slots);
    Promise.all(accepted.map((f) => new Promise((res) => {
      const r = new FileReader();
      r.onload = (ev) => res(ev.target.result);
      r.readAsDataURL(f);
    }))).then((urls) => {
      setRefImages((prev) => [...prev, ...urls].slice(0, 3));
    });
    e.target.value = "";
  };

  const removeRef = (i) => setRefImages(refImages.filter((_, idx) => idx !== i));

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error(lang === "tr" ? "Bir prompt girin" : "Enter a prompt");
      return;
    }
    setLoading(true);
    setImage(null);
    try {
      const { data } = await api.post("/thumbnail/generate", {
        prompt, title_text: title, style, language: lang,
        reference_images: refImages,
        use_channel_context: useChannel,
      });
      setImage(data.image);
      const hist = await api.get("/thumbnail/list");
      setHistory(hist.data.items);
      toast.success(lang === "tr" ? "Thumbnail hazır" : "Thumbnail ready");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadImg = () => {
    if (!image) return;
    const a = document.createElement("a");
    a.href = image;
    a.download = `tubekit-thumbnail-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-4">
      <div className="tk-card p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-xs text-zinc-500">
            {lang === "tr" ? `REFERANS FOTOĞRAFLAR (OPSİYONEL · ${refImages.length}/3)` : `REFERENCE PHOTOS (OPTIONAL · ${refImages.length}/3)`}
          </div>
          {refImages.length > 0 && (
            <button
              onClick={() => setRefImages([])}
              data-testid="ai-ref-clear-btn"
              className="text-xs font-mono text-zinc-500 hover:text-[#FF3B30] inline-flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> {lang === "tr" ? "Tümünü Kaldır" : "Clear all"}
            </button>
          )}
        </div>
        <p className="text-xs text-zinc-500 mb-3">
          {lang === "tr"
            ? "3'e kadar fotoğraf yükle. AI hepsinden ilham alarak (kişi, sahne, renkler) yeni bir thumbnail üretir."
            : "Upload up to 3 photos. AI will remix elements (subject, scene, palette) from ALL of them into one new thumbnail."}
        </p>
        <input
          ref={refFileInput}
          type="file"
          accept="image/*"
          multiple
          onChange={onUploadRef}
          className="hidden"
          data-testid="ai-ref-upload-input"
        />

        <div className="grid grid-cols-3 gap-2 mb-4">
          {refImages.map((src, i) => (
            <div key={i} className="aspect-video bg-black border border-zinc-800 rounded-sm overflow-hidden relative group" data-testid={`ai-ref-slot-${i}`}>
              <img src={src} alt={`ref-${i}`} className="w-full h-full object-cover" />
              <button
                onClick={() => removeRef(i)}
                data-testid={`ai-ref-remove-${i}`}
                className="absolute top-1 right-1 w-6 h-6 bg-black/70 hover:bg-[#FF3B30] rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ))}
          {refImages.length < 3 && (
            <button
              onClick={() => refFileInput.current?.click()}
              data-testid="ai-ref-upload-btn"
              className="aspect-video bg-zinc-950 border border-dashed border-zinc-800 rounded-sm text-zinc-500 hover:text-white hover:border-[#FF3B30] transition-colors flex flex-col items-center justify-center"
            >
              <Upload className="w-5 h-5 mb-1" />
              <span className="font-mono text-[10px]">+ {lang === "tr" ? "EKLE" : "ADD"}</span>
            </button>
          )}
        </div>

        <div className="font-mono text-xs text-zinc-500 mb-3">{t("aiPrompt").toUpperCase()}</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={lang === "tr" ? "Örn: dağın zirvesinde drone ile selfie çeken bir vlogger, gün batımı" : "e.g. a vlogger taking a drone selfie on a mountain peak at sunset"}
          rows={4}
          className="tk-input mb-4 resize-none"
          data-testid="ai-prompt-input"
        />

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="font-mono text-xs text-zinc-500 mb-2">{t("titleOverlay").toUpperCase()}</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={lang === "tr" ? "Opsiyonel" : "Optional"}
              className="tk-input"
              data-testid="ai-title-input"
            />
          </div>
          <div>
            <div className="font-mono text-xs text-zinc-500 mb-2">{t("style").toUpperCase()}</div>
            <div className="flex flex-wrap gap-1">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  data-testid={`style-${s.id}-btn`}
                  className={`px-3 py-1.5 text-xs font-mono rounded-sm border transition-colors ${
                    style === s.id ? "border-[#FF3B30] text-[#FF3B30] bg-[#FF3B30]/10" : "border-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >{lang === "tr" ? s.labelTr : s.labelEn}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <ChannelContextToggle value={useChannel} onChange={setUseChannel} testid="studio-channel-toggle" />
        </div>

        <button onClick={generate} disabled={loading} className="tk-btn-primary" data-testid="ai-generate-btn">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          {loading ? t("generating") : t("generate")}
        </button>

        <div className="mt-6 aspect-video bg-black border border-zinc-800 rounded-sm overflow-hidden flex items-center justify-center" data-testid="ai-preview">
          {loading ? (
            <div className="flex flex-col items-center text-zinc-500">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <span className="font-mono text-xs">{lang === "tr" ? "ÜRETİLİYOR..." : "GENERATING..."}</span>
            </div>
          ) : image ? (
            <img src={image} alt="thumbnail" className="w-full h-full object-cover" />
          ) : (
            <div className="text-zinc-700 flex flex-col items-center">
              <ImageIcon className="w-10 h-10 mb-2" />
              <span className="font-mono text-xs">16 : 9</span>
            </div>
          )}
        </div>

        {image && (
          <div className="flex gap-3 mt-4">
            <button onClick={downloadImg} className="tk-btn-primary" data-testid="ai-download-btn">
              <Download className="w-4 h-4" /> {t("download")}
            </button>
          </div>
        )}
      </div>

      <aside className="tk-card p-5">
        <div className="font-mono text-xs text-zinc-500 mb-4">{t("yourThumbnails").toUpperCase()}</div>
        {history.length === 0 ? (
          <div className="text-zinc-600 text-sm">{t("noData")}</div>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto scrollbar-thin pr-1" data-testid="ai-history-list">
            {history.map((h) => (
              <div key={h.id} className="aspect-video bg-black border border-zinc-800 rounded-sm overflow-hidden cursor-pointer hover:border-[#FF3B30] transition-colors" onClick={() => setImage(h.image)}>
                <img src={h.image} alt="" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function EditorPanel() {
  const { lang, t } = useLang();
  const canvasRef = useRef(null);
  const [bgImg, setBgImg] = useState(null);
  const [text, setText] = useState(lang === "tr" ? "BAŞLIK BURAYA" : "BIG BOLD TITLE");
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [textSize, setTextSize] = useState(110);
  const [textX, setTextX] = useState(50);
  const [textY, setTextY] = useState(70);
  const [bgColor, setBgColor] = useState("#18181B");
  const fileRef = useRef(null);
  const [saving, setSaving] = useState(false);

  // Re-draw whenever inputs change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (bgImg) {
      const r = canvas.width / canvas.height;
      const ir = bgImg.width / bgImg.height;
      let sw, sh, sx, sy;
      if (ir > r) {
        sh = bgImg.height;
        sw = bgImg.height * r;
        sx = (bgImg.width - sw) / 2;
        sy = 0;
      } else {
        sw = bgImg.width;
        sh = bgImg.width / r;
        sx = 0;
        sy = (bgImg.height - sh) / 2;
      }
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    }

    // text overlay with stroke
    ctx.font = `900 ${textSize}px "Cabinet Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const x = (textX / 100) * canvas.width;
    const y = (textY / 100) * canvas.height;
    ctx.lineWidth = Math.max(6, textSize / 14);
    ctx.strokeStyle = "#000000";
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = textColor;
    ctx.fillText(text, x, y);
  }, [bgImg, text, textColor, textSize, textX, textY, bgColor]);

  const onUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => setBgImg(img);
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  const download = () => {
    const url = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `tubekit-thumbnail-${Date.now()}.png`;
    a.click();
  };

  const save = async () => {
    setSaving(true);
    try {
      const url = canvasRef.current.toDataURL("image/png");
      await api.post("/thumbnail/save", { image_data: url, title: text, source: "editor" });
      toast.success(lang === "tr" ? "Kaydedildi" : "Saved");
    } catch (e) {
      toast.error(formatApiError(e.response?.data?.detail) || e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[280px_1fr] gap-4">
      <aside className="tk-card p-5 space-y-5">
        <div>
          <div className="font-mono text-xs text-zinc-500 mb-2">{t("uploadImage").toUpperCase()}</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" data-testid="editor-upload-input" />
          <button onClick={() => fileRef.current?.click()} className="tk-btn-secondary w-full justify-center" data-testid="editor-upload-btn">
            <Upload className="w-4 h-4" /> {lang === "tr" ? "Dosya Seç" : "Choose File"}
          </button>
          {bgImg && (
            <button
              onClick={() => setBgImg(null)}
              className="text-xs font-mono text-zinc-500 hover:text-[#FF3B30] mt-2 inline-flex items-center gap-1"
              data-testid="editor-clear-bg-btn"
            >
              <Trash2 className="w-3 h-3" /> {lang === "tr" ? "Görseli temizle" : "Clear image"}
            </button>
          )}
        </div>

        <div>
          <div className="font-mono text-xs text-zinc-500 mb-2">{t("addText").toUpperCase()}</div>
          <input value={text} onChange={(e) => setText(e.target.value)} className="tk-input" data-testid="editor-text-input" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-xs text-zinc-500 mb-2">SIZE</div>
            <input type="range" min="40" max="220" value={textSize} onChange={(e) => setTextSize(+e.target.value)} className="w-full accent-[#FF3B30]" data-testid="editor-size-range" />
          </div>
          <div>
            <div className="font-mono text-xs text-zinc-500 mb-2">COLOR</div>
            <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-full h-8 bg-transparent border border-zinc-800 rounded-sm" data-testid="editor-color-input" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-xs text-zinc-500 mb-2">POS X</div>
            <input type="range" min="0" max="100" value={textX} onChange={(e) => setTextX(+e.target.value)} className="w-full accent-[#FF3B30]" data-testid="editor-x-range" />
          </div>
          <div>
            <div className="font-mono text-xs text-zinc-500 mb-2">POS Y</div>
            <input type="range" min="0" max="100" value={textY} onChange={(e) => setTextY(+e.target.value)} className="w-full accent-[#FF3B30]" data-testid="editor-y-range" />
          </div>
        </div>

        <div>
          <div className="font-mono text-xs text-zinc-500 mb-2">BG COLOR</div>
          <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-full h-8 bg-transparent border border-zinc-800 rounded-sm" data-testid="editor-bg-color-input" />
        </div>
      </aside>

      <div>
        <div className="bg-black border border-zinc-800 rounded-sm overflow-hidden">
          <canvas ref={canvasRef} width={1280} height={720} className="w-full h-auto block" data-testid="editor-canvas" />
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={download} className="tk-btn-primary" data-testid="editor-download-btn">
            <Download className="w-4 h-4" /> {t("download")}
          </button>
          <button onClick={save} disabled={saving} className="tk-btn-secondary" data-testid="editor-save-btn">
            <Save className="w-4 h-4" /> {saving ? t("generating") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}
