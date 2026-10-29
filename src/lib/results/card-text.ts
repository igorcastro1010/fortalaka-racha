/** Quebra por palavras; sobrenomes sem espaços continuam cabendo e recebem reticências. */
export function wrapCardText(value: string, maxWidth: number, measure: (text: string) => number, maxLines = 2): string[] {
  if (maxWidth <= 0 || maxLines <= 0 || !value.trim()) return [];
  const lines: string[] = [];
  let line = '';
  for (const word of value.trim().split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) { line = candidate; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const char of word) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const last = [...visible[visible.length - 1]];
    while (last.length && measure(last.join('') + '…') > maxWidth) last.pop();
    visible[visible.length - 1] = measure('…') <= maxWidth ? last.join('') + '…' : '';
  }
  return visible;
}
