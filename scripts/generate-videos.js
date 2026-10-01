#!/usr/bin/env node
// Generates the portfolio's video assets ONCE through the Higgsfield cloud API.
//
// Server-side only. The API key is read from .env.local (HF_CREDENTIALS=key-id:key-secret) and is
// never logged or written anywhere. Nothing in src/ imports this file, and Vite only exposes
// VITE_-prefixed variables, so the key can't reach the frontend bundle or Vercel.
//
// Two sequences start from the same idle frame:
//   projects      idle loop, reveal (backdrop → chalkboard) and return
//   departments   the camera is carried to an old desk and crash-zooms into a CRT showing the
//                 Windows 95 start-up screen; the return pulls back from the switched-off monitor
//
// Pipeline — every step caches its output under assets/generated/ and is skipped on re-runs:
//   1. frames   frame-idle: outpaint the 3:4 reference photo to 16:9, then paste the original
//                 pixels back on top so the character is untouched. The start frame of everything.
//               STILLS: every other anchor still, generated with earlier anchors as references.
//                 frame-board is the reveal's last frame and textures the Three.js board.
//   2. videos   Kling 3.0 4K image-to-video with first + last frame (see CLIPS). A clip with parts
//               is rendered piece by piece, each piece between two anchor stills, so the model
//               never has to invent where the camera ends up.
//   3. encode   Pin each clip's (or part's) first/last frames to the exact anchor stills with a short
//               smoothstep blend (so every handoff is frame-identical even if the model drifts),
//               join parts, then encode MP4 (H.264) + WebM (VP9) in landscape 1920×1080 and portrait
//               1080×1920, plus the posters and stills the frontend shows around the clips.
//
// Usage:
//   npm run generate:videos                               run whatever is missing
//   npm run generate:videos -- --sequence=departments     one or more of: projects, departments
//   npm run generate:videos -- --only=frames              one or more of: frames, videos, encode
//   npm run generate:videos -- --force=reveal             redo keys: stills (frame-*), clips, parts
//   npm run generate:videos -- --dry-run                  show what would be submitted and what it
//                                                         would cost, spend nothing
//   npm run generate:videos -- --only=encode --clips=reveal   re-encode selected clips only
//
// Forcing a still does not force the stills and clips made from it; list those too.
// A request that was submitted but not finished (crash, timeout, Ctrl+C) is stored in
// assets/generated/manifest.json and resumed on the next run instead of being paid for twice.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
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

