import { useEffect, useState } from "react";
import { Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import api from "@/lib/api";
import { useLang } from "@/contexts/LanguageContext";

export default function ChannelContextToggle({ value, onChange, testid = "channel-context-toggle" }) {
  const { lang } = useLang();
  const [hasProfile, setHasProfile] = useState(null);

  useEffect(() => {
    api.get("/profile/channel")
      .then((r) => setHasProfile(!!(r.data.description || r.data.url)))
      .catch(() => setHasProfile(false));
  }, []);

  const disabled = hasProfile === false;

  return (
    <label
      className={`flex items-start gap-3 p-3 border rounded-sm transition-colors cursor-pointer ${
        value && !disabled
          ? "border-[#FF3B30] bg-[#FF3B30]/5"
          : "border-zinc-800 hover:border-zinc-700"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      data-testid={testid}
    >
      <input
        type="checkbox"
        checked={!!value && !disabled}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 accent-[#FF3B30]"
        data-testid={`${testid}-input`}
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 text-sm">
          <Youtube className="w-4 h-4 text-[#FF3B30]" />
          <span className="font-medium">{lang === "tr" ? "Kanalıma özel" : "For my channel"}</span>
        </div>
        <div className="text-xs text-zinc-500 mt-1">
          {disabled ? (
            <>
              {lang === "tr" ? "Önce " : "First "}
              <Link to="/app" className="text-[#FF3B30] hover:underline">
                {lang === "tr" ? "Pano'da kanal profilini doldur" : "fill your channel profile on the Dashboard"}
              </Link>
              .
            </>
          ) : (
            lang === "tr"
              ? "Sonuçlar kanalının tonuna ve içeriğine göre özelleştirilir."
              : "Outputs will be tailored to your channel's tone and content."
          )}
        </div>
      </div>
    </label>
  );
}
