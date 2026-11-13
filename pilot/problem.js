'use strict';

const problemHeaders = ['Ad','Sipariş Sayısı','Eksik Ürün Oranı','Problemli Sipariş Oranı','Problemli Sipariş Sayısı'];
const problemColumns = [0,1,3,4,5];

function prepareProblem(rows, now = new Date()) {
  const header = rows.findIndex(row => problemColumns.every((col,index) =>
    norm(row[col]) === norm(problemHeaders[index])));
  if (header < 0) throw Error('Kurye Problemli Sipariş Excel başlıkları beklenen sütunlarda bulunamadı.');
  const records = rows.slice(header+1).filter(row => row.some(cell => String(cell ?? '').trim())).map((row,index) => {
    const data = problemColumns.map(col => String(row[col] ?? '').trim());
    if (!data[0] || !/^\d+(?:[.,]0+)?$/.test(data[4])) {
      throw Error('Excel satır ' + (header+index+2) + ': ad veya problemli sipariş sayısı geçersiz.');
    }
    return {data,count:Number(data[4].replace(',','.'))};
  });
  if (!records.length) throw Error('Excel’de rapora alınacak kayıt yok.');
  const byName = new Intl.Collator('tr',{sensitivity:'base'});
  records.sort((a,b) => b.count-a.count || byName.compare(a.data[0],b.data[0]));
  return {type:'problem',headers:problemHeaders,data:records.map(row=>row.data),
    source:records.length,date:previousIstanbulDay(now)};
}

async function problemCanvas(report) {
  await document.fonts.load('bold 21px Rapor');
  const canvas = document.createElement('canvas');
  const top = 201, rowHeight = 27, bottom = top+rowHeight*report.data.length;
  canvas.width = 1536;
  canvas.height = bottom+109;
  if (canvas.width * canvas.height > 16000000) throw Error('Kayıt sayısı tek görsel için telefonun boyut sınırını aşıyor.');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle='#2b006d';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  const edges = [12,408,625,897,1206,1527];
  const [day,month,year] = report.date.split('.');
  const banner = ctx.createLinearGradient(0,0,1536,0);
  banner.addColorStop(0,'#501099');
  banner.addColorStop(.5,'#2b006d');
  banner.addColorStop(1,'#6609a7');
  ctx.fillStyle=banner;
  ctx.fillRect(0,0,1536,144);
  ctx.fillStyle='#ffdc00';
  ctx.fillRect(12,137,1515,5);
  ctx.textBaseline='middle';
  ctx.font='bold 34px Rapor';
  ctx.fillText('getir',32,59);
  ctx.font='bold 20px Rapor';
  ctx.fillText('DAVUTPAŞA GB',34,99);
  ctx.textAlign='center';
  ctx.font='bold 36px Rapor';
  ctx.fillText('KURYE PROBLEMLİ SİPARİŞ',768,73,790);
  ctx.fillStyle='#ffdc00';
  ctx.beginPath();
  ctx.roundRect(1252,43,253,56,15);
  ctx.fill();
  ctx.font='bold 23px Rapor';
  ctx.fillStyle='#210d2d';
  ctx.fillText(Number(day)+' '+monthsTR[Number(month)-1]+' '+year,1378,72,225);
  ctx.fillStyle='#fff';
  ctx.font='bold 21px Rapor';
  problemHeaders.forEach((label,i)=>ctx.fillText(label.toLocaleUpperCase('tr'),
    (edges[i]+edges[i+1])/2,172,edges[i+1]-edges[i]-16));
  [['#baf2c2','0 = Problemli Sipariş Yok'],['#f4b6c6','1 ve Üzeri = Problemli Sipariş Var']]
    .forEach(([color,label],i)=>{
      const x=32+i*755;
      ctx.fillStyle=color;
      ctx.beginPath();
      ctx.roundRect(x,bottom+24,718,59,18);
      ctx.fill();
      ctx.fillStyle='#210d2d';
      ctx.font='bold 23px Rapor';
      ctx.fillText(label,x+359,bottom+54);
    });
  ctx.textAlign='left';
  report.data.forEach((row,index) => {
    const y=top+index*rowHeight;
    const zero=Number(row[4].replace(',','.'))===0;
    const colors=zero?['#baf2c2','#d0f7d5']:['#f4b6c6','#f8c6d1'];
    ctx.fillStyle=colors[index%2];
    ctx.fillRect(edges[0],y,edges.at(-1)-edges[0],rowHeight);
    ctx.fillStyle='#1c1120';
    ctx.font='bold 20px Rapor';
    row.forEach((value,column)=>ctx.fillText(value,edges[column]+9,y+rowHeight/2,edges[column+1]-edges[column]-18));
  });
  ctx.fillStyle='#fff';
  for(const edge of edges) ctx.fillRect(edge,top,2,bottom-top);
  return canvas;
}
