import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import "@/App.css";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Dashboard from "@/pages/Dashboard";
import ThumbnailStudio from "@/pages/ThumbnailStudio";
import SEOWriter from "@/pages/SEOWriter";
import IdeaGenerator from "@/pages/IdeaGenerator";
import Layout from "@/components/Layout";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#09090B] text-zinc-500 font-mono text-xs">
        LOADING...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RedirectIfAuthed({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/app" replace />;
  return children;
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster theme="dark" position="top-right" toastOptions={{ style: { background: "#18181B", border: "1px solid #27272A", color: "#FAFAFA" } }} />
          <Routes>
            <Route path="/" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
            <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
            <Route path="/register" element={<RedirectIfAuthed><Register /></RedirectIfAuthed>} />
            <Route path="/app" element={<Protected><Dashboard /></Protected>} />
            <Route path="/app/studio" element={<Protected><ThumbnailStudio /></Protected>} />
            <Route path="/app/seo" element={<Protected><SEOWriter /></Protected>} />
            <Route path="/app/ideas" element={<Protected><IdeaGenerator /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}
