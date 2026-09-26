#!/usr/bin/env node
// Generates the portfolio's video assets ONCE through the Higgsfield cloud API.
//
// Server-side only. The API key is read from .env.local (HF_CREDENTIALS=key-id:key-secret) and is
// never logged or written anywhere. Nothing in src/ imports this file, and Vite only exposes
// VITE_-prefixed variables, so the key can't reach the frontend bundle or Vercel.
//
// Pipeline — every step caches its output under assets/generated/ and is skipped on re-runs:
//   1. frame-idle   Outpaint the 3:4 reference photo to 16:9, then paste the original pixels back
//                   on top so the character is untouched. This is the start frame of everything.
//   2. frame-board  Generate the frontal black-board still in the same light. It is the last frame
//                   of the reveal and the first frame of the return, and the Three.js board is
//                   textured with it.
//   3. videos       Kling 3.0 4K image-to-video with first + last frame:
//                     idle   4 s  frame-idle  → frame-idle   (seamless loop)
//                     reveal 8 s  frame-idle  → frame-board  (second half re-generated, see CLIPS)
//                     return 8 s  frame-board → frame-idle
//   4. encode       Pin each clip's first/last frames to the exact anchor stills with a short
//                   smoothstep blend (so every handoff is frame-identical even if the model drifts),
//                   then encode MP4 (H.264) + WebM (VP9) in landscape 1920×1080 and portrait
//                   1080×1920, plus poster frames and board-end.jpg (the reveal's real last frame).
//
// Usage:
//   npm run generate:videos                          run whatever is missing
//   npm run generate:videos -- --only=frames         one or more of: frames, videos, encode
//   npm run generate:videos -- --force=reveal        redo steps: frame-idle, frame-board, idle, reveal, return
//   npm run generate:videos -- --dry-run             show what would be submitted, spend nothing
//   npm run generate:videos -- --only=encode --clips=reveal   re-encode selected clips only
//
// A request that was submitted but not finished (crash, timeout, Ctrl+C) is stored in
// assets/generated/manifest.json and resumed on the next run instead of being paid for twice.

import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.higgsfield.ai';
const REFERENCE = path.join(ROOT, 'assets/source/reference.png');
const GEN = path.join(ROOT, 'assets/generated');
const RAW = path.join(GEN, 'raw');
const PROCESSED = path.join(GEN, 'processed');
const OUT = path.join(ROOT, 'public/videos');
const MANIFEST = path.join(GEN, 'manifest.json');
const FFMPEG = ffmpegInstaller.path;

const IMAGE_ENDPOINT = 'marketing-studio/image';
const VIDEO_ENDPOINT = 'kling-video/v3.0/4k/image-to-video';

// ---------------------------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------------------------

