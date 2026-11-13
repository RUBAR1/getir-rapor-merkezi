'use strict';

const starHeaders = ['Ad','Sipariş Sayısı','Yıldız Puanı Ortalaması'];

function prepareStar(rows, now = new Date()) {
  const data = rows.filter(row => row.some(value => String(value ?? '').trim()));
  if (!starHeaders.every((header,index) => data[0]?.[index] === header)) {
    throw Error('İlk üç Excel başlığı Ad, Sipariş Sayısı ve Yıldız Puanı Ortalaması olmalı.');
  }
  const entries = data.slice(1).map((row,index) => {
    const cells = starHeaders.map((_,col) => String(row[col] ?? ''));
    const raw = cells[2].trim().replace(',','.');
    const score = raw === '' || raw === '-' ? null : Number(raw);
    if (!cells[0].trim() || !/^\d+(?:[.,]0+)?$/.test(cells[1].trim()) ||
        (score !== null && (!/^\d+(?:\.\d+)?$/.test(raw) || !(score >= 0 && score <= 5)))) {
      throw Error('Excel satır ' + (index+2) + ': ad, sipariş sayısı veya puan geçersiz.');
    }
    return {cells,score};
  });
  if (!entries.length) throw Error('Excel’de kurye kaydı yok.');
  entries.sort((a,b) => (b.score ?? -1) - (a.score ?? -1));
  return {type:'star',headers:starHeaders,data:entries.map(row=>row.cells),
    green:entries.filter(row=>row.score===5).length,date:previousIstanbulDay(now)};
}

async function starCanvas(report) {
  const image = await reportReference('star');
  await document.fonts.load('bold 29px Rapor');
  const canvas = document.createElement('canvas');
  const count = report.data.length;
  const extra = Math.max(0,count*33-991);
  const bottom = 1233+extra;
  canvas.width = 997;
  canvas.height = 1578+extra;
  if (canvas.width*canvas.height > 16000000) throw Error('Kayıt sayısı tek görsel için telefonun boyut sınırını aşıyor.');
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image,0,0,997,1233,0,0,997,1233);
  if (extra) ctx.drawImage(image,0,1200,997,1,0,1233,997,extra);
  ctx.drawImage(image,0,1233,997,345,0,bottom,997,345);
  ctx.textBaseline='middle';
  if (report.date !== '06.11.2026') {
    const [day,month,year]=report.date.split('.');
    const patch=ctx.getImageData(565,30,200,34);
    const {data}=patch;
    for(let y=0;y<34;y++) {
      const dark=x=>data[(y*200+x)*4]<180 && data[(y*200+x)*4+1]<160;
      const mask=Array.from({length:200},(_,x)=>[x-1,x,x+1].some(j=>j>=0&&j<200&&dark(j)));
      for(let x=1;x<199;x++) {
        if (!mask[x]) continue;
        let left=x-1,right=x+1;
        while(left>0&&mask[left]) left--;
        while(right<199&&mask[right]) right++;
        for(let channel=0;channel<3;channel++) {
          data[(y*200+x)*4+channel]=Math.round(
            (data[(y*200+left)*4+channel]*(right-x)+data[(y*200+right)*4+channel]*(x-left))/(right-left));
        }
      }
    }
    ctx.putImageData(patch,565,30);
    ctx.font='bold 24px Rapor';
    ctx.fillStyle='#2d075b';
    ctx.textAlign='center';
    ctx.fillText(Number(day)+' '+monthsTR[Number(month)-1].toLocaleUpperCase('tr')+' '+year,665,47,180);
  }
  const rowGradients = [260,940].map(y=>{
    const gradient=ctx.createLinearGradient(25,0,971,0);
    for(const [stop,x] of [[0,35],[1,960]]) {
      const [r,g,b]=ctx.getImageData(x,y,1,1).data;
      gradient.addColorStop(stop,'rgb('+[r,g,b].join(',')+')');
    }
    return gradient;
  });
  const cols=[25,466,713,971];
  report.data.forEach((row,index)=>{
    const y=242+Math.round(index*(bottom-242)/count);
    const next=242+Math.round((index+1)*(bottom-242)/count);
    const good=Number(row[2].trim().replace(',','.'))===5;
    ctx.fillStyle=rowGradients[good?0:1];
    ctx.fillRect(25,y,946,next-y);
    ctx.fillStyle='#101010';
    ctx.font='bold '+Math.min(29,next-y-6)+'px Rapor';
    row.forEach((value,j)=>{
      ctx.textAlign=j?'center':'left';
      ctx.fillText(value,j?(cols[j]+cols[j+1])/2:cols[j]+15,(y+next)/2,cols[j+1]-cols[j]-20);
    });
    ctx.fillStyle='#fff';
    ctx.fillRect(25,y,946,2);
  });
  for(const x of cols.slice(1,-1)) ctx.fillRect(x,242,2,bottom-242);
  for(let y=1425+extra;y<1488+extra;y++) {
    const gradient=ctx.createLinearGradient(35,0,965,0);
    for(const [stop,x] of [[0,20],[1,976]]) {
      const [r,g,b]=ctx.getImageData(x,y,1,1).data;
      gradient.addColorStop(stop,'rgb('+[r,g,b].join(',')+')');
    }
    ctx.fillStyle=gradient;
    ctx.fillRect(35,y,930,1);
  }
  const parts=['TOPLAM KURYE: ',String(count),'  |  ÇOK İYİ: ',String(report.green),'  |  KÖTÜ: ',String(count-report.green)];
  let size=35;
  const measure=()=>parts.reduce((sum,part)=>sum+ctx.measureText(part).width,0);
  ctx.font='bold '+size+'px Rapor';
  while(measure()>922) ctx.font='bold '+--size+'px Rapor';
  let x=(997-measure())/2;
  ctx.textAlign='left';
  parts.forEach((part,i)=>{
    ctx.fillStyle=i%2?'#ffe000':'#fff';
    ctx.fillText(part,x,1456.5+extra);
    x+=ctx.measureText(part).width;
  });
  const output=document.createElement('canvas');
  output.width=canvas.width*3;
  output.height=canvas.height*3;
  if (output.width*output.height > 16000000) return canvas;
  output.getContext('2d').drawImage(canvas,0,0,output.width,output.height);
  return output;
}
