"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/client";
import { PlayerAvatar } from "./PlayerAvatar";

export function ProfilePhoto({ profile }: { profile: Profile }) {
  const [url, setUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    Promise.resolve(createClient().from("profiles").select("avatar_url").eq("id", profile.id).single())
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError("Não foi possível carregar sua foto.");
        else setUrl(data?.avatar_url ?? null);
      }).catch(() => { if (active) setError("Não foi possível carregar sua foto."); });
    return () => { active = false; };
  }, [profile.id]);

  async function upload(file: File) {
    setMessage(""); setError("");
    const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    if (!extensions[file.type] || file.size > 2097152) { setError("Escolha uma foto PNG, JPEG ou WebP de até 2 MB."); return; }
    setBusy(true);
    const client = createClient();
    const path = `${profile.id}/${crypto.randomUUID()}.${extensions[file.type]}`;
    let uploaded = false;
    try {
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || user?.id !== profile.id) throw new Error("Entre novamente para alterar sua foto.");
      const result = await client.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
      if (result.error) throw new Error("Não foi possível enviar a foto. Confira o bucket avatars e suas policies.");
      uploaded = true;
      const { data: { publicUrl } } = client.storage.from("avatars").getPublicUrl(path);
      const resultProfile = await client.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id).select("avatar_url").single();
      if (resultProfile.error) throw new Error("Não foi possível salvar a URL da foto no perfil.");
      setUrl(resultProfile.data.avatar_url); setMessage("Foto salva. Ela aparecerá na rodada e nos times.");
    } catch (e) {
      if (uploaded) {
        try { await client.storage.from("avatars").remove([path]); } catch { /* Preserve o erro original do salvamento. */ }
      }
      setError(e instanceof Error ? e.message : "Não foi possível salvar sua foto.");
    } finally { setBusy(false); }
  }

  return <section className="rounded-[22px] bg-white p-4 ring-1 ring-black/5">
    <div className="flex items-center gap-3"><PlayerAvatar name={profile.name} avatarUrl={url} /><h3 className="text-lg font-black">Sua foto</h3></div>
    <label className="mt-3 block text-sm font-bold">Alterar foto
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} className="mt-2 block w-full text-xs"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} />
    </label>
    <p className="mt-2 text-xs text-zinc-600">PNG, JPEG ou WebP, até 2 MB.</p>
    {busy && <p role="status" className="mt-2 text-sm">Salvando foto...</p>}
    {error && <p role="alert" className="mt-2 text-sm font-bold text-red-700">{error}</p>}
    {message && <p role="status" className="mt-2 text-sm font-bold">{message}</p>}
  </section>;
}