const PROMPTS = {
  outpaint: `Outpaint this photograph to a wider 16:9 frame. The flat grey areas on the left and right
are empty canvas: fill them so the photo continues seamlessly — the dim photo studio beyond the
mottled blue canvas backdrop, deep black studio curtains falling into shadow at the far sides, and
the same grey concrete floor with its soft pool of light continuing to the left and right.
Keep everything that is already in the photo exactly as it is: do not change the young man, his pose,
face, hair, clothing or shoes, and do not change the backdrop, the lighting, the colors or the grain.
Same camera, same lens, same exposure, same film grain. Photorealistic. No new people, no objects,
no text, no logos.`,

  board: `Photorealistic still frame from the same film as the reference photo: the same dim photo
studio, the same cool blue-grey color grade, the same soft key light, the same subtle film grain and
gentle vignette. The camera is now very close to and perfectly frontal to a large old black
chalkboard that hangs behind where the mottled backdrop was. The matte black slate fills almost the
entire 16:9 frame edge to edge; only a thin strip of its weathered dark wooden frame is visible
along all four edges of the image. The slate is empty — no writing, no drawings — with a faint haze
of erased chalk, soft chalk-dust smudges, a few old nail holes and fine scratches, and a soft pool
of light in the center falling off to darker corners. Straight-on orthogonal view, no perspective
tilt, level horizon, sharp focus across the whole board. No people, no hands, no text, no posters,
no objects in front of the board.`,

  idle: `Locked-off static camera, no camera movement at all. Photorealistic cinematic footage in a dim
photo studio with a cool blue-grey grade and fine film grain. The young man stands still with his
arms crossed, looking calmly into the lens. Only very subtle, natural motion: slow calm breathing
gently lifts his chest and shoulders, a single soft blink, a barely visible weight shift. Fine dust
particles drift slowly through the light. The mottled backdrop fabric ripples very slightly. The
studio light flickers almost imperceptibly. He does not uncross his arms, does not walk, does not
speak and does not change his expression. The final frame is identical to the first frame.`,

  reveal: `One continuous shot, photorealistic and cinematic, in a dim photo studio with a cool blue-grey
grade and fine film grain. The young man uncrosses his arms, turns around to the mottled blue canvas
backdrop behind him, reaches up with both hands, grabs its top edge and pulls the heavy cloth down in
one smooth motion. He gathers the fallen cloth and lays it aside on the floor to the left, revealing
a large empty black chalkboard that was hanging behind it. He walks back toward the camera, takes
hold of the camera with both hands and carries it forward, handheld and steady, straight toward the
chalkboard until the black slate fills the whole frame, perfectly frontal and centered. The man is
now out of frame and the camera comes to rest, still.`,

  return: `One continuous shot, photorealistic and cinematic, in a dim photo studio with a cool blue-grey
grade and fine film grain. The shot starts close and frontal on an empty black chalkboard. The
handheld camera pulls back smoothly and steadily away from the board; the young man carries it back
and sets it down on its original spot, and the camera settles completely still. He walks to the
side, picks up the mottled blue canvas backdrop cloth from the floor and hangs it back up so that it
fully covers the chalkboard again, smoothing it into its original place. He walks back to the
center in front of the backdrop, turns to face the camera and crosses his arms, ending in exactly
the original pose: standing centered, arms crossed, looking calmly into the lens.`,

  // Second half of the reveal, generated from its last clean frame (see CLIPS.splice).
  'reveal-b': `One continuous shot, photorealistic and cinematic, in a dim photo studio with a cool
blue-grey grade and fine film grain. There is exactly one person in the scene: the young man
standing in front of the large empty black chalkboard, looking into the lens. He walks straight up
to the camera, reaches out with both hands and grips it; the view jolts slightly as he lifts it and
he steps around behind it, out of view. Now carried by him, handheld and steady, the camera glides
smoothly forward toward the chalkboard until the empty black slate fills the whole frame, perfectly
frontal and centered, and comes to rest, still. Only this one person ever appears: no second person,
no duplicate, no reflection of him.`,
};

// Anchor blends (seconds): how long each clip eases from / into its exact anchor still.
// splice: the first reveal render duplicated the character after frame 89, so frames 0..at-1 are
// kept and the rest is re-generated starting from frame `at`.
const CLIPS = [
  { key: 'idle', seconds: 4, first: 'frame-idle', last: 'frame-idle', head: 0.5, tail: 0.5, loop: true },
  {
    key: 'reveal', seconds: 8, first: 'frame-idle', last: 'frame-board', head: 0.3, tail: 0.5,
    splice: { key: 'reveal-b', at: 86, seconds: 5 },
  },
  { key: 'return', seconds: 8, first: 'frame-board', last: 'frame-idle', head: 0.3, tail: 0.6 },
];

// Every clip is normalized to this size before anchoring (Kling returns 3840×2156 or ×2160).
const MASTER = { width: 3840, height: 2160 };
const NORMALIZE = `scale=${MASTER.width}:${MASTER.height}:flags=lanczos,format=yuv444p,setsar=1`;

// ---------------------------------------------------------------------------------------------
// CLI + manifest
// ---------------------------------------------------------------------------------------------

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);
const ONLY = new Set(args.only ? String(args.only).split(',') : ['frames', 'videos', 'encode']);
const FORCE = new Set(args.force ? String(args.force).split(',') : []);
const ONLY_CLIPS = args.clips ? new Set(String(args.clips).split(',')) : null; // encode: e.g. --clips=reveal
const DRY = Boolean(args['dry-run']);

for (const dir of [GEN, RAW, PROCESSED, OUT]) mkdirSync(dir, { recursive: true });

const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { jobs: {}, uploads: {} };
const saveManifest = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const fileFor = (name) => path.join(GEN, `${name}.png`);

// ---------------------------------------------------------------------------------------------
// Higgsfield API
// ---------------------------------------------------------------------------------------------