// Hand-made reference images that are not generated.
const SOURCES = {
  'win95-boot': path.join(ROOT, 'assets/source/win95-boot.png'),
};

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

  // Departments stills. The first reference sets the look; win95-boot is what the CRT displays.
  desk: `Photorealistic still frame from the same film as the first reference image: the same dim
photo studio, the same cool blue-grey color grade, the same soft key light, the same subtle film
grain and gentle vignette, the same lens and exposure. The camera has turned to the right, away from
the mottled backdrop, and now looks into a dark side of the studio at standing eye level. About three
meters away an old, worn writing desk of dark wood stands on the grey concrete floor in front of
heavy black studio curtains that fall into deep shadow. The whole desk is visible and spans roughly
the middle half of the frame width. On the desk sits a mid-1990s beige personal computer: a slightly
yellowed beige 14-inch CRT monitor with a thick bezel stands on a flat beige desktop case with a
3.5-inch floppy drive and a small green power light; in front of it a beige keyboard, a ball mouse on
a worn mouse pad, a few black 3.5-inch floppy disks and a chipped coffee mug. The monitor is switched
on and shows exactly the Windows 95 start-up screen from the second reference image: the sky-blue
cloud background, the four-colored waving Windows flag logo and the words Microsoft Windows 95. Its
cool glow spills softly onto the desk, the keyboard and the wood grain; everything else stays dim.
The monitor screen sits exactly in the center of the frame, level and seen straight on. Nothing else
in the room: no people, no hands, no chair, no lamps, no windows, no posters, no text except on the
screen.`,

  screen: `Photorealistic extreme close-up still from the same film as the first reference image: the
same beige 1990s CRT monitor from that desk, the same dim studio light, the same cool blue-grey
color grade, the same fine film grain. The camera is now very close to and perfectly frontal to the
monitor. Its slightly bulging glass screen fills almost the full height of the 16:9 frame and is
exactly centered; the yellowed beige plastic bezel shows as a thin strip above and below the screen
and as wider bands on the left and right that fall off into the dark studio at the frame edges. The
screen shows the complete Windows 95 start-up screen from the second reference image, exactly as it
is and not cropped: the sky-blue background with soft white clouds, the four-colored waving Windows
flag logo, the words Microsoft Windows 95, the small Microsoft wordmark in the top right corner and
the thin blue progress bar along the bottom edge. Authentic CRT character: fine horizontal scanlines
and a subtle RGB phosphor dot pattern, a soft glow and gentle bloom around the bright areas, slightly
darker rounded screen corners, a faint reflection of the dark studio on the curved glass and a few
specks of dust. The picture on the screen is sharp and in focus. No people, no hands, no reflection
of a person.`,

  'screen-off': `Edit this photograph. Keep exactly the same framing, camera position, monitor, bezel,
light, color grade and film grain. Change only one thing: the CRT monitor is now switched off. Its
curved glass screen is dark charcoal grey with a faint green-grey tint and shows only soft, dim
reflections of the studio and a few specks of dust. No picture, no logo, no text, no scanlines and no
glow on the screen, and the bezel is lit only by the dim studio light. Everything else stays exactly
the same.`,

  'desk-off': `Edit this photograph. Keep exactly the same framing, camera position, desk, computer,
keyboard, mouse, floppy disks, mug, curtains, light, color grade and film grain. Change only one
thing: the CRT monitor is now switched off. Its glass screen is dark charcoal grey with a faint
reflection, no picture, no logo and no glow, and the cool light it cast onto the desk and keyboard is
gone, so the desk is lit only by the dim studio light. Everything else stays exactly the same.`,

  'studio-empty': `Edit this photograph. Remove the young man completely, including his shadow on the
floor. Keep everything else exactly as it is: the same framing and camera position, the mottled blue
canvas backdrop, the black studio curtains, the grey concrete floor with its soft pool of light, the
same light, color grade and film grain. Where he stood, continue the backdrop fabric and the floor
naturally and seamlessly. The studio is empty: no people, no objects.`,

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

  // Departments: idle → desk → screen, and back from the switched-off screen.
  'departments-a': `One continuous shot, photorealistic and cinematic, in a dim photo studio with a cool
blue-grey grade and fine film grain. There is exactly one person in the scene: the young man standing
centered in front of the mottled blue canvas backdrop with his arms crossed. He uncrosses his arms,
walks straight up to the camera, reaches out with both hands and grips it; the view jolts slightly
as he lifts it and steps behind it, out of view. Now carried by him, handheld, the camera swings
smoothly to the right, away from the backdrop and across the dark studio curtains, and discovers an
old dark wooden desk standing at the side of the studio with a beige 1990s computer on it, its CRT
monitor glowing with the Windows 95 start-up screen. The camera slows down, settles centered on the
monitor and holds still. Only this one person ever appears: no second person, no duplicate, no
reflection of him.`,

  'departments-b': `One continuous shot, photorealistic and cinematic, in a dim photo studio with a cool
blue-grey grade and fine film grain. The handheld camera holds on the old wooden desk with the beige
1990s computer for a brief beat, the CRT monitor glowing with the Windows 95 start-up screen. Then a
violent, extremely fast crash zoom straight into the monitor: the lens slams in, the whole image
smears with heavy radial motion blur and zoom streaks, overshoots slightly and falls completely out
of focus into a soft glowing blur; the focus hunts, breathing soft and sharp twice, then snaps
razor-sharp onto the Windows 95 start-up screen, which now fills the frame between the beige bezel.
The camera comes to rest, perfectly still and frontal. No people, no hands.`,

  'departments-return-a': `One continuous shot, photorealistic and cinematic, in a dim photo studio with
a cool blue-grey grade and fine film grain. The shot starts extremely close and frontal on the dark,
switched-off glass of an old beige CRT monitor. The handheld camera pulls back smoothly and steadily,
gently easing out, revealing the whole monitor, the beige computer, the keyboard and the old dark
wooden desk, and comes to rest. The monitor stays switched off and dark the whole time. No people, no
hands.`,

  // The way back is split at the empty studio: a pan in one render and his entrance in the next,
  // because a single render faded him in out of thin air instead of letting him walk in.
  'departments-return-b': `One continuous shot, photorealistic and cinematic, in a dim photo studio with
a cool blue-grey grade and fine film grain. The handheld camera looks at the old wooden desk with the
switched-off beige computer, then swings smoothly to the left, away from the desk and across the dark
studio curtains, until the mottled blue canvas backdrop in the middle of the studio is centered in
the frame. The camera is set down on its original spot and settles completely still. The studio is
empty: no people, no hands, no shadows of people.`,

  'departments-return-c': `Locked-off static camera, no camera movement at all. Photorealistic cinematic
footage in a dim photo studio with a cool blue-grey grade and fine film grain, framing the mottled
blue canvas backdrop in the middle of the studio. The young man walks into the frame from the right
edge, fully solid and real from the first moment, crosses the floor in front of the backdrop to the
center, turns to face the camera and crosses his arms, ending in exactly the original pose: standing
centered, arms crossed, looking calmly into the lens. There is exactly one person in the scene: no
second person, no duplicate, no reflection of him.`,
};

