"use client";

import Image from "next/image";
import { useState } from "react";

type PlayerAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
};

const sizes = {
  sm: "h-10 w-10 text-xs",
  md: "h-11 w-11 text-xs",
};

export function PlayerAvatar({ name, avatarUrl, size = "md" }: PlayerAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const className = `${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 font-black text-white shadow-sm shadow-red-600/20`;

  if (avatarUrl && avatarUrl !== failedUrl && /^https?:\/\//i.test(avatarUrl)) {
    return (
      <span className={className}>
        <Image
          src={avatarUrl}
          alt={name}
          width={size === "sm" ? 40 : 44}
          height={size === "sm" ? 40 : 44}
          onError={() => setFailedUrl(avatarUrl)}
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
    );
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
