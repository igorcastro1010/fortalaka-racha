import Image from "next/image";

export function LogoMark({
  size,
  priority = false,
}: {
  size: "login" | "header" | "card" | "profile" | "loading";
  priority?: boolean;
}) {
  const sizes = {
    login: "h-36 w-36 rounded-full shadow-xl shadow-black/30",
    header: "h-12 w-12 rounded-[18px] p-1.5 shadow-sm",
    card: "h-14 w-14 rounded-[18px] p-1.5",
    profile: "h-20 w-20 rounded-[24px] p-2",
    loading: "h-24 w-24 rounded-full shadow-xl shadow-black/30",
  };

  return (
    <div className={`relative shrink-0 overflow-hidden bg-white ring-1 ring-black/10 ${sizes[size]}`}>
      <Image
        src="/fortalaka-escudo.jpeg"
        alt="Escudo oficial Fortalaka"
        fill
        priority={priority}
        sizes={size === "login" ? "144px" : size === "profile" ? "80px" : size === "loading" ? "96px" : "56px"}
        className={size === "login" || size === "loading" || size === "header" ? "object-cover" : "object-contain p-[5px]"}
      />
    </div>
  );
}
