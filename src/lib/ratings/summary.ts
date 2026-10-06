export const attributes = [
  { key: "passe", label: "Passe" },
  { key: "chute", label: "Chute" },
  { key: "velocidade", label: "Velocidade" },
  { key: "defesa", label: "Defesa" },
  { key: "fisico", label: "Físico" },
] as const;

export type RatingSummary = {
  quantidade: number;
  passe: number | null;
  chute: number | null;
  velocidade: number | null;
  defesa: number | null;
  fisico: number | null;
};

export function overallRating(summary: RatingSummary): number | null {
  const values = attributes.map(({ key }) => summary[key]);
  if (!summary.quantidade || values.some((v) => v === null || !Number.isFinite(v))) return null;
  return Math.round(values.reduce<number>((sum, value) => sum + (value ?? 0), 0) / attributes.length * 10);
}

export function radarVertex(index: number, radius: number): [number, number] {
  const angle = index * 2 * Math.PI / attributes.length - Math.PI / 2;
  return [120 + Math.cos(angle) * radius, 100 + Math.sin(angle) * radius];
}

export function radarGrid(radius: number): string {
  return attributes.map((_, index) => radarVertex(index, radius).join(",")).join(" ");
}

export function radarPoints(summary: RatingSummary): string {
  return attributes.map(({ key }, index) => {
    const radius = Math.max(0, Math.min(10, summary[key] ?? 0)) / 10 * 64;
    return radarVertex(index, radius).join(",");
  }).join(" ");
}
