import qc from "qusly-core";
import express from "express";
import crypto from "crypto";
import fs from "fs";
import { resolve, join, dirname } from "path";
import { fileURLToPath } from "url";
import { ensureBrowserMp4 } from "./videoUtils.js";
import pLimit from "p-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const app = express();
app.set("etag", false);
app.use(express.static(join(__dirname, "public")));
const binaryCache = new Map();
//FTP odjemalec
const ftpOp = pLimit(1);

async function runFtp(op) {
  return ftpOp(async () => {
    const client = new qc.Client();
    await client.connect({ protocol: "ftp", host: "public.sos.noaa.gov" });
    try {
      return await op(client);
    } finally {
      try { await (client.close?.() || client.end?.() || client.disconnect?.()); } catch {}
    }
  });
}

async function ftpDownloadWithTimeout(client, remotePath, localPath, timeoutMs = 15000) {
  return Promise.race([
    client.download(localPath, remotePath),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`FTP timeout: ${remotePath}`)), timeoutMs)
    )
  ]);
}



//Pomoč: poti do ./tmp in ustvarjanje začasnih datotek
function ensureTmpDir() {
  const tmpDir = resolve(__dirname, "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}
function makeTempPath(ext = "") {
  const dir = ensureTmpDir();
  return resolve(dir, crypto.randomUUID() + ext);
}

//Branje tekstovnih datotek (npr. playlist.sos) prek FTP
async function getFile(client, filePath) {
  const local = makeTempPath();
  try {
    await ftpDownloadWithTimeout(client, filePath, local);
    return fs.readFileSync(local, "utf8");
  } finally {
    if (fs.existsSync(local)) fs.unlinkSync(local);
  }
}

//Predpomnjeno branje binarnih datotek (jpg/png/mp4/mp3)
async function getBinaryFileCached(client, filePath, wantPath = false) {
  const cachedPath = binaryCache.get(filePath);
  if (cachedPath && fs.existsSync(cachedPath)) {
    return wantPath ? cachedPath : fs.readFileSync(cachedPath);
  }
  
  const dot = filePath.lastIndexOf(".");
  const ext = dot >= 0 ? filePath.slice(dot) : "";
  const tempPath = makeTempPath(ext);
  
  await ftpDownloadWithTimeout(client, filePath, tempPath);
  binaryCache.set(filePath, tempPath);
  
  return wantPath ? tempPath : fs.readFileSync(tempPath);
}

//GET /getPlaylist: vrne vsebino playlist.sos
app.get("/getPlaylist", async (req, res) => {
  const path = req.query.path;
  if (!path || !path.endsWith("playlist.sos")) {
    return res.status(400).json({ message: "Missing or invalid 'path'" });
  }
  try {
    const content = await runFtp(c => getFile(c, path));
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8"
    });
    res.json({ path, content });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Error fetching playlist", error: e.message });
  }
});

//GET /getLayer: pretok binarnih vsebin (jpg/png/mp4/mp3/txt)
app.get("/getLayer", async (req, res) => {
  const ftpPath = req.query.path;
  if (!ftpPath || !/\.(jpg|png|mp4|mp3|txt)$/i.test(ftpPath)) {
    return res.status(400).end();
  }
  
  let mime = "application/octet-stream";
  if      (/\.png$/i.test(ftpPath))  mime = "image/png";
  else if (/\.jpe?g$/i.test(ftpPath)) mime = "image/jpeg";
  else if (/\.mp4$/i.test(ftpPath))   mime = "video/mp4";
  else if (/\.mp3$/i.test(ftpPath))   mime = "audio/mpeg";
  else if (/\.txt$/i.test(ftpPath))   mime = "text/plain";
  
  const isVideo = /\.mp4$/i.test(ftpPath);
  const labelBase = `GET ${ftpPath}`;
  const isFirstSegment = !req.headers.range || /^bytes=0-/.test(req.headers.range);
  if (isFirstSegment) console.time(labelBase);
  
  try {
    // 1) Če obstaja lokalno transkodirana kopija videa, jo uporabimo 
    let safePath;
    if (isVideo) {
      const base = ftpPath.replace(/^\/+/, "").replace(/[\\/]/g, "_").replace(/\s+/g, "_");
      const cached = resolve(__dirname, "cache", `${base}_h264.mp4`);
      if (fs.existsSync(cached)) safePath = cached;
    }
    
    // 2) Sicer prenesemo in (če je video) po potrebi transkodiramo 
    if (!safePath) {
      const tmpPath = await runFtp(c => getBinaryFileCached(c, ftpPath, true));
      safePath = isVideo ? await ensureBrowserMp4(tmpPath, ftpPath) : tmpPath;
    }
    
    // 3) Podpora za byte-range pretakanje (delni prenosi) 
    const { size } = fs.statSync(safePath);
    const range    = req.headers.range;
    
    res.set({
      "Content-Type": mime,
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*"
    });
    
    if (!range) {
      res.set("Content-Length", size);
      return fs.createReadStream(safePath).pipe(res);
    }
    
    const [s, e] = range.replace(/bytes=/, "").split("-");
    const start  = Number(s) || 0;
    const end    = e ? Number(e) : size - 1;
    
    res.status(206).set({
      "Content-Length": end - start + 1,
      "Content-Range":  `bytes ${start}-${end}/${size}`
    });
    
    fs.createReadStream(safePath, { start, end }).pipe(res);
    
  } catch (e) {
    console.error("getLayer error:", e);
    res.status(500).end();
  } finally {
    if (isFirstSegment) console.timeEnd(labelBase);
  }
});

//Zagon strežnika
const PORT = process.env.PORT || 5005;
app.listen(PORT, () => console.log("Server on :" + PORT));


//Čiščenje začasnih datotek ob izklopu procesa
function cleanupTmpFolder() {
  const tmpDir = resolve(__dirname, "tmp");
  if (fs.existsSync(tmpDir)) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      console.log(" Očiščen ./tmp pred izhodom.");
      fs.mkdirSync(tmpDir);
    } catch {
      
    }
  }
}

process.on("SIGINT",  () => { cleanupTmpFolder(); process.exit(0); });
process.on("SIGTERM", () => { cleanupTmpFolder(); process.exit(0); });
process.on("exit",    () => { cleanupTmpFolder(); });