// Anchor stills generated from earlier anchors; `refs` go to the model in this order.
// frame-idle is special (outpaint + paste-back, see frameIdle) and comes first.
const STILLS = [
  { key: 'frame-board', sequence: 'projects', prompt: 'board', refs: ['frame-idle'] },
  { key: 'frame-desk', sequence: 'departments', prompt: 'desk', refs: ['frame-idle', 'win95-boot'] },
  { key: 'frame-screen', sequence: 'departments', prompt: 'screen', refs: ['frame-desk', 'win95-boot'] },
  { key: 'frame-desk-off', sequence: 'departments', prompt: 'desk-off', refs: ['frame-desk'] },
  { key: 'frame-screen-off', sequence: 'departments', prompt: 'screen-off', refs: ['frame-screen'] },
  { key: 'frame-studio-empty', sequence: 'departments', prompt: 'studio-empty', refs: ['frame-idle'] },
];

// Anchor blends (seconds): how long each clip eases from / into its exact anchor still.
// splice: the first reveal render duplicated the character after frame 89, so frames 0..at-1 are
// kept and the rest is re-generated starting from frame `at`.
// parts: rendered separately between anchor stills and joined on the shared still. The camera
// settles on the desk between the swing and the crash zoom, which reads as a deliberate beat.
// trim: seconds of the render to keep. focus: lens pulses added in the encode (see FOCUS_SIGMA).
const CLIPS = [
  { key: 'idle', sequence: 'projects', seconds: 4, first: 'frame-idle', last: 'frame-idle', head: 0.5, tail: 0.5, loop: true },
  {
    key: 'reveal', sequence: 'projects', seconds: 8, first: 'frame-idle', last: 'frame-board', head: 0.3, tail: 0.5,
    splice: { key: 'reveal-b', at: 86, seconds: 5 },
  },
  { key: 'return', sequence: 'projects', seconds: 8, first: 'frame-board', last: 'frame-idle', head: 0.3, tail: 0.6 },
  {
    key: 'departments', sequence: 'departments',
    parts: [
      { key: 'departments-a', seconds: 5, first: 'frame-idle', last: 'frame-desk', head: 0.3, tail: 0.35 },
      {
        // The render lands the zoom at ~1.6 s and then holds; the lens hunts for focus right after
        // landing and the screen hands over to the desktop soon after it is sharp.
        key: 'departments-b', seconds: 4, first: 'frame-desk', last: 'frame-screen', head: 0.12, tail: 0.5,
        trim: 3, focus: [[1.7, 0.16, 1], [1.98, 0.11, 0.55], [2.18, 0.07, 0.25]],
      },
    ],
  },
  {
    key: 'departments-return', sequence: 'departments',
    parts: [
      { key: 'departments-return-a', seconds: 3, first: 'frame-screen-off', last: 'frame-desk-off', head: 0.3, tail: 0.25 },
      { key: 'departments-return-b', seconds: 3, first: 'frame-desk-off', last: 'frame-studio-empty', head: 0.2, tail: 0.3 },
      { key: 'departments-return-c', seconds: 4, first: 'frame-studio-empty', last: 'frame-idle', head: 0.3, tail: 0.6 },
    ],
  },
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
const SEQUENCES = new Set(args.sequence ? String(args.sequence).split(',') : ['projects', 'departments']);
const DRY = Boolean(args['dry-run']);

const stills = STILLS.filter((s) => SEQUENCES.has(s.sequence));
const clips = CLIPS.filter((c) => SEQUENCES.has(c.sequence));

for (const dir of [GEN, RAW, PROCESSED, OUT]) mkdirSync(dir, { recursive: true });

const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, 'utf8'))
  : { jobs: {}, uploads: {} };
