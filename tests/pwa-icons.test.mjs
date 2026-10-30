import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
for (const [file, size, maskable] of [
  ['icon-192.png',192,false], ['icon-512.png',512,false],
  ['maskable-192.png',192,true], ['maskable-512.png',512,true], ['apple-touch-icon.png',180,false],
]) {
  const path = 'public/pwa/' + file;
  const meta = await sharp(path).metadata();
  assert.equal(meta.width,size); assert.equal(meta.height,size); assert.equal(meta.format,'png');
  assert.equal(meta.hasAlpha,false,'Ícones opacos para splash/Apple');
  const { data, info } = await sharp(path).raw().toBuffer({resolveWithObject:true});
  let darkPixels=0;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++) {
    const i=(y*size+x)*info.channels; const dark=data[i]<245||data[i+1]<245||data[i+2]<245;
    if(dark)darkPixels++;
    if(maskable && Math.hypot(x-(size-1)/2,y-(size-1)/2)>size*.4)assert(!dark,'Escudo fora da área segura maskable');
  }
  assert(darkPixels>size*size*.05,'Escudo visível e não vazio');
}
const favicon=readFileSync('src/app/favicon.ico');assert.equal(favicon.readUInt16LE(2),1);assert.equal(favicon.readUInt16LE(4),3);
console.log('OK: cinco PNGs, tamanhos, opacidade, escudo visível, safe circle maskable e favicon ICO.');
