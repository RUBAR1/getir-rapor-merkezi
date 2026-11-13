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
  const image = await reportReference('problem');
  const edges = [12,408,625,897,1206,1527];
  ctx.drawImage(image,0,0,1536,201,0,0,1536,201);
  ctx.drawImage(image,0,1013,1536,109,0,bottom,1536,109);
  const [day,month,year] = report.date.split('.');
  if (report.date !== '12.11.2026') {
    for (let y=43;y<70;y++) ctx.drawImage(image,1138,y,1,1,1140,y,202,1);
    ctx.textBaseline='middle';
    ctx.textAlign='center';
    ctx.font='bold 24px Rapor';
    ctx.fillStyle='#210d2d';
    ctx.fillText(Number(day)+' '+monthsTR[Number(month)-1]+' '+year,1242,56,198);
  }
  ctx.textBaseline='middle';
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

const reportReferences = {
  problem:{key:'getir-problem-reference-v1',width:1536,height:1122},
  star:{key:'getir-star-reference-v2',width:997,height:1578}
};

async function decodeReportReference(src, type) {
  const image = new Image();
  image.src = src;
  await image.decode();
  if (image.naturalWidth !== reportReferences[type].width || image.naturalHeight !== reportReferences[type].height) {
    throw Error('Bu rapor için onaylı referans PNG dosyasını seçin.');
  }
  return image;
}

async function reportReference(type) {
  const src = localStorage.getItem(reportReferences[type].key);
  if (!src) throw Error('Önce bu raporun onaylı referans PNG dosyasını seçin.');
  return decodeReportReference(src, type);
}

function setupReportReference(type) {
  const input = document.getElementById(type + 'Reference');
  const status = document.getElementById(type + 'ReferenceStatus');
  const picker = document.getElementById(type + 'ReferencePicker');
  const change = document.getElementById(type + 'ReferenceChange');
  function showSavedReference() {
    picker.hidden = true;
    change.hidden = false;
    status.textContent = 'Kayıtlı şablon otomatik kullanılıyor. Yalnızca Excel dosyasını seçin.';
  }
  change.onclick = () => {
    picker.hidden = false;
    change.hidden = true;
  };
  if (localStorage.getItem(reportReferences[type].key)) showSavedReference();
  input.onchange = async () => {
    if (!input.files[0]) return;
    try {
      const src = await new Promise((resolve,reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(input.files[0]);
      });
      await decodeReportReference(src, type);
      localStorage.setItem(reportReferences[type].key,src);
      clearPreview();
      input.value = '';
      showSavedReference();
    } catch (error) {
      status.textContent = error.message;
    }
  };
}
