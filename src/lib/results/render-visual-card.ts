import type { VisualCard } from './visual-card';

async function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timer = window.setTimeout(() => { img.onload = null; img.onerror = null; resolve(null); }, 3000);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

/** PNG nativo: não captura HTML, não carrega fontes ou serviços externos. */
export async function renderVisualCard(card: VisualCard): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Seu navegador não conseguiu criar a imagem.');
  const rows = card.rows.slice(0, 5);
  const [shield, ...avatars] = await Promise.all([loadImage('/fortalaka-escudo.jpeg'), ...rows.map(row => row.avatarUrl ? loadImage(row.avatarUrl) : Promise.resolve(null))]);
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, 1080, 1920);
  ctx.fillStyle = '#c8202b'; ctx.fillRect(0, 0, 22, 1920); ctx.fillRect(72, 490, 100, 9);
  ctx.fillStyle = '#161616'; ctx.beginPath();ctx.moveTo(720,0);ctx.lineTo(1080,0);ctx.lineTo(1080,700);ctx.closePath();ctx.fill();
  if (shield) ctx.drawImage(shield, 72, 68, 128, 128);
  ctx.font = '900 52px Arial'; ctx.fillStyle = '#ffffff'; ctx.fillText('FORTALAKA', shield ? 225 : 72, 144);
  ctx.font = 'bold 24px Arial'; ctx.fillStyle = '#b6b6be'; ctx.fillText('FUTEBOL ENTRE AMIGOS', shield ? 225 : 72, 180);
  const text = (value: string, x: number, y: number, maxWidth: number, size: number, maxLines = 2) => {
    ctx.font = `900 ${size}px Arial`;
    const chars = [...value.replace(/\s+/g, ' ').trim()];
    const lines: string[] = []; let line = '';
    for (const char of chars) {
      if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line.trim()); line = ''; }
      line += char;
    }
    if (line) lines.push(line.trim());
    for (let i = 0; i < Math.min(maxLines, lines.length); i++) {
      let part = lines[i];
      if (i === maxLines - 1 && lines.length > maxLines) { while (ctx.measureText(part + '…').width > maxWidth) part = part.slice(0, -1); part += '…'; }
      ctx.fillText(part, x, y + i * (size + 10));
    }
  };
  ctx.fillStyle = '#ffffff'; text(card.title, 72, 315, 936, 64);
  ctx.font = 'bold 30px Arial'; ctx.fillStyle = '#b6b6be'; ctx.fillText(card.subtitle, 72, 454, 936);
  let top = 555;
  if (card.facts.length) {
    for (const [i, fact] of card.facts.slice(0, 3).entries()) {
      const x = 72 + i * 318;
      ctx.fillStyle = '#ffffff'; ctx.font = '900 76px Arial'; ctx.fillText(fact.value, x, 635, 280);
      ctx.fillStyle = '#b6b6be'; ctx.font = 'bold 26px Arial'; ctx.fillText(fact.label, x, 683, 280);
    }
    top = 765;
  }
  for (const [i, row] of rows.entries()) {
    const y = top + i * 176;
    ctx.fillStyle = '#222222'; ctx.fillRect(72, y + 145, 936, 2);
    ctx.fillStyle = '#c8202b'; ctx.font = '900 32px Arial'; ctx.fillText(`${row.place ?? i + 1}º`, 72, y + 62);
    const image = avatars[i];
    ctx.save(); ctx.beginPath(); ctx.arc(184, y + 58, 39, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#333333'; ctx.fillRect(145, y + 19, 78, 78);
    if (image) ctx.drawImage(image, 145, y + 19, 78, 78);
    else { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px Arial'; ctx.textAlign = 'center'; ctx.fillText(row.name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase(), 184, y + 68); }
    ctx.restore(); ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff'; text(row.name, 249, y + 46, 505, 32);
    ctx.font = '900 52px Arial'; ctx.textAlign = 'right'; ctx.fillText(row.value, 1008, y + 55, 220);
    ctx.font = 'bold 24px Arial'; ctx.fillStyle = '#b6b6be'; ctx.fillText(row.label, 1008, y + 101, 240); ctx.textAlign = 'left';
  }
  if (!rows.length) { ctx.font = 'bold 30px Arial'; ctx.fillStyle = '#b6b6be'; ctx.fillText('Sem eventos registrados para este card.', 72, top + 90, 936); }
  ctx.fillStyle = '#c8202b'; ctx.fillRect(72, 1785, 936, 3);
  ctx.fillStyle = '#ffffff'; ctx.font = '900 30px Arial'; ctx.fillText('DENTRO DE CAMPO. ENTRE AMIGOS.', 72, 1850);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível salvar a imagem.')), 'image/png'));
}
