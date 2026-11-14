'use strict';
const ortakHeaders = ['sipariş tarihi','feedback tarihi','toplayıcı adı','kurye adı','feedback type','feedback açıklama','feedback ürün sayısı','şikayet item name','düşük yıldız siparişi','düşük yıldız tag title','düşük yıldız star rating','iptal sipariş','iptal sipariş tag title'];

function ortakDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  if (/^\d+(?:\.\d+)?$/.test(raw) && Number(raw) >= 1 && Number(raw) <= 100000) {
    return new Date(Math.round((Number(raw)-25569)*86400000)).toISOString().slice(0,19);
  }
  const text = raw.replace(/^(\d{2})\.(\d{2})\.(\d{4})/,'$3-$2-$1').replace(' ','T');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
  if (!match || !Number.isFinite(Date.parse(match[1]+'T'+(match[2]||'00:00:00')+'Z'))) throw Error('Excel tarih değeri okunamadı: '+raw);
  return match[1]+'T'+(match[2]||'00:00:00');
}

function prepareOrtak(rows) {
  const [header,...source] = rows.filter(row=>row.some(value=>String(value??'').trim()));
  const indexes = Array.from({length:header?.length??0},(_,i)=>i)
    .filter(i=>header.length!==16||![0,5,8].includes(i));
  if(indexes.length!==13||!indexes.every((i,j)=>norm(header[i])===norm(ortakHeaders[j]))) {
    throw Error('Sorunsuz Teslimat sayfasında beklenen 13 veya 16 sütun bulunamadı.');
  }
  let latest='';
  const data=source.map(row=>indexes.map(i=>String(row[i]??''))).filter(row=>row.some(v=>v.trim()));
  if(!data.length) throw Error('Excel’de rapora alınacak kayıt yok.');
  data.forEach(row=>{
    const order=ortakDate(row[0]);
    if(!order) throw Error('Sipariş tarihi boş olan kayıt var.');
    if(order>latest) latest=order;
    for(const j of [0,1]) {
      const date=j===0?order:ortakDate(row[j]);
      if(date) row[j]=date.slice(0,10).split('-').reverse().join('.')+'\n'+date.slice(11);
    }
  });
  const order=new Intl.Collator('tr',{sensitivity:'base'});
  data.sort((a,b)=>order.compare(a[3].trim(),b[3].trim()));
  return {type:'ortak',headers:ortakHeaders,data,source:data.length,date:latest.slice(0,10).split('-').reverse().join('.')};
}

function ortakWrap(ctx,value,width) {
  return value.replace(/\r/g,'').split('\n').flatMap(paragraph=>{
    const lines=[];
    let line='';
    for(const word of paragraph.split(' ')) {
      const candidate=line?line+' '+word:word;
      if(ctx.measureText(candidate).width<=width) {line=candidate;continue;}
      if(line) lines.push(line);
      line='';
      for(const character of word) {
        if(line&&ctx.measureText(line+character).width>width) {lines.push(line);line='';}
        line+=character;
      }
    }
    return [...lines,line];
  });
}

async function ortakCanvas(report) {
  const ref=await reportReference('ortak');
  await document.fonts.load('bold 26px Rapor');
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const W=4200,weights=[1.22,1.22,1.05,1.12,.56,1.70,.65,1.75,.63,.83,.68,.63,.76];
  const total=weights.reduce((a,b)=>a+b);
  const widths=weights.map(w=>Math.round(W*w/total));
  widths[12]+=W-widths.reduce((a,b)=>a+b);
  const edges=[0];
  widths.forEach(w=>edges.push(edges.at(-1)+w));
  ctx.font='bold 26px Rapor';
  const headers=report.headers.map((v,j)=>ortakWrap(ctx,v,widths[j]-18));
  const headerHeight=Math.max(90,Math.max(...headers.map(v=>v.length))*31+18);
  ctx.font='bold 23px Rapor';
  const body=report.data.map(row=>row.map((v,j)=>ortakWrap(ctx,v,widths[j]-18)));
  const heights=body.map(row=>Math.max(33,Math.max(...row.map(v=>v.length))*26+6));
  const height=315+headerHeight+heights.reduce((a,b)=>a+b,0)+65;
  const scale=Math.min(1,4096/W,4096/height,Math.sqrt(16000000/(W*height)));
  canvas.width=Math.floor(W*scale);
  canvas.height=Math.floor(height*scale);
  ctx.scale(canvas.width/W,canvas.height/height);
  ctx.textBaseline='top';
  ctx.drawImage(ref,0,0,W,315,0,0,W,315);
  const [day,month,year]=report.date.split('.');
  ctx.fillStyle='#23005b';
  ctx.font='bold 58px Rapor';
  ctx.textAlign='center';
  ctx.fillText(Number(day)+' '+monthsTR[Number(month)-1]+' '+year,3292,102,519);
  ctx.textAlign='left';
  function drawRow(lines,y,h,index) {
    lines.forEach((parts,j)=>{
      ctx.fillStyle=index<0?'#310079':j===2?(index%2?'#ffef9c':'#ffe77a'):
        j===3?(index%2?'#a4e5f8':'#80d8f3'):[5,7].includes(j)?'#f7a4b2':index%2?'#ded2f3':'#eee5ff';
      ctx.fillRect(edges[j],y,widths[j],h);
      ctx.strokeStyle=index<0?'#ab82ee':'#d4c4ec';
      ctx.strokeRect(edges[j],y,widths[j],h);
      ctx.fillStyle=index<0?'#fff':'#102b43';
      ctx.font=index<0?'bold 26px Rapor':'bold 23px Rapor';
      parts.forEach((line,k)=>ctx.fillText(line,edges[j]+8,y+(index<0?10+k*31:3+k*26),widths[j]-16));
    });
  }
  drawRow(headers,315,headerHeight,-1);
  let y=315+headerHeight;
  body.forEach((row,i)=>{drawRow(row,y,heights[i],i);y+=heights[i];});
  ctx.fillStyle='#28005d';
  ctx.fillRect(0,y,W,65);
  ctx.strokeStyle='#ffe500';
  ctx.lineWidth=4;
  ctx.strokeRect(2,y+2,W-4,61);
  ctx.fillStyle='#ffe500';
  ctx.font='bold 27px Rapor';
  ctx.fillText('TOPLAM '+body.length+' KAYIT  |  13 SÜTUN  |  KAYNAK: SORUNSUZ TESLİMAT',24,y+16);
  return canvas;
}
