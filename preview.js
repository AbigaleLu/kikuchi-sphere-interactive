/* Shared reading orientation for both rendering modes; sphere UVs stay unchanged. */
window.drawKikuchiPreview = (canvas, size, direction, draw) => {
  const ctx=canvas.getContext('2d'),[w,h]=size;
  const angle=-Math.atan2(direction[1],direction[0]);
  const c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const scale=Math.min(canvas.width/(w*c+h*s),canvas.height/(w*s+h*c));
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save();ctx.translate(canvas.width/2,canvas.height/2);
  ctx.rotate(angle);ctx.scale(scale,scale);ctx.translate(-w/2,-h/2);
  draw(ctx);ctx.restore();
};