function credentials() {
  const envFile = path.join(ROOT, '.env.local');
  if (!process.env.HF_CREDENTIALS && existsSync(envFile)) process.loadEnvFile(envFile);
  const value = process.env.HF_CREDENTIALS;
  if (!value || !value.includes(':')) {
    throw new Error('HF_CREDENTIALS is missing. Add HF_CREDENTIALS=key-id:key-secret to .env.local.');
  }
  return value;
}

async function api(method, urlOrPath, body) {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${API}/${urlOrPath.replace(/^\//, '')}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Key ${credentials()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${new URL(url).pathname} → HTTP ${res.status}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

async function upload(file) {
  const bytes = readFileSync(file);
  const hash = sha256(bytes);
  const cached = manifest.uploads[hash];
  // Presigned uploads are temporary; reuse one only while it is fresh.
  if (cached && Date.now() - cached.at < 40 * 60 * 1000) return cached.url;
  if (DRY) return `dry-run://${path.basename(file)}`;

  const contentType = file.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const ticket = await api('POST', 'files/generate-upload-url', { content_type: contentType });
  // Only the headers the API asked for go to the storage URL — never our credentials.
  const put = await fetch(ticket.upload_url, {
    method: 'PUT',
    headers: ticket.upload_headers ?? { 'Content-Type': contentType },
    body: bytes,
  });
  if (!put.ok) throw new Error(`Upload of ${path.basename(file)} failed: HTTP ${put.status}`);

  manifest.uploads[hash] = { file: path.relative(ROOT, file), url: ticket.public_url, at: Date.now() };
  saveManifest();
  log(`uploaded ${path.basename(file)}`);
  return ticket.public_url;
}

const TERMINAL = new Set(['completed', 'failed', 'nsfw', 'canceled', 'cancelled']);

// Submits (or resumes) one generation and returns its output URL.
async function generate(key, endpoint, input) {
  let job = manifest.jobs[key];
  const reusable = job && job.endpoint === endpoint && !FORCE.has(key) && !['failed', 'nsfw', 'canceled', 'cancelled'].includes(job.status);

  if (!reusable) {
    if (DRY) {
      log(`[dry-run] would submit ${key} → ${endpoint}`);
      console.log(JSON.stringify({ ...input, prompt: `${input.prompt.slice(0, 90)}…` }, null, 2));
      return null;
    }
    const res = await api('POST', endpoint, input);
    job = manifest.jobs[key] = {
      endpoint,
      request_id: res.request_id,
      status_url: res.status_url,
      status: res.status,
      submitted_at: new Date().toISOString(),
      input: { ...input },
    };
    saveManifest();
    log(`${key}: submitted (request ${res.request_id})`);
  } else if (job.status === 'completed' && job.output) {
    return job.output;
  } else {
    log(`${key}: resuming request ${job.request_id} (${job.status})`);
  }

  const started = Date.now();
  let delay = 5000;
  let last = job.status;
  while (!TERMINAL.has(job.status)) {
    await sleep(delay);
    delay = Math.min(delay * 1.3, 20000);
    const status = await api('GET', job.status_url);
    job.status = status.status;
    job.error = status.error;
    job.output = status.video?.url ?? status.images?.[0]?.url;
    saveManifest();
    if (job.status !== last) {
      log(`${key}: ${job.status}`);
      last = job.status;
    }
    if (Date.now() - started > 45 * 60 * 1000) {
      throw new Error(`${key}: still ${job.status} after 45 min — re-run the script later to resume.`);
    }
  }
  if (job.status !== 'completed' || !job.output) {
    throw new Error(`${key}: ${job.status}${job.error ? ` — ${JSON.stringify(job.error)}` : ''}`);
  }
  return job.output;
}

async function download(url, file) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}) for ${path.basename(file)}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  log(`downloaded ${path.relative(ROOT, file)}`);
  return file;
}

// ---------------------------------------------------------------------------------------------
// Step 1 + 2: anchor stills
// ---------------------------------------------------------------------------------------------

// Generates an image once and returns the downloaded file. Re-runs reuse the download, so
// re-doing the local compositing never pays for a second generation (use --force=<key> for that).
async function generatedImage(key, input) {
  const job = manifest.jobs[key];
  if (job?.file && existsSync(path.join(ROOT, job.file)) && !FORCE.has(key)) return path.join(ROOT, job.file);
  const url = await generate(key, IMAGE_ENDPOINT, input);
  if (!url) return null;
  const file = await download(url, path.join(RAW, `${key}${extension(url, '.png')}`));
  manifest.jobs[key].file = path.relative(ROOT, file);
  saveManifest();
  return file;
}

