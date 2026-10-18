// 極簡 ZIP：匯出用「不壓縮」（照片本來就是 JPEG，壓縮也省不了多少），
// 匯入時另外支援 deflate，讓使用者用電腦重新壓縮過的檔案也能讀。

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

const UTF8_FLAG = 0x0800;

// files: [{ name, blob }]，回傳 ZIP Blob。資料本身用 Blob 參照，不會整包讀進記憶體。
export async function createZip(files) {
  const enc = new TextEncoder();
  const { time, date } = dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(new Uint8Array(await f.blob.arrayBuffer()));
    const size = f.blob.size;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, UTF8_FLAG, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    parts.push(local.buffer, name, f.blob);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, UTF8_FLAG, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(cd.buffer, name);

    offset += 30 + name.length + size;
  }

  const cdSize = central.reduce((n, p) => n + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

export async function readZip(file) {
  const tailLen = Math.min(file.size, 65557);
  const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tailLen - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP 檔');

  const count = tail.getUint16(eocd + 10, true);
  const cdSize = tail.getUint32(eocd + 12, true);
  const cdOffset = tail.getUint32(eocd + 16, true);
  const cdBuf = await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer();
  const cd = new DataView(cdBuf);
  const dec = new TextDecoder();
  const entries = new Map();

  let p = 0;
  for (let i = 0; i < count; i++) {
    if (cd.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP 檔已損壞');
    const method = cd.getUint16(p + 10, true);
    const compSize = cd.getUint32(p + 20, true);
    const nameLen = cd.getUint16(p + 28, true);
    const extraLen = cd.getUint16(p + 30, true);
    const commentLen = cd.getUint16(p + 32, true);
    const localOffset = cd.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(cdBuf, p + 46, nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.endsWith('/') && !name.includes('__MACOSX')) entries.set(name, { method, compSize, localOffset });
  }

  const names = [...entries.keys()];
  return {
    // 依結尾找檔案，容許外面多包一層資料夾
    find: (suffix) => names.find((n) => n === suffix || n.endsWith(`/${suffix}`)),
    async blob(name, type = '') {
      const e = entries.get(name);
      const header = new DataView(await file.slice(e.localOffset, e.localOffset + 30).arrayBuffer());
      const start = e.localOffset + 30 + header.getUint16(26, true) + header.getUint16(28, true);
      const raw = file.slice(start, start + e.compSize);
      if (e.method === 0) return new Blob([raw], { type });
      if (e.method === 8 && typeof DecompressionStream !== 'undefined') {
        const out = await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
        return new Blob([out], { type });
      }
      throw new Error('不支援這種 ZIP 壓縮格式');
    },
  };
}
