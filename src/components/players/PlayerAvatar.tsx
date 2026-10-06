import Image from "next/image";

type PlayerAvatarProps = {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
};

const sizes = {
  sm: "h-8 w-8 text-xs",
  md: "h-9 w-9 text-xs",
};

export function PlayerAvatar({ name, avatarUrl, size = "md" }: PlayerAvatarProps) {
  const className = `${sizes[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-red-600 font-black text-white shadow-sm shadow-red-600/20`;

  if (avatarUrl) {
    return (
      <span className={className}>
        <Image
          src={avatarUrl}
          alt={name}
          width={size === "sm" ? 32 : 36}
          height={size === "sm" ? 32 : 36}
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
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
