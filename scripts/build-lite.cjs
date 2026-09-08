// Build a small overview atlas plus lossless full-resolution details. No runtime dependencies.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'model-drawings.js'),'utf8'),sandbox);
const model=sandbox.window.KIKUCHI_MODEL;
const target=path.join(root,'assets/lite');fs.mkdirSync(target,{recursive:true});
const tile=256,gap=2,stride=tile+gap*2,columns=4,rows=7;
const result={tile,atlasWidth:columns*stride,atlasHeight:rows*stride,sets:{}};
(async()=>{
 for(const [key,slug] of [['FCC','new-fcc'],['BCC','new-bcc'],['FCC_original','original-fcc'],['BCC_original','original-bcc']]){
  const folder=path.join(target,slug);fs.mkdirSync(folder,{recursive:true});
  const set={atlas:`assets/lite/${slug}/atlas.webp`,fallback:`assets/lite/${slug}/atlas.jpg`,faces:[]};
  const layers=[];let detailBytes=0;
  for(const [i,face] of model.faces.entries()){
   const input=path.join(root,face.images[key]),metadata=await sharp(input).metadata();
   const {data:small,info}=await sharp(input).resize({width:tile,height:tile,fit:'inside',kernel:'lanczos3'}).png().toBuffer({resolveWithObject:true});
   const x=(i%columns)*stride+gap,y=Math.floor(i/columns)*stride+gap;
   layers.push({input:small,left:x,top:y});
   const detail=`assets/lite/${slug}/face-${String(i).padStart(2,'0')}.webp`;
   await sharp(input).webp({lossless:true,effort:6}).toFile(path.join(root,detail));
   // Verify the full-resolution detail is lossless after decoding, including alpha.
   const before=await sharp(input).ensureAlpha().raw().toBuffer();
   const after=await sharp(path.join(root,detail)).ensureAlpha().raw().toBuffer();
   if(before.length!==after.length)throw new Error('Detail size mismatch: '+detail);
   for(let p=0;p<before.length;p+=4){
    if(before[p+3]!==after[p+3] || (before[p+3] && (before[p]!==after[p] || before[p+1]!==after[p+1] || before[p+2]!==after[p+2])))throw new Error('Detail pixels differ: '+detail);
   }
   detailBytes+=fs.statSync(path.join(root,detail)).size;
   set.faces.push({rect:[x,y,info.width,info.height],size:[metadata.width,metadata.height],detail,fallback:face.images[key]});
  }
  const atlas=await sharp({create:{width:result.atlasWidth,height:result.atlasHeight,channels:4,background:'#fff'}}).composite(layers).png().toBuffer();
  const options=key.endsWith('_original')?{lossless:true,effort:6}:{quality:96,effort:6,smartSubsample:true};
  await sharp(atlas).webp(options).toFile(path.join(root,set.atlas));
  await sharp(atlas).flatten({background:'#fff'}).jpeg({quality:94,chromaSubsampling:'4:4:4'}).toFile(path.join(root,set.fallback));
  set.atlasBytes=fs.statSync(path.join(root,set.atlas)).size;set.detailBytes=detailBytes;
  result.sets[key]=set;
  console.log(key,JSON.stringify({atlasBytes:set.atlasBytes,detailBytes,atlasPixelBytes:result.atlasWidth*result.atlasHeight*4}));
 }
 fs.writeFileSync(path.join(root,'model-lite.js'),'window.KIKUCHI_LITE = '+JSON.stringify(result)+';\n');
 console.log('Built four atlases and 104 lossless detail textures.');
})().catch(error=>{console.error(error);process.exitCode=1;});
