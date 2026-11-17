"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const avatarPrefix = process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('https:')
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/avatars/`
  : null;

type PlayerAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  expandable?: boolean;
};

const sizes = {
  sm: "h-10 w-10 text-xs",
  md: "h-11 w-11 text-xs",
  lg: "h-14 w-14 text-base",
  xl: "h-20 w-20 text-xl",
};

export function PlayerAvatar({ name, avatarUrl, size = "md", expandable = false }: PlayerAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!expanded) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);
  const className = `${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 font-black text-white shadow-sm shadow-red-600/20`;

  if (avatarUrl && avatarUrl !== failedUrl && /^https?:\/\//i.test(avatarUrl)) {
    const thumbnail = (
      <span className={className}>
        <Image
          src={avatarUrl}
          alt={name}
          width={size === "sm" ? 40 : size === "xl" ? 80 : size === "lg" ? 56 : 44}
          height={size === "sm" ? 40 : size === "xl" ? 80 : size === "lg" ? 56 : 44}
          onError={() => { setExpanded(false); setFailedUrl(avatarUrl); }}
          unoptimized={!avatarPrefix || !avatarUrl.startsWith(avatarPrefix)}
          className="h-full w-full object-cover"
        />
      </span>
    );
    if (!expandable) return thumbnail;
    return <>
      <button ref={triggerRef} type="button" aria-label={`Ampliar foto de ${name}`} aria-haspopup="dialog" onClick={() => setExpanded(true)} className="shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500">
        {thumbnail}
      </button>
      <dialog ref={dialogRef} aria-label={`Foto de ${name}`} onClose={() => {
        setExpanded(false);
        if (triggerRef.current?.getClientRects().length) triggerRef.current.focus({ preventScroll: true });
      }} onClick={event => { if (event.target === event.currentTarget) dialogRef.current?.close(); }} className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none flex-col items-center justify-center gap-4 border-0 bg-black/90 p-4 text-white backdrop:bg-black/60 open:flex">
        <button type="button" aria-label="Fechar foto" onClick={() => dialogRef.current?.close()} className="min-h-11 self-end rounded-lg bg-white px-4 py-2 font-bold text-black focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Fechar</button>
        {expanded && <Image src={avatarUrl} alt={name} width={768} height={768} sizes="(max-width: 768px) 100vw, 768px" unoptimized={!avatarPrefix || !avatarUrl.startsWith(avatarPrefix)} onError={() => { setExpanded(false); setFailedUrl(avatarUrl); }} className="max-h-[70dvh] w-full max-w-3xl object-contain" />}
      </dialog>
    </>;
  }

  return <span className={className}>{getInitials(name)}</span>;
}

function getInitials(name: string) {
  return name
    .trim().split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
