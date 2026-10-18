// 照片處理：一律重新編碼成 JPEG
// - 長邊縮到 2048px，手機看夠清楚，一張約 300–600KB
// - 另存 480px 縮圖給時間軸用，捲動才不會卡
// - 重新編碼會順便去掉 EXIF（包含 GPS 位置），分享備份檔也不會洩漏
// - iPhone 選相簿時會自動把 HEIC 轉成 JPEG 給網頁

const FULL_MAX = 2048;
const THUMB_MAX = 480;

function loadImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('讀不到這張照片，請換一張試試')); };
    img.src = url;
  });
}

// 瀏覽器會依 EXIF 方向自動轉正 <img>，畫到 canvas 時也會沿用
function toJpeg(img, max, quality) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // 透明 PNG 轉 JPEG 時避免變黑底
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve({ blob, w, h }) : reject(new Error('照片轉檔失敗'))), 'image/jpeg', quality);
  });
}

export async function processPhoto(file) {
  const img = await loadImage(file);
  const full = await toJpeg(img, FULL_MAX, 0.85);
  const thumb = await toJpeg(img, THUMB_MAX, 0.75);
  return { blob: full.blob, thumb: thumb.blob, w: full.w, h: full.h };
}

export async function makeThumb(blob) {
  return (await toJpeg(await loadImage(blob), THUMB_MAX, 0.75)).blob;
}