async function frameIdle() {
  const out = fileFor('frame-idle');
  if (existsSync(out) && !FORCE.has('frame-idle')) return out;

  const { width: w, height: h } = await sharp(REFERENCE).metadata();
  const W = Math.round((h * 16) / 9 / 2) * 2;

  // Neutral grey marks the empty canvas the model should fill.
  const canvas = path.join(GEN, 'outpaint-input.png');
  await sharp({ create: { width: W, height: h, channels: 3, background: '#808080' } })
    .composite([{ input: REFERENCE, left: Math.round((W - w) / 2), top: 0 }])
    .png()
    .toFile(canvas);

  const raw = await generatedImage('frame-idle', {
    prompt: PROMPTS.outpaint,
    image_urls: [await upload(canvas)],
    aspect_ratio: '16:9',
    resolution: '4k',
    quality: 'high',
    enhance_prompt: false,
  });
  if (!raw) return null;

  // The model is free to reframe (it usually zooms out a little), so find where it put the photo
  // and paste the original pixels exactly there. The character stays pixel-exact and the seams
  // fall on curtain and floor, where a feathered edge is invisible.
  const { width: rw, height: rh } = await sharp(raw).metadata();
  const fit = await locateReference(raw, rw, rh, w, h);
  log(`outpaint: reference found at ${(fit.scale * 100).toFixed(1)}% scale, offset ${fit.x.toFixed(0)},${fit.y.toFixed(0)} (mean error ${fit.error.toFixed(1)}/255)`);
  if (fit.error > 18) log('  ⚠ the outpaint differs a lot from the original — check assets/generated/frame-idle.png');

  // Output size: the original pasted 1:1, the generated surround scaled to match.
  const Hc = Math.round(h / fit.scale / 2) * 2;
  const Wc = Math.round((Hc * 16) / 9 / 2) * 2;
  const k = Hc / rh;
  const left = Math.round(fit.x * k);
  const top = Math.round(fit.y * k);
  const surround = await sharp(raw).resize(Wc, Hc, { fit: 'fill' }).removeAlpha().toBuffer();

  // Wide side feathers: the reference has its own edge vignette, so a short ramp shows as a band.
  // The figure is well inside the photo, so only curtain and floor fall in the ramps.
  const feather = { left: 220, right: 220, top: 80, bottom: 110 };
  // RGBA assembled by hand: sharp runs removeAlpha() after joinChannel() whatever the call order,
  // which silently drops a joined mask.
  const rgb = await sharp(REFERENCE).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const t = Math.min(1, x / feather.left, (w - 1 - x) / feather.right, y / feather.top, (h - 1 - y) / feather.bottom);
      rgba[i * 4] = rgb[i * 3];
      rgba[i * 4 + 1] = rgb[i * 3 + 1];
      rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = Math.round(255 * t * t * (3 - 2 * t));
    }
  }
  const original = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  // Clip the paste to the canvas in case the model placed the photo partly outside the frame.
  const crop = {
    left: Math.max(0, -left),
    top: Math.max(0, -top),
    width: Math.min(w, Wc - left) - Math.max(0, -left),
    height: Math.min(h, Hc - top) - Math.max(0, -top),
  };
  const patch = await sharp(original).extract(crop).png().toBuffer();
  await sharp(surround)
    .composite([{ input: patch, left: Math.max(0, left), top: Math.max(0, top) }])
    .png()
    .toFile(out);
  log(`wrote ${path.relative(ROOT, out)} (${Wc}×${Hc})`);
  return out;
}

