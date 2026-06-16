import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { formatApiError } from "@/lib/api";
import { Youtube, ArrowRight } from "lucide-react";

export default function Register() {
  const { register } = useAuth();
  const { lang, t } = useLang();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      await register(email, pwd, name);
      nav("/app");
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail) || e2.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[#09090B]">
      <div className="relative hidden lg:block overflow-hidden border-r border-zinc-800">
        <img
          src="https://images.unsplash.com/photo-1610716632061-f76783ec35c9?crop=entropy&cs=srgb&fm=jpg&w=900"
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 z-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-[#FF3B30] rounded-sm flex items-center justify-center">
              <Youtube className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-display text-xl text-white">TubeKit</span>
          </div>
          <div className="font-display text-4xl text-white leading-tight max-w-md">
            {lang === "tr" ? "İlk thumbnail'in 60 saniye uzakta." : "Your first thumbnail is 60 seconds away."}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <form onSubmit={submit} className="w-full max-w-sm" data-testid="register-form">
          <h1 className="font-display text-4xl mb-2">{t("register")}</h1>
          <p className="text-zinc-500 text-sm mb-8">
            {lang === "tr" ? "Hesabını oluştur ve başla." : "Create your account and get started."}
          </p>

          <label className="block text-xs font-mono text-zinc-500 mb-1.5">{t("name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="tk-input mb-4"
            data-testid="register-name-input"
          />

          <label className="block text-xs font-mono text-zinc-500 mb-1.5">{t("email")}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="tk-input mb-4"
            data-testid="register-email-input"
            required
          />

          <label className="block text-xs font-mono text-zinc-500 mb-1.5">{t("password")}</label>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            className="tk-input mb-4"
            data-testid="register-password-input"
            required
            minLength={6}
          />

          {err && (
            <div className="text-sm text-[#FF3B30] mb-4 font-mono" data-testid="register-error">
              {err}
            </div>
          )}

          <button
            type="submit"
            className="tk-btn-primary w-full justify-center"
            disabled={loading}
            data-testid="register-submit-btn"
          >
            {loading ? t("generating") : t("register")} <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-sm text-zinc-500 mt-6">
            {lang === "tr" ? "Zaten hesabın var mı? " : "Already have an account? "}
            <Link to="/login" className="text-[#FF3B30] hover:underline" data-testid="register-to-login-link">
              {t("login")}
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
