'use strict';

function preparePicker(sheets, now = new Date()) {
  const columns = [0,1,2,3,4,7];
  const matches = sheets.map(rows => ({rows, header:rows.slice(0,30).findIndex(row =>
    norm(row[0]) === 'ad' && norm(row[7]) === 'problemlisiparissayisi')}))
    .filter(sheet => sheet.header >= 0);
  if (matches.length !== 1) throw Error('Depocu Problemli Sipariş başlıklarını içeren tek bir sayfa bulunmalı.');
  const {rows,header} = matches[0];
  const headers = columns.map(index => String(rows[header][index] ?? ''));
  if (headers.some(value=>!value)) throw Error('Gerekli Excel sütun başlığı eksik.');
  const data = rows.slice(header+1).map(row => columns.map(index => String(row[index] ?? '')))
    .filter(row => row.some(cell=>cell.trim()));
  if (!data.length || data.length>15) throw Error('Onaylı Depocu Problemli Sipariş şablonu 1–15 kayıt alır.');
  for(const row of data) {
    if (!row[0].trim() || !/^\d+(?:\.0+)?$/.test(row[5])) throw Error('Ad veya Problemli Sipariş Sayısı geçersiz.');
    const ratio = Number(row[4]);
    if (row[4].trim() && Number.isFinite(ratio)) row[4]=(Math.abs(ratio)<=1?ratio*100:ratio).toFixed(1)+'%';
    for(const col of [1,2,3,5]) if (/^-?\d+\.0+$/.test(row[col])) row[col]=row[col].split('.')[0];
  }
  data.sort((a,b)=>Number(b[5])-Number(a[5]));
  return {type:'picker',headers,data,source:data.length,date:previousIstanbulDay(now)};
}

async function pickerCanvas(report) {
  const image = await reportReference('picker');
  await document.fonts.load('bold 24px Rapor');
  const canvas = document.createElement('canvas');
  canvas.width=1606;
  canvas.height=979;
  const ctx=canvas.getContext('2d');
  ctx.drawImage(image,0,0);
  const edges=[12,391,612,855,1122,1340,1593];
  ctx.fillStyle='#370778';
  ctx.fillRect(12,162,1582,530);
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.font='bold 21px Rapor';
  ctx.fillStyle='#fff';
  report.headers.forEach((header,index)=>{
    const width=edges[index+1]-edges[index]-20;
    const words=header.toLocaleUpperCase('tr').split(/\s+/);
    const lines=[];
    for(const word of words) {
      const last=lines.at(-1);
      if(last && ctx.measureText(last+' '+word).width<=width) lines[lines.length-1]+=' '+word;
      else lines.push(word);
    }
    const step=Math.min(31,80/lines.length);
    lines.forEach((line,j)=>ctx.fillText(line,(edges[index]+edges[index+1])/2,
      209+(j-(lines.length-1)/2)*step,width));
  });
  const height=435/report.data.length;
  report.data.forEach((row,index)=>{
    const top=Math.round(256+index*height),bottom=Math.round(256+(index+1)*height);
    const colors=Number(row[5])===0?['#b6f8c7','#c7fbd3']:['#f3afc8','#f8c3d6'];
    ctx.fillStyle=colors[index%2];
    ctx.fillRect(12,top,1582,bottom-top+1);
    ctx.fillStyle='#17101a';
    ctx.font='bold 24px Rapor';
    row.forEach((value,col)=>{
      ctx.textAlign=col?'center':'left';
      ctx.fillText(value,col?(edges[col]+edges[col+1])/2:edges[col]+12,
        (top+bottom)/2,edges[col+1]-edges[col]-20);
    });
    ctx.fillStyle='#fff';
    ctx.fillRect(12,top,1582,2);
  });
  for(const x of edges.slice(1,-1)) ctx.fillRect(x,162,2,530);
  if(report.date!=='02.11.2026') {
    for(let y=43;y<=85;y++) {
      const gradient=ctx.createLinearGradient(1146,0,1344,0);
      for(const [stop,x] of [[0,1141],[1,1349]]) {
        const [r,g,b]=ctx.getImageData(x,y,1,1).data;
        gradient.addColorStop(stop,'rgb('+[r,g,b].join(',')+')');
      }
      ctx.fillStyle=gradient;
      ctx.fillRect(1146,y,199,1);
    }
    const [day,month,year]=report.date.split('.');
    ctx.textAlign='center';
    ctx.font='bold 27px Rapor';
    ctx.fillStyle='#16051c';
    ctx.fillText(Number(day)+' '+monthsTR[Number(month)-1]+' '+year,1245,64,178);
  }
  return canvas;
}
