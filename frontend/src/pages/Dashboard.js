import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImagePlus, FileText, Lightbulb, ArrowRight, Image as ImageIcon } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import ChannelProfileCard from "@/components/ChannelProfileCard";

export default function Dashboard() {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const cards = [
    { to: "/app/studio", icon: ImagePlus, t: t("thumbnailStudio"), d: lang === "tr" ? "AI ile thumbnail üret veya editle" : "Generate or edit a thumbnail with AI", testid: "quick-studio" },
    { to: "/app/seo", icon: FileText, t: t("seoWriter"), d: lang === "tr" ? "Başlık, açıklama ve hashtag üret" : "Generate titles, descriptions, hashtags", testid: "quick-seo" },
    { to: "/app/ideas", icon: Lightbulb, t: t("ideaGen"), d: lang === "tr" ? "Nişine uygun video fikirleri" : "Video ideas tailored to your niche", testid: "quick-ideas" },
  ];

  return (
    <div className="p-4 sm:p-8 md:p-12 max-w-7xl fade-up" data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
        <div>
          <div className="font-mono text-xs text-zinc-500 mb-2">{t("welcome").toUpperCase()}</div>
          <h1 className="font-display text-4xl sm:text-5xl break-words">{user?.name || user?.email}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatCard label={t("statsThumbs")} value={stats?.thumbnails ?? 0} testid="stat-thumbnails" />
        <StatCard label={t("statsSEO")} value={stats?.seo_drafts ?? 0} testid="stat-seo" />
        <StatCard label={t("statsIdeas")} value={stats?.idea_sessions ?? 0} testid="stat-ideas" />
      </div>

      <ChannelProfileCard />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
        {cards.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            data-testid={c.testid}
            className="tk-card p-6 group hover:border-[#FF3B30] transition-colors"
          >
            <c.icon className="w-7 h-7 text-[#FF3B30] mb-4" />
            <div className="font-display text-2xl mb-1">{c.t}</div>
            <p className="text-zinc-500 text-sm mb-4">{c.d}</p>
            <div className="text-xs font-mono text-zinc-400 inline-flex items-center gap-1 group-hover:text-[#FF3B30] transition-colors">
              {lang === "tr" ? "AÇ" : "OPEN"} <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="tk-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-display text-xl">{t("yourThumbnails")}</div>
            <Link to="/app/studio" className="text-xs font-mono text-zinc-500 hover:text-white">+ NEW</Link>
          </div>
          {!stats?.recent_thumbnails?.length ? (
            <EmptyHint />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {stats.recent_thumbnails.map((th) => (
                <div key={th.id} className="aspect-video bg-black border border-zinc-800 rounded-sm overflow-hidden">
                  <img src={th.image} alt={th.title} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tk-card p-6">
          <div className="font-display text-xl mb-4">{t("recentActivity")}</div>
          {!stats?.recent_history?.length ? (
            <EmptyHint />
          ) : (
            <ul className="space-y-2">
              {stats.recent_history.map((h) => (
                <li key={h.id} className="flex items-center justify-between text-sm border-b border-zinc-800 pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    {h.type === "seo" ? <FileText className="w-4 h-4 text-zinc-500" /> : <Lightbulb className="w-4 h-4 text-zinc-500" />}
                    <span className="truncate max-w-xs">{h.topic}</span>
                  </div>
                  <span className="font-mono text-xs text-zinc-600">{(h.type || "").toUpperCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, testid }) {
  return (
    <div className="tk-card p-6" data-testid={testid}>
      <div className="font-mono text-xs text-zinc-500 mb-2">{label.toUpperCase()}</div>
      <div className="font-display text-5xl">{value}</div>
    </div>
  );
}

function EmptyHint() {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center py-10 text-zinc-600">
      <ImageIcon className="w-8 h-8 mb-2" />
      <div className="text-sm">{t("noData")}</div>
    </div>
  );
}