const saveManifest = () => writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');

const log = (...parts) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const fileFor = (name) => path.join(GEN, `${name}.png`);
const anchorFile = (name) => SOURCES[name] ?? fileFor(name);

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

// Uploads an anchor, or stands in for one that a dry run hasn't generated yet.
async function uploadAnchor(name) {
  const file = anchorFile(name);
  if (existsSync(file)) return upload(file);
  if (DRY) return `dry-run://${path.basename(file)}`;
  throw new Error(`Missing anchor ${path.relative(ROOT, file)} — run the frames step first.`);
}

// A missing anchor that was uploaded before is restored byte-exact from its newest upload (checked
// against the recorded hash) instead of being generated and paid for again. Older uploads of the
// same file are never used: they hold an earlier version the clips weren't made from.
async function restoreFromUpload(file) {
  const target = path.resolve(file);
  const [newest] = Object.entries(manifest.uploads)
    .filter(([, entry]) => path.resolve(ROOT, entry.file.replaceAll('\\', '/')) === target)
    .sort(([, a], [, b]) => b.at - a.at);
  if (!newest) return false;
  const [hash, entry] = newest;
  try {
    const res = await fetch(entry.url);
    if (!res.ok) return false;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (sha256(bytes) !== hash) return false;
    writeFileSync(file, bytes);
    log(`restored ${path.relative(ROOT, file)} from its last upload`);
    return true;
  } catch {
    return false; // expired or unreachable: generate it instead
  }
}

// Prices a request without submitting it. The price doesn't depend on the images, so dry-run
// placeholders are swapped for a syntactically valid URL.
let estimatedCredits = 0;
async function estimate(endpoint, input) {
  const priced = JSON.parse(
    JSON.stringify(input, (_, value) =>
      typeof value === 'string' && value.startsWith('dry-run://') ? `https://example.com/${value.slice(10)}` : value,
    ),
  );
  try {
    const res = await api('POST', `estimate/${endpoint}`, priced);
    estimatedCredits += Number(res.credits) || 0;
    return `≈ ${res.credits} credits / $${res.usd}`;
  } catch (err) {
    return `no estimate: ${err.message.slice(0, 120)}`;
  }
}

const TERMINAL = new Set(['completed', 'failed', 'nsfw', 'canceled', 'cancelled']);

