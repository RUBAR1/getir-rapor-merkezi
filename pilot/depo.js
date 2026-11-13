'use strict';

const warehouseColumns = [0, 1, 2, 5, 6];
const warehouseHeaders = [
  'Ad', 'Toplam Sipariş Sayısı', 'Toplam Sipariş SKU Sayısı',
  'THS Uyum Performansı', 'THS Puanı'
];
const monthsTR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz',
  'Ağustos','Eylül','Ekim','Kasım','Aralık'];

function previousIstanbulDay(now) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = key => Number(parts.find(part => part.type === key).value);
  const date = new Date(Date.UTC(value('year'), value('month') - 1, value('day') - 1));
  return date.toISOString().slice(0, 10).split('-').reverse().join('.');
}

function prepareWarehouse(rows, now = new Date()) {
  const nonempty = rows.map((cells, index) => ({cells, index}))
    .filter(({cells}) => cells.some(value => String(value ?? '').trim()));
  const headers = warehouseColumns.map(index => String(nonempty[0]?.cells[index] ?? ''));
  if (headers.some((header, index) => norm(header) !== norm(warehouseHeaders[index]))) {
    throw Error('Depo İçi Süre Excel sütunları beklenen yapıda değil. THS Puanı 7. sütunda olmalı.');
  }
  const records = nonempty.slice(1).map(({cells, index}) => {
    const data = warehouseColumns.map(column => String(cells[column] ?? '').trim());
    if (!data[0]) throw Error('Excel satır ' + (index + 1) + ': ad boş.');
    const raw = data[4].replace(',', '.');
    const score = raw === '' || raw === '-' ? null : Number(raw);
    if (score !== null && (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(raw) || !(score >= 0 && score <= 100))) {
      throw Error('Excel satır ' + (index + 1) + ': THS puanı 0–100 arasında olmalı.');
    }
    const category = score === null ? 'blue' : score >= 90 ? 'green' : score >= 80 ? 'yellow' : 'red';
    data[4] = score === null ? '-' : score.toFixed(1);
    return {category, score, data: data.map(cell => cell || '-')};
  });
  if (!records.length) throw Error('Excel’de rapora alınacak kayıt yok.');
  if (records.length > 18) throw Error('Onaylı Depo İçi Süre şablonu en fazla 18 kayıt alır.');
  records.sort((left, right) => (right.score ?? -1) - (left.score ?? -1));
  return {
    type: 'depo', headers, data: records.map(record => record.data),
    categories: records.map(record => record.category),
    date: previousIstanbulDay(now), source: records.length
  };
}

async function warehouseCanvas(report) {
  const image = new Image();
  image.src = './depo-template.png';
  await Promise.all([image.decode(), document.fonts.load('bold 24px Rapor')]);
  const canvas = document.createElement('canvas');
  canvas.width = 1448;
  canvas.height = 1086;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  const edges = [12, 375, 637, 920, 1188, 1435];
  const colors = {};
  for (const [name, x, y] of [['green',1200,215],['red',1200,545],['blue',1200,700],['yellow',750,837]]) {
    const [r,g,b] = ctx.getImageData(x,y,1,1).data;
    colors[name] = 'rgb(' + [r,g,b].join(',') + ')';
  }
  const rowHeight = 588 / report.data.length;
  report.data.forEach((row, index) => {
    const top = Math.round(195 + index * rowHeight);
    const bottom = Math.round(195 + (index + 1) * rowHeight);
    ctx.fillStyle = colors[report.categories[index]];
    ctx.fillRect(12, top, 1424, bottom - top);
  });
  ctx.fillStyle = '#fff';
  for (const edge of edges.slice(1, -1)) ctx.fillRect(edge, 195, 2, 589);
  for (let index = 1; index < report.data.length; index++) {
    ctx.fillRect(12, Math.round(195 + index * rowHeight), 1424, 1);
  }
  ctx.fillStyle = '#09040e';
  ctx.textBaseline = 'middle';
  report.data.forEach((row, index) => row.forEach((value, column) => {
    const width = edges[column + 1] - edges[column] - 24;
    let size = Math.min(24, Math.floor(rowHeight * .62));
    ctx.font = 'bold ' + size + 'px Rapor';
    while (size > 12 && ctx.measureText(value).width > width) {
      ctx.font = 'bold ' + --size + 'px Rapor';
    }
    if (ctx.measureText(value).width > width) throw Error('Rapor satır ' + (index + 1) + ': hücre metni sığmıyor.');
    ctx.fillText(value, edges[column] + 13, Math.round(195 + (index + .5) * rowHeight));
  }));
  const [day, month, year] = report.date.split('.');
  const dateText = Number(day) + ' ' + monthsTR[Number(month) - 1] + ' ' + year;
  ctx.font = 'bold 23px Rapor';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0e0606';
  ctx.fillText(dateText, 1136, 57, 176);
  return canvas;
}