// Coarse-to-fine search for the scale and offset at which the reference photo appears inside the
// generated image (sum of absolute greyscale differences on a sparse grid).
async function locateReference(raw, rw, rh, w, h) {
  let best = null;
  const levels = [
    { width: 160, scales: [0.62, 1.0, 0.004] },
    { width: 640, radius: 5 },
    { width: 1920, radius: 4 },
  ];
  for (const level of levels) {
    const f = level.width / rw;
    const lw = level.width;
    const lh = Math.round(rh * f);
    const img = await sharp(raw).resize(lw, lh, { fit: 'fill' }).greyscale().raw().toBuffer();

    const scales = [];
    if (!best) {
      for (let s = level.scales[0]; s <= level.scales[1] + 1e-9; s += level.scales[2]) scales.push(s);
    } else {
      const step = 1 / (rh * f); // one pixel of patch height at this level
      for (let i = -3; i <= 3; i++) scales.push(best.scale + i * step);
    }

    let levelBest = null;
    for (const scale of scales) {
      const ph = Math.round(rh * scale * f);
      const pw = Math.round((ph * w) / h);
      if (pw < 8 || ph < 8 || pw > lw || ph > lh) continue;
      const patch = await sharp(REFERENCE).resize(pw, ph, { fit: 'fill' }).greyscale().raw().toBuffer();
      const stride = Math.max(1, Math.round(Math.min(pw, ph) / 90));

      let x0 = 0, x1 = lw - pw, y0 = 0, y1 = lh - ph;
      if (best) {
        const cx = Math.round(best.x * f);
        const cy = Math.round(best.y * f);
        x0 = Math.max(0, cx - level.radius); x1 = Math.min(lw - pw, cx + level.radius);
        y0 = Math.max(0, cy - level.radius); y1 = Math.min(lh - ph, cy + level.radius);
      }
      for (let oy = y0; oy <= y1; oy++) {
        for (let ox = x0; ox <= x1; ox++) {
          let sum = 0, n = 0;
          for (let y = 0; y < ph; y += stride) {
            const row = (oy + y) * lw + ox;
            const prow = y * pw;
            for (let x = 0; x < pw; x += stride) {
              sum += Math.abs(img[row + x] - patch[prow + x]);
              n++;
            }
          }
          const error = sum / n;
          if (!levelBest || error < levelBest.error) levelBest = { error, scale, x: ox / f, y: oy / f };
        }
      }
    }
    best = levelBest;
  }
  return best;
}

async function frameBoard(idleFrame) {
  const out = fileFor('frame-board');
  if (existsSync(out) && !FORCE.has('frame-board')) return out;

  const raw = await generatedImage('frame-board', {
    prompt: PROMPTS.board,
    image_urls: [await upload(idleFrame)],
    aspect_ratio: '16:9',
    resolution: '4k',
    quality: 'high',
    enhance_prompt: false,
  });
  if (!raw) return null;
  await sharp(raw).resize(3840, 2160, { fit: 'cover' }).removeAlpha().png().toFile(out);
  log(`wrote ${path.relative(ROOT, out)} (3840×2160)`);
  return out;
}

function extension(url, fallback) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return ext && ext.length <= 5 ? ext : fallback;
}

// ---------------------------------------------------------------------------------------------
// Step 3: videos
// ---------------------------------------------------------------------------------------------

