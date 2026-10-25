"use client";

import { createContext, useContext, type MouseEvent } from "react";
import { PlayerAvatar } from "./PlayerAvatar";

export const PlayerNavigation = createContext<((id: string) => void) | null>(null);

export function PlayerIdentity({ playerId, name, avatarUrl, size = "sm", showAvatar = true, nameTag: Name = "span", className = "" }: {
  playerId?: string | null; name: string; avatarUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl"; showAvatar?: boolean;
  nameTag?: "h3" | "span"; className?: string;
}) {
  const open = useContext(PlayerNavigation);
  const content = <>{showAvatar && <PlayerAvatar name={name} avatarUrl={avatarUrl} size={size} />}<Name className="min-w-0 break-words text-sm font-bold">{name}</Name></>;
  const classes = `flex min-h-11 min-w-0 items-center gap-2.5 ${className}`;
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (!open || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault(); open(playerId!);
  }
  return playerId ? <a href={`/perfil/${encodeURIComponent(playerId)}`} onClick={navigate} aria-label={`Ver perfil de ${name}`} className={`${classes} rounded-sm hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-700 active:opacity-70`}>{content}</a> : <div className={classes}>{content}</div>;
}
