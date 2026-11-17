// Leitura pública e comparação real da imagem original com a miniatura Next.
// node tests/avatar-optimization.test.mjs <URL Next> <URL pública do avatar>
import assert from 'node:assert/strict';
import sharp from 'sharp';
const base=new URL(process.argv[2]),source=new URL(process.argv[3]);
assert.equal(source.protocol,'https:');assert(source.pathname.startsWith('/storage/v1/object/public/avatars/'));
const original=await fetch(source);assert.equal(original.status,200);const input=Buffer.from(await original.arrayBuffer());
const url=new URL('/_next/image',base);url.searchParams.set('url',source.href);url.searchParams.set('w','96');url.searchParams.set('q','75');
const response=await fetch(url,{headers:{Accept:'image/webp'}});assert.equal(response.status,200,'Otimizador deve aceitar avatar público deste projeto');const output=Buffer.from(await response.arrayBuffer());
const a=await sharp(input).metadata(),b=await sharp(output).metadata();assert.equal(b.width,96);assert(output.length<input.length,'Miniatura não deve transferir o arquivo original inteiro');
console.log(JSON.stringify({originalBytes:input.length,originalSize:[a.width,a.height],thumbnailBytes:output.length,thumbnailSize:[b.width,b.height],contentType:response.headers.get('content-type')},null,2));
