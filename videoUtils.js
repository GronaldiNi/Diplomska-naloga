import { resolve, dirname } from "path";
import fs from "fs";
import ffmpegPath  from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import ffmpeg      from "fluent-ffmpeg";
import pLimit      from "p-limit";
import { fileURLToPath } from "url";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const cacheDir   = resolve(__dirname, "cache");
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

const jobs  = new Map();
const limit = pLimit(1);

export async function ensureBrowserMp4(rawPath, ftpPath) {
  const baseName = ftpPath
    .replace(/^\/+/, "")        // zacetni slash
    .replace(/[\\/]/g, "_")     // separatorji
    .replace(/\s+/g, "_");      // spaces
  const dst = resolve(cacheDir, `${baseName}_h264.mp4`);

  if (fs.existsSync(dst)) return dst;

  if (jobs.has(ftpPath)) return jobs.get(ftpPath);

  const job = limit(() => convert(rawPath, dst));
  jobs.set(ftpPath, job);
  job.finally(() => jobs.delete(ftpPath));
  return job;
}

async function convert(src, dst) {
  const meta     = await ffprobe(src);
  const vStream  = meta.streams.find(s => s.codec_type === "video") || {};
  const isH264   = vStream.codec_name === "h264";
  const cmd      = ffmpeg(src);

  if (isH264) {
    cmd.videoCodec("copy");
  } else {
    const nvenc = vStream.codec_name && ffmpegPath.includes("nvenc");
    cmd.videoCodec(nvenc ? "h264_nvenc" : "libx264")
      .outputOption("-preset", nvenc ? "p4" : "ultrafast");
  }

  return new Promise((res, rej) => {
    cmd.noAudio()
      .outputOption("-movflags", "+faststart")
      .output(dst)
      .on("end", () => res(dst))
      .on("error", rej)
      .run();
  });
}

function ffprobe(path) {
  return new Promise((res, rej) => {
    ffmpeg.ffprobe(path, (err, data) => (err ? rej(err) : res(data)));
  });
}