async function videos(frames) {
  const urls = {};
  for (const [name, file] of Object.entries(frames)) urls[name] = await upload(file);

  const results = await Promise.allSettled(
    CLIPS.map(async (clip) => {
      const raw = path.join(RAW, `${clip.key}.mp4`);
      if (existsSync(raw) && !FORCE.has(clip.key)) return raw;
      const url = await generate(clip.key, VIDEO_ENDPOINT, {
        prompt: PROMPTS[clip.key],
        image_url: urls[clip.first],
        last_image_url: urls[clip.last],
        duration: clip.seconds,
        sound: 'off',
      });
      return url ? download(url, raw) : null;
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  for (const f of failed) console.error(`✗ ${f.reason.message}`);
  if (failed.length) throw new Error(`${failed.length} video(s) failed; finished ones are cached — re-run to retry.`);

  for (const clip of CLIPS.filter((c) => c.splice)) {
    const { key, seconds } = clip.splice;
    const raw = path.join(RAW, `${key}.mp4`);
    if (existsSync(raw) && !FORCE.has(key)) continue;
    const url = await generate(key, VIDEO_ENDPOINT, {
      prompt: PROMPTS[key],
      image_url: await upload(await spliceFrame(clip)),
      last_image_url: urls[clip.last],
      duration: seconds,
      sound: 'off',
    });
    if (url) await download(url, raw);
  }
}

// The frame a splice continues from, extracted from the first render at master size.
async function spliceFrame(clip) {
  const file = path.join(GEN, `${clip.splice.key}-start.png`);
  if (existsSync(file)) return file;
  const tmp = path.join(PROCESSED, `${clip.splice.key}-start-raw.png`);
  await ffmpeg(['-i', path.join(RAW, `${clip.key}.mp4`), '-vf', `select=eq(n\\,${clip.splice.at})`, '-vsync', '0', '-frames:v', '1', tmp]);
  await sharp(tmp).resize(MASTER.width, MASTER.height, { fit: 'fill' }).png().toFile(file);
  rmSync(tmp);
  log(`extracted splice frame ${clip.splice.at} of ${clip.key} → ${path.relative(ROOT, file)}`);
  return file;
}

// Joins the kept head of a clip with its re-generated continuation. A straight cut: the
// continuation's first frame reproduces the cut frame (≈1.7/255 apart) and is already in motion,
// so any blend onto the still frame would only add a visible stall.
async function splicedSource(clip, fps) {
  const { key, at } = clip.splice;
  const out = path.join(PROCESSED, `${clip.key}-spliced.mp4`);
  const second = path.join(RAW, `${key}.mp4`);
  if (!existsSync(second)) throw new Error(`Missing ${path.relative(ROOT, second)} — run the videos step first.`);
  log(`${clip.key}: splicing frames 0–${at - 1} with ${key}`);
  await ffmpeg([
    '-i', path.join(RAW, `${clip.key}.mp4`),
    '-i', second,
    '-filter_complex', [
      `[0:v]fps=${fps},trim=end_frame=${at},setpts=PTS-STARTPTS,${NORMALIZE}[a]`,
      `[1:v]fps=${fps},setpts=PTS-STARTPTS,${NORMALIZE}[b]`,
      '[a][b]concat=n=2:v=1:a=0,format=yuv420p[out]',
    ].join(';'),
    '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12',
    out,
  ]);
  return out;
}

// ---------------------------------------------------------------------------------------------
// Step 4: anchor + encode
// ---------------------------------------------------------------------------------------------

function ffmpeg(args, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(FFMPEG, ['-hide_banner', '-y', ...args], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      if (!quiet) process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve(stderr) : reject(new Error(`ffmpeg exited ${code}\n${stderr.slice(-2000)}`))));
  });
}

async function probe(file) {
  const info = await ffmpeg(['-i', file, '-map', '0:v:0', '-c', 'copy', '-f', 'null', '-']);
  const stream = info.match(/Video: [^\n]*?, (\d{2,5})x(\d{2,5})[ ,][^\n]*?([\d.]+) fps/);
  const frames = [...info.matchAll(/frame=\s*(\d+)/g)].pop();
  if (!stream || !frames) throw new Error(`Could not read video info from ${path.basename(file)}`);
  return { width: +stream[1], height: +stream[2], fps: +stream[3], frames: +frames[1] };
}

// Smoothstep weight for the anchor still, evaluated per pixel inside ffmpeg's blend filter.
// - Uses the frame time T (inputs are re-based to 0): blend's frame counter N starts at 1 in
//   some ffmpeg builds.
// - No st()/ld() registers: blend runs slice-threaded and the registers are shared between
//   threads, which scrambles the weights.
const blendExpr = (weight) => {
  const w = `clip(${weight},0,1)`;
  return `A+(B-A)*${w}*${w}*(3-2*${w})`;
};

