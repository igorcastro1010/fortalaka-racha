// Usa o sharp já fornecido pelo Next.js. Não modifica o escudo original.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const source = 'public/fortalaka-escudo.jpeg';
await mkdir('public/pwa', { recursive: true });
async function icon(size, ratio) {
  const side = Math.floor(size * ratio);
  const logo = await sharp(source).rotate().resize(side, side, { fit: 'contain' }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } })
    .composite([{ input: logo, gravity: 'centre' }]).removeAlpha().png().toBuffer();
}
for (const size of [192, 512]) {
  await writeFile(`public/pwa/icon-${size}.png`, await icon(size, 0.92));
  // Toda a imagem fica dentro do círculo central seguro de raio 40%.
  await writeFile(`public/pwa/maskable-${size}.png`, await icon(size, 0.56));
}
await writeFile('public/pwa/apple-touch-icon.png', await icon(180, 0.86));
const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => icon(size, 0.92)));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index]; header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4); header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8); header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile('src/app/favicon.ico', Buffer.concat([header, ...images]));
console.log('Ícones PWA, Apple e favicon gerados a partir do escudo oficial.');