// Submits (or resumes) one generation and returns its output URL.
async function generate(key, endpoint, input) {
  let job = manifest.jobs[key];
  const reusable = job && job.endpoint === endpoint && !FORCE.has(key) && !['failed', 'nsfw', 'canceled', 'cancelled'].includes(job.status);

  if (!reusable) {
    if (DRY) {
      log(`[dry-run] would submit ${key} → ${endpoint} (${await estimate(endpoint, input)})`);
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
// Step 1: anchor stills
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
  if (!FORCE.has('frame-idle') && (await restoreFromUpload(out))) return out;

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

// One generated anchor still (see STILLS), stored at master size.
async function still({ key, prompt, refs }) {
  const out = fileFor(key);
  if (existsSync(out) && !FORCE.has(key)) return out;
  if (!FORCE.has(key) && (await restoreFromUpload(out))) return out;

  const imageUrls = [];
  for (const ref of refs) imageUrls.push(await uploadAnchor(ref));
  const raw = await generatedImage(key, {
    prompt: PROMPTS[prompt],
    image_urls: imageUrls,
    aspect_ratio: '16:9',
    resolution: '4k',
    quality: 'high',
    enhance_prompt: false,
  });
  if (!raw) return null;
  await sharp(raw).resize(MASTER.width, MASTER.height, { fit: 'cover' }).removeAlpha().png().toFile(out);
  log(`wrote ${path.relative(ROOT, out)} (${MASTER.width}×${MASTER.height})`);
  return out;
}

function extension(url, fallback) {
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  return ext && ext.length <= 5 ? ext : fallback;
}

// ---------------------------------------------------------------------------------------------
// Step 2: videos
// ---------------------------------------------------------------------------------------------

async function videos() {
  // A clip with parts is generated as its parts.
  const renders = clips.flatMap((clip) => clip.parts ?? [clip]);
  const urls = {};
  for (const name of new Set(renders.flatMap((r) => [r.first, r.last]))) urls[name] = await uploadAnchor(name);

  const results = await Promise.allSettled(
    renders.map(async (render) => {
      const raw = path.join(RAW, `${render.key}.mp4`);
      if (existsSync(raw) && !FORCE.has(render.key)) return raw;
      const url = await generate(render.key, VIDEO_ENDPOINT, {
        prompt: PROMPTS[render.key],
        image_url: urls[render.first],
        last_image_url: urls[render.last],
        duration: render.seconds,
        sound: 'off',
      });
      return url ? download(url, raw) : null;
    }),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  for (const f of failed) console.error(`✗ ${f.reason.message}`);
  if (failed.length) throw new Error(`${failed.length} video(s) failed; finished ones are cached — re-run to retry.`);

  for (const clip of clips.filter((c) => c.splice)) {
    const { key, seconds } = clip.splice;
    const raw = path.join(RAW, `${key}.mp4`);
    if (existsSync(raw) && !FORCE.has(key)) continue;
    if (DRY && !existsSync(path.join(RAW, `${clip.key}.mp4`))) {
      log(`[dry-run] would splice ${key} into ${clip.key} once ${clip.key} exists`);
      continue;
    }
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
// Step 3: anchor + encode
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
// - The per-pixel expression is slow at 4K, so every blend is `enable`d only for the frames
//   where its weight isn't zero; everywhere else the clip passes through untouched.
const blendExpr = (weight) => {
  const w = `clip(${weight},0,1)`;
  return `A+(B-A)*${w}*${w}*(3-2*${w})`;
};

// Lens pulses: each [center s, half-width s, strength 0..1] eases the picture into a blurred copy of
// itself and back along a smooth bump, which reads as the lens hunting for focus.
const FOCUS_SIGMA = 18;
const focusExpr = (pulses) => {
  const weight = pulses.map(([at, width, strength]) => `${strength}*pow(max(0,1-pow((T-${at})/${width},2)),2)`).join('+');
  return `A+(B-A)*clip(${weight},0,1)`;
};
const focusSpan = (pulses) =>
  `between(t,${Math.min(...pulses.map(([at, width]) => at - width)).toFixed(3)},${Math.max(...pulses.map(([at, width]) => at + width)).toFixed(3)})`;

// An anchor still at master size, re-made whenever its source is newer.
async function masterStill(name) {
  const { width, height } = MASTER;
  const source = anchorFile(name);
  const file = path.join(PROCESSED, `${name}-${width}x${height}.png`);
  if (!existsSync(file) || statSync(file).mtimeMs < statSync(source).mtimeMs) {
    await sharp(source).resize(width, height, { fit: 'cover' }).png().toFile(file);
  }
  return file;
}

// Eases the first `head` and last `tail` seconds of a clip onto its exact anchor stills, after
// trimming it and adding its focus pulses.
async function pin(source, spec, out) {
  const { width: sw, height: sh, fps, frames: rendered } = await probe(source);
  const count = spec.trim ? Math.min(rendered, Math.round(spec.trim * fps)) : rendered;
  const lastIndex = count - 1;
  const head = Math.max(1, Math.round(spec.head * fps));
  const tail = Math.max(1, Math.round(spec.tail * fps));
  const still = (i) => `[${i}:v]fps=${fps},setpts=PTS-STARTPTS,format=yuv444p,setsar=1[s${i}]`;
  const at = (frame) => (frame / fps).toFixed(6);
  const trim = count < rendered ? `trim=end_frame=${count},` : '';
  const video = spec.focus
    ? [
        `[0:v]fps=${fps},${trim}setpts=PTS-STARTPTS,${NORMALIZE},split[sharp][soft]`,
        `[soft]gblur=sigma=${FOCUS_SIGMA}:enable='${focusSpan(spec.focus)}'[blurred]`,
        `[sharp][blurred]blend=all_expr='${focusExpr(spec.focus)}':enable='${focusSpan(spec.focus)}'[v]`,
      ]
    : [`[0:v]fps=${fps},${trim}setpts=PTS-STARTPTS,${NORMALIZE}[v]`];

  log(`${spec.key}: ${sw}×${sh} @ ${fps} fps, ${count < rendered ? `${count} of ${rendered}` : count} frames → pinning ${head}+${tail} frames to anchors${spec.focus ? `, ${spec.focus.length} focus pulses` : ''}`);
  await ffmpeg([
    '-i', source,
    '-loop', '1', '-framerate', String(fps), '-i', await masterStill(spec.first),
    '-loop', '1', '-framerate', String(fps), '-i', await masterStill(spec.last),
    '-filter_complex', [
      ...video,
      still(1),
      still(2),
      `[v][s1]blend=all_expr='${blendExpr(`1-T/${at(head)}`)}':shortest=1:enable='lte(t,${at(head)})'[h]`,
      `[h][s2]blend=all_expr='${blendExpr(`(T-${at(lastIndex - tail)})/${at(tail)}+0.0001`)}':shortest=1:enable='gte(t,${at(lastIndex - tail)})'[t]`,
      // The loop's last frame equals its first, so drop it to avoid a one-frame stall at the seam.
      `[t]${spec.loop ? `trim=end_frame=${lastIndex},setpts=PTS-STARTPTS,` : ''}format=yuv420p[out]`,
    ].join(';'),
    '-map', '[out]', '-an',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '12',
    out,
  ]);
  return out;
}

// Joins pinned parts. Each part ends on the exact still the next one starts on, so that
// duplicate frame is dropped at every seam.
async function join(pieces, out) {
  const infos = [];
  for (const piece of pieces) infos.push(await probe(piece));
  const fps = infos[0].fps;
  const chains = pieces.map((_, i) => {
    const trim = i < pieces.length - 1 ? `trim=end_frame=${infos[i].frames - 1},` : '';
    return `[${i}:v]${trim}fps=${fps},setpts=PTS-STARTPTS,setsar=1[p${i}]`;
  });
  const inputs = pieces.map((_, i) => `[p${i}]`).join('');
  await ffmpeg([
    ...pieces.flatMap((piece) => ['-i', piece]),
    '-filter_complex', [...chains, `${inputs}concat=n=${pieces.length}:v=1:a=0,format=yuv420p[out]`].join(';'),
    '-map', '[out]', '-an', '-c:v', 'libx264', '-preset', 'medium', '-crf', '12',
    out,
  ]);
  log(`joined ${pieces.map((p) => path.basename(p)).join(' + ')} → ${path.relative(ROOT, out)}`);
  return out;
}

async function webVariants(key, master) {
  const variants = {
    landscape: 'scale=1920:1080:flags=lanczos',
    portrait: 'crop=trunc(ih*9/32)*2:ih,scale=1080:1920:flags=lanczos',
  };
  for (const [variant, filter] of Object.entries(variants)) {
    const base = path.join(OUT, `${key}-${variant}`);
    await ffmpeg(['-i', master, '-vf', filter, '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', `${base}.mp4`]);
    await ffmpeg(['-i', master, '-vf', filter, '-an',
      '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
      '-pix_fmt', 'yuv420p', `${base}.webm`]);
    log(`wrote public/videos/${key}-${variant}.{mp4,webm}`);
  }
}

// Writes one frame of a master clip as a web JPEG ('last' or a frame index).
async function frameJpeg(master, index, file, { width, height, quality }) {
  const frame = index === 'last' ? (await probe(master)).frames - 1 : index;
  const tmp = path.join(PROCESSED, `${path.basename(file, '.jpg')}-frame.png`);
  await ffmpeg(['-i', master, '-vf', `select=eq(n\\,${frame})`, '-vsync', '0', '-frames:v', '1', tmp]);
  await sharp(tmp).resize(width, height, { fit: 'cover' }).jpeg({ quality, mozjpeg: true }).toFile(file);
  rmSync(tmp);
}

async function encode() {
  const master = (key) => path.join(PROCESSED, `${key}-master.mp4`);
  const rawSource = (key) => {
    const file = path.join(RAW, `${key}.mp4`);
    if (!existsSync(file)) throw new Error(`Missing ${path.relative(ROOT, file)} — run the videos step first.`);
    return file;
  };

  const encoded = clips.filter((clip) => !ONLY_CLIPS || ONLY_CLIPS.has(clip.key));
  for (const clip of encoded) {
    if (clip.parts) {
      const pieces = [];
      for (const part of clip.parts) {
        pieces.push(await pin(rawSource(part.key), part, path.join(PROCESSED, `${part.key}-pinned.mp4`)));
      }
      await join(pieces, master(clip.key));
    } else {
      let source = rawSource(clip.key);
      if (clip.splice) source = await splicedSource(clip, (await probe(source)).fps);
      await pin(source, clip, master(clip.key));
    }
    await webVariants(clip.key, master(clip.key));
  }

  if (encoded.some((clip) => clip.sequence === 'projects')) {
    // Poster frames: the idle anchor, full frame and the centered portrait crop.
    const idle = fileFor('frame-idle');
    await sharp(idle).resize(1920, 1080, { fit: 'cover' }).jpeg({ quality: 84, mozjpeg: true })
      .toFile(path.join(OUT, 'idle-poster-landscape.jpg'));
    const { width: iw, height: ih } = await sharp(idle).metadata();
    const pw = Math.round((ih * 9) / 16 / 2) * 2;
    await sharp(idle).extract({ left: Math.round((iw - pw) / 2), top: 0, width: pw, height: ih })
      .jpeg({ quality: 84, mozjpeg: true }).toFile(path.join(OUT, 'idle-poster-portrait.jpg'));

    // board-end.jpg is the reveal's actual last frame; the Three.js board is built on it.
    await frameJpeg(master('reveal'), 'last', path.join(OUT, 'board-end.jpg'), { width: 2560, height: 1440, quality: 90 });
    log('wrote public/videos/idle-poster-*.jpg and board-end.jpg');
  }

  if (encoded.some((clip) => clip.sequence === 'departments')) {
    // screen-end.jpg: the reveal's last frame (the CRT with the start-up screen), shown instead of
    // the clip without motion. screen-off.jpg: the return's first frame, its poster.
    const size = { width: 1920, height: 1080, quality: 86 };
    const stillsFrom = [
      ['departments', 'last', 'screen-end.jpg'],
      ['departments-return', 0, 'screen-off.jpg'],
    ];
    for (const [key, frame, name] of stillsFrom) {
      if (!existsSync(master(key))) {
        log(`skipped ${name}: ${key} has not been encoded yet`);
        continue;
      }
      await frameJpeg(master(key), frame, path.join(OUT, name), size);
      log(`wrote public/videos/${name}`);
    }
  }
}

// ---------------------------------------------------------------------------------------------

async function main() {
  const unknown = [...SEQUENCES].filter((name) => !CLIPS.some((c) => c.sequence === name));
  if (unknown.length) throw new Error(`Unknown sequence ${unknown.join(', ')} — use projects and/or departments.`);
  if (!existsSync(REFERENCE)) throw new Error(`Missing reference photo at ${path.relative(ROOT, REFERENCE)}`);
  for (const [name, file] of Object.entries(SOURCES)) {
    if (stills.some((s) => s.refs.includes(name)) && !existsSync(file)) {
      throw new Error(`Missing source image ${path.relative(ROOT, file)}`);
    }
  }

  // Stills run in order: each one may use the ones before it as references.
  if (ONLY.has('frames')) {
    await frameIdle();
    for (const spec of stills) await still(spec);
  }
  const haveFrames = ['frame-idle', ...stills.map((s) => s.key)].every((name) => existsSync(fileFor(name)));

  if (ONLY.has('videos')) {
    if (!haveFrames && !DRY) throw new Error('Anchor stills are missing — run the frames step first.');
    await videos();
  }
  if (ONLY.has('encode') && !DRY) {
    if (!haveFrames) throw new Error('Anchor stills are missing — run the frames step first.');
    await encode();
  }
  log(DRY
    ? `dry run finished — nothing was submitted. Estimated cost: ≈ ${estimatedCredits.toFixed(2)} credits.`
    : 'done.');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}`);
  process.exit(1);
});
