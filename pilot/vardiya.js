'use strict';

const shiftHeaders = ['Tarih', 'Saat', 'Kurye Adı', 'Yapılan İşlem', 'Plaka Bilgisi'];
const shiftAliases = [
  ['tarih','islemtarihi'], ['saat','saatbilgisi','islemsaati'],
  ['kuryeadi','kuryeadsoyad','kuryeadisoyadi'], ['yapilanislem','islem','statu','kurye statusu'],
  ['plakabilgisi','plaka']
];
const shiftColors = {musait:'#d3edff', mesgul:'#ffe9a2', logout:'#f5d1e4'};

function shiftTime(value) {
  const raw = String(value ?? '').trim();
  if (/^(?:0(?:\.\d+)?|\.\d+)$/.test(raw)) {
    const seconds = Math.min(86399, Math.round(Number(raw) * 86400));
    return [Math.floor(seconds / 3600),Math.floor(seconds / 60) % 60,seconds % 60]
      .map(number => String(number).padStart(2,'0')).join(':');
  }
  const match = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.\d+)?)?$/);
  if (!match) throw Error('Geçersiz vardiya saati: ' + raw);
  return match[1].padStart(2,'0') + ':' + match[2] + ':' + (match[3] ?? '00');
}

function shiftDate(value) {
  const raw = String(value ?? '').trim();
  const iso = /^\d{5}(?:\.0+)?$/.test(raw) ? excelDate(Number(raw)) : raw;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('.') : iso;
}

function prepareShift(rows, now = new Date()) {
  let columns;
  const header = rows.findIndex(row => {
    columns = shiftAliases.map(aliases => row.findIndex(cell => aliases.includes(norm(cell))));
    return columns.every(column => column >= 0);
  });
  if (header < 0) throw Error('Vardiya Excel başlıkları bulunamadı: ' + shiftHeaders.join(', '));
  const records = [];
  const earliest = new Map();
  const excluded = {login:0, repeated:0};
  const sourceRows = rows.slice(header + 1).filter(row => row.some(cell => String(cell ?? '').trim()));
  for (const row of sourceRows) {
    const data = columns.map(column => String(row[column] ?? '').trim());
    const status = norm(data[3]);
    if (status === 'login') {
      excluded.login++;
      continue;
    }
    if (status && !Object.hasOwn(shiftColors,status)) throw Error('Tanınmayan işlem: ' + data[3]);
    if (!data[2]) throw Error('Kurye adı boş.');
    data[0] = shiftDate(data[0]);
    data[1] = shiftTime(data[1]);
    const record = {data,status};
    records.push(record);
    if (status !== 'musait') continue;
    const key = data[2].toLocaleLowerCase('tr');
    const stamp = data[0].split('.').reverse().join('-') + 'T' + data[1];
    if (!earliest.has(key) || stamp < earliest.get(key).stamp) earliest.set(key,{record,stamp});
  }
  const kept = records.filter(record => record.status !== 'musait' ||
    earliest.get(record.data[2].toLocaleLowerCase('tr')).record === record);
  excluded.repeated = records.length - kept.length;
  if (!kept.length) throw Error('Rapora alınacak vardiya kaydı yok.');
  kept.sort((a,b) => a.data[2].localeCompare(b.data[2],'tr',{sensitivity:'base'}));
  return {type:'shift',headers:shiftHeaders,data:kept.map(record => record.data),
    date:previousIstanbulDay(now),source:sourceRows.length,excluded};
}

async function shiftCanvas(report) {
  const header = new Image();
  header.src = './vardiya-header.png';
  await Promise.all([header.decode(),document.fonts.load('bold 28px Rapor')]);
  const canvas = document.createElement('canvas');
  const width = 1750, top = 186, rowHeight = 24, left = 38, right = 1712;
  const bottom = top + report.data.length * rowHeight;
  canvas.width = width;
  canvas.height = bottom + 132;
  if (width * canvas.height > 16000000) throw Error('Bu kayıt sayısı tek görsel için telefonun boyut sınırını aşıyor.');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#3c0673';
  ctx.fillRect(0,0,width,canvas.height);
  ctx.drawImage(header,0,0,width,top);
  const [day,month,year] = report.date.split('.');
  ctx.font = 'bold 25px Rapor';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#26102a';
  ctx.fillText(Number(day) + ' ' + monthsTR[Number(month)-1].toLocaleUpperCase('tr') + ' ' + year,1365,70,211);
  ctx.textAlign = 'left';
  const edges = [38,75,285,470,1030,1356,1712];
  const counts = {musait:0,mesgul:0,logout:0};
  report.data.forEach((row,index) => {
    const y = top + index * rowHeight;
    const status = norm(row[3]);
    if (Object.hasOwn(counts,status)) counts[status]++;
    ctx.fillStyle = shiftColors[status] ?? '#fff';
    ctx.fillRect(left,y,right-left,rowHeight);
    ctx.fillStyle = '#21122b';
    [String(index+1),...row].forEach((value,column) => {
      ctx.font = 'bold 14px Rapor';
      const available = edges[column+1]-edges[column]-12;
      if (ctx.measureText(value).width > available) throw Error('Vardiya satır ' + (index+1) + ': hücre metni sığmıyor.');
      ctx.fillText(value,edges[column]+6,y+rowHeight/2);
    });
    ctx.fillStyle = '#39234d33';
    ctx.fillRect(left,y+rowHeight-1,right-left,1);
  });
  ctx.fillStyle = '#39234d33';
  for (const x of edges.slice(1,-1)) ctx.fillRect(x,top,1,bottom-top);
  [['TOPLAM KAYIT',report.data.length,'#ffdf00'],['MÜSAİT',counts.musait,shiftColors.musait],
    ['MEŞGUL',counts.mesgul,shiftColors.mesgul],['LOGOUT',counts.logout,shiftColors.logout]]
    .forEach(([label,count,color],index) => {
      const x = left + index * 420;
      ctx.beginPath();
      ctx.roundRect(x,bottom+10,412,88,10);
      ctx.fillStyle=color;
      ctx.fill();
      ctx.fillStyle='#36076a';
      ctx.font='bold 15px Rapor';
      ctx.fillText(label,x+14,bottom+29);
      ctx.font='bold 38px Rapor';
      ctx.fillText(String(count),x+14,bottom+67);
    });
  ctx.fillStyle='#ffdf00';
  ctx.font='bold 12px Rapor';
  ctx.fillText('Kaynak: yüklenen Excel • Login çıkarılan: '+report.excluded.login+
    ' • Tekrarlanan müsait çıkarılan: '+report.excluded.repeated,left,bottom+115);
  return canvas;
}
