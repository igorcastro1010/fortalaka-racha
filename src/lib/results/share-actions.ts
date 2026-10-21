type NativeShare = (data: { text: string }) => Promise<void>;

export async function shareRoundText(text: string, nativeShare: NativeShare | null = typeof navigator !== "undefined" && navigator.share ? data => navigator.share(data) : null): Promise<"shared" | "cancelled" | "fallback"> {
  if (!nativeShare) return "fallback";
  try {
    await nativeShare({ text });
    return "shared";
  } catch (error) {
    // Cancelar o seletor do sistema não deve abrir outra janela nem apresentar erro.
    return error !== null && typeof error === "object" && "name" in error && error.name === "AbortError" ? "cancelled" : "fallback";
  }
}

export async function copyRoundShareText(text: string, clipboard: Pick<Clipboard, "writeText"> | null = typeof navigator !== "undefined" ? navigator.clipboard ?? null : null): Promise<void> {
  try {
    if (!clipboard) throw new Error("Clipboard indisponível");
    await clipboard.writeText(text);
  } catch {
    throw new Error("Não foi possível copiar automaticamente. Abra VER RESUMO e copie o texto.");
  }
}