async function encode(frames) {
  const masters = {};
  const { width, height } = MASTER;
  for (const clip of CLIPS) {
    masters[clip.key] = path.join(PROCESSED, `${clip.key}-master.mp4`);
    if (ONLY_CLIPS && !ONLY_CLIPS.has(clip.key)) continue;
    let source = path.join(RAW, `${clip.key}.mp4`);
    if (!existsSync(source)) throw new Error(`Missing ${path.relative(ROOT, source)} — run the videos step first.`);
    if (clip.splice) source = await splicedSource(clip, (await probe(source)).fps);
    const { width: sw, height: sh, fps, frames: count } = await probe(source);
    const lastIndex = count - 1;
    const head = Math.max(1, Math.round(clip.head * fps));
    const tail = Math.max(1, Math.round(clip.tail * fps));

    const anchor = async (name) => {
      const file = path.join(PROCESSED, `${name}-${width}x${height}.png`);
      if (!existsSync(file)) await sharp(frames[name]).resize(width, height, { fit: 'cover' }).png().toFile(file);
      return file;
    };
    const still = (i) => `[${i}:v]fps=${fps},setpts=PTS-STARTPTS,format=yuv444p,setsar=1[s${i}]`;
    const at = (frame) => (frame / fps).toFixed(6);

    const master = path.join(PROCESSED, `${clip.key}-master.mp4`);
    log(`${clip.key}: ${sw}×${sh} @ ${fps} fps, ${count} frames → pinning ${head}+${tail} frames to anchors`);
    await ffmpeg([
      '-i', source,
      '-loop', '1', '-framerate', String(fps), '-i', await anchor(clip.first),
      '-loop', '1', '-framerate', String(fps), '-i', await anchor(clip.last),
      '-filter_complex', [
        `[0:v]fps=${fps},setpts=PTS-STARTPTS,${NORMALIZE}[v]`,
        still(1),
        still(2),
        `[v][s1]blend=all_expr='${blendExpr(`1-T/${at(head)}`)}':shortest=1[h]`,
        `[h][s2]blend=all_expr='${blendExpr(`(T-${at(lastIndex - tail)})/${at(tail)}+0.0001`)}':shortest=1[t]`,
        // The loop's last frame equals its first, so drop it to avoid a one-frame stall at the seam.
        `[t]${clip.loop ? `trim=end_frame=${lastIndex},setpts=PTS-STARTPTS,` : ''}format=yuv420p[out]`,
      ].join(';'),
      '-map', '[out]', '-an',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '12',
      master,
    ]);

    const variants = {
      landscape: 'scale=1920:1080:flags=lanczos',
      portrait: 'crop=trunc(ih*9/32)*2:ih,scale=1080:1920:flags=lanczos',
    };
    for (const [variant, filter] of Object.entries(variants)) {
      const base = path.join(OUT, `${clip.key}-${variant}`);
      await ffmpeg(['-i', master, '-vf', filter, '-an',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', `${base}.mp4`]);
      await ffmpeg(['-i', master, '-vf', filter, '-an',
        '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
        '-pix_fmt', 'yuv420p', `${base}.webm`]);
      log(`wrote public/videos/${clip.key}-${variant}.{mp4,webm}`);
    }
  }

  // Poster frames: the idle anchor, full frame and the centered portrait crop.
  await sharp(frames['frame-idle']).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true })
    .toFile(path.join(OUT, 'idle-poster-landscape.jpg'));
  const { width: iw, height: ih } = await sharp(frames['frame-idle']).metadata();
  const pw = Math.round((ih * 9) / 16 / 2) * 2;
  await sharp(frames['frame-idle']).extract({ left: Math.round((iw - pw) / 2), top: 0, width: pw, height: ih })
    .jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, 'idle-poster-portrait.jpg'));

  // board-end.jpg is the reveal's actual last frame; the Three.js board is built on it.
  const { frames: revealFrames } = await probe(masters.reveal);
  const lastFrame = path.join(PROCESSED, 'reveal-last-frame.png');
  await ffmpeg(['-i', masters.reveal, '-vf', `select=eq(n\\,${revealFrames - 1})`, '-vsync', '0', '-frames:v', '1', lastFrame]);
  await sharp(lastFrame).resize(2560, 1440, { fit: 'cover' }).jpeg({ quality: 90, mozjpeg: true })
    .toFile(path.join(OUT, 'board-end.jpg'));
  rmSync(lastFrame);
  log('wrote public/videos/idle-poster-*.jpg and board-end.jpg');
}

// ---------------------------------------------------------------------------------------------

async function main() {
  if (!existsSync(REFERENCE)) throw new Error(`Missing reference photo at ${path.relative(ROOT, REFERENCE)}`);
  const frames = { 'frame-idle': fileFor('frame-idle'), 'frame-board': fileFor('frame-board') };

  if (ONLY.has('frames')) {
    const idle = await frameIdle();
    if (idle) await frameBoard(idle);
  }
  const haveFrames = Object.values(frames).every((f) => existsSync(f));

  if (ONLY.has('videos')) {
    if (!haveFrames) throw new Error('Anchor stills are missing — run the frames step first.');
    await videos(frames);
  }
  if (ONLY.has('encode') && !DRY) {
    if (!haveFrames) throw new Error('Anchor stills are missing — run the frames step first.');
    await encode(frames);
  }
  log(DRY ? 'dry run finished — nothing was submitted.' : 'done.');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
