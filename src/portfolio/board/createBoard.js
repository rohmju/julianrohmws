// The Projects board: the reveal's last frame as the slate, five WANTED posters on brass pins,
// chalk dust in the light, and the hold-to-inspect / click-to-flip / hold-to-hang-back flow.
//
// Framing: the board image is a 16×9 plane at z = 0, and the camera reproduces the exact crop the
// reveal clip shows (SOURCE_RECT + object-fit: cover), so the crossfade from video to WebGL is
// seamless. No tone mapping is used anywhere, so the slate renders with the photo's exact colors.

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { BOARD_IMAGE, BOARD_SIZE, SOURCE_RECT } from '../lib/media.js'
import { normalMapFrom } from './paper.js'
import { PIN_Y, POSTER_ASPECT, drawPosterBack, drawPosterFront, drawShadow, loadPosterFonts } from './posterArt.js'

const FOV = 30
const HOLD_MS = 600
const HOLD_SHOW_MS = 140 // the ring appears only once a press is clearly not a click
const TAP_SLOP = 9 // px of movement that turns a press into a drag
const POSTER_W = 2.4
const POSTER_H = POSTER_W * POSTER_ASPECT
const PIN_DROP = POSTER_H * PIN_Y // pin hole below the poster's top edge
const HANG = POSTER_H / 2 - PIN_DROP // pin → poster center
const SLATE = { x: 7.4, y: 4.0 } // chalkboard surface inside the wooden frame, world units
const GAP = 2.95
const AMPLITUDE = 0.95
const TILTS = [-0.045, 0.03, -0.018, 0.04, -0.03]

const clamp01 = (x) => Math.min(1, Math.max(0, x))
const lerp = (a, b, t) => a + (b - a) * t
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)
const easeIn = (t) => t * t * t
const easeOutBack = (t, s = 1.25) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2)
const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0))

// Slightly under-damped spring: fluid, interruptible hover motion.
class Spring {
  constructor(stiffness = 170, damping = 22) {
    this.value = 0
    this.target = 0
    this.velocity = 0
    this.k = stiffness
    this.d = damping
  }
  update(dt) {
    const force = -this.k * (this.value - this.target) - this.d * this.velocity
    this.velocity += force * dt
    this.value += this.velocity * dt
  }
}

// ---------------------------------------------------------------------------------------------
// Shaders

const FULLSCREEN_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const COPY_FRAGMENT = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    // 4-tap box filter for a clean downsample.
    vec3 c = texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(1.0, -1.0)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
    c += texture2D(tMap, vUv + uTexel * vec2(1.0, 1.0)).rgb;
    gl_FragColor = vec4(c * 0.25, 1.0);
  }
`

const BLUR_FRAGMENT = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uDirection;
  varying vec2 vUv;
  void main() {
    // 9-tap gaussian using linear sampling (5 fetches).
    vec3 c = texture2D(tMap, vUv).rgb * 0.2270270270;
    c += texture2D(tMap, vUv + uDirection * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tMap, vUv - uDirection * 1.3846153846).rgb * 0.3162162162;
    c += texture2D(tMap, vUv + uDirection * 3.2307692308).rgb * 0.0702702703;
    c += texture2D(tMap, vUv - uDirection * 3.2307692308).rgb * 0.0702702703;
    gl_FragColor = vec4(c, 1.0);
  }
`

const COMPOSITE_FRAGMENT = /* glsl */ `
  uniform sampler2D tSharp;
  uniform sampler2D tBlur;
  uniform float uDof;
  uniform float uAspect;
  varying vec2 vUv;
  void main() {
    float k = smoothstep(0.0, 1.0, uDof);
    vec3 col = mix(texture2D(tSharp, vUv).rgb, texture2D(tBlur, vUv).rgb, clamp(k * 1.5, 0.0, 1.0));
    // The inspection overlay: warm, dimmed, darker toward the edges.
    vec2 q = vUv - 0.5;
    q.x *= uAspect;
    float vignette = smoothstep(1.0, 0.18, length(q));
    vec3 tinted = col * vec3(0.98, 0.9, 0.78) * mix(0.26, 0.52, vignette);
    col = mix(col, tinted, k * 0.92);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`

const DUST_VERTEX = /* glsl */ `
  attribute vec4 aSeed;
  uniform float uTime;
  uniform float uProjection;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime * (0.25 + aSeed.z * 0.5);
    p.x += sin(t * 0.37 + aSeed.x * 6.283) * 0.35 + sin(t * 0.91 + aSeed.y * 6.283) * 0.08;
    p.y = mod(p.y - uTime * (0.02 + aSeed.z * 0.05) + 4.5, 9.0) - 4.5;
    p.z += sin(t * 0.23 + aSeed.y * 6.283) * 0.25;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = mix(0.008, 0.03, aSeed.w * aSeed.w);
    gl_PointSize = max(1.0, size * uProjection / -mv.z);
    // Brightest inside the key light's pool (upper left of center on the slate).
    float pool = 1.0 - smoothstep(0.15, 1.0, length((p.xy - vec2(-0.9, 1.4)) / vec2(8.5, 5.5)));
    float twinkle = 0.65 + 0.35 * sin(uTime * (0.6 + aSeed.w) + aSeed.y * 40.0);
    vAlpha = pool * twinkle * (0.35 + 0.65 * aSeed.x);
  }
`

const DUST_FRAGMENT = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vec3(0.93, 0.9, 0.84), a * vAlpha * uOpacity * 0.55);
    #include <colorspace_fragment>
  }
`

const PUFF_VERTEX = /* glsl */ `
  attribute vec3 aVelocity;
  attribute float aBirth;
  uniform float uTime;
  uniform float uProjection;
  varying float vAlpha;
  void main() {
    float age = uTime - aBirth;
    float life = 1.6;
    vec3 p = position + aVelocity * (1.0 - exp(-age * 2.2)) / 2.2 + vec3(0.0, -0.06 * age * age, 0.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float alive = step(0.0, age) * step(age, life);
    gl_PointSize = alive * max(1.0, (0.02 + age * 0.03) * uProjection / -mv.z);
    vAlpha = alive * (1.0 - age / life) * 0.5;
  }
`

// ---------------------------------------------------------------------------------------------

function loadTexture(renderer, url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
        resolve(texture)
      },
      undefined,
      reject,
    )
  })
}

function canvasTexture(renderer, canvas, color = true) {
  const texture = new THREE.CanvasTexture(canvas)
  if (color) texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  return texture
}

// A sheet that isn't quite flat: pinned at the top, gently waved, edges curling off the slate.
function posterGeometry(seed) {
  const geometry = new THREE.PlaneGeometry(POSTER_W, POSTER_H, 20, 28)
  const position = geometry.attributes.position
  const phase = (seed % 97) * 0.37
  for (let i = 0; i < position.count; i++) {
    const u = position.getX(i) / POSTER_W + 0.5
    const v = position.getY(i) / POSTER_H + 0.5
    const fromPin = Math.hypot((u - 0.5) * POSTER_W, (1 - PIN_Y - v) * POSTER_H) / POSTER_H
    const free = clamp01(fromPin * 1.8)
    let z = Math.sin(u * 5.1 + phase) * Math.cos(v * 3.7 + phase * 0.7) * 0.012
    z += Math.pow(1 - v, 3) * 0.055 * (0.6 + 0.4 * Math.sin(u * Math.PI))
    z += Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.028
    position.setZ(i, z * free)
  }
  geometry.computeVertexNormals()
  return geometry
}

function pinGeometry() {
  const r = 0.068
  const profile = []
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2)
    profile.push(new THREE.Vector2(Math.sin(a) * r, Math.cos(a) * r * 0.5 + 0.012))
  }
  profile.push(new THREE.Vector2(r * 1.02, 0.004), new THREE.Vector2(r * 0.2, 0))
  const geometry = new THREE.LatheGeometry(profile, 28)
  geometry.rotateX(Math.PI / 2) // lathe axis Y → board normal Z
  return geometry
}

function blurredDot() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 64
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(0,0,0,0.85)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return canvas
}

// ---------------------------------------------------------------------------------------------

export async function createBoard({ container, projects, variant, reducedMotion, ui }) {
  const disposables = new Set()
  const track = (item) => {
    disposables.add(item)
    return item
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  renderer.setPixelRatio(pixelRatio)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.NoToneMapping
  renderer.setClearColor(0x0b0c0e, 1)
  renderer.autoClear = false
  const canvas = renderer.domElement
  canvas.className = 'pf-board__gl'
  container.appendChild(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100)

  const pmrem = new THREE.PMREMGenerator(renderer)
  const environment = track(pmrem.fromScene(new RoomEnvironment(), 0.04).texture)
  pmrem.dispose()
  scene.environment = environment
  scene.environmentIntensity = 0.35

  // Key light matched to the slate's light pool (upper left of center), cool fill from above.
  const hemi = new THREE.HemisphereLight(0x9fb2c4, 0x1b1712, 0.45)
  const key = new THREE.SpotLight(0xf3e7d2, 2.25, 0, 0.5, 1, 0)
  key.position.set(-4.2, 6.2, 13)
  key.target.position.set(-0.9, 1.4, 0)
  scene.add(hemi, key, key.target)
  hemi.layers.enableAll()
  key.layers.enableAll()

  // --- Slate -----------------------------------------------------------------------------------
  const [boardTexture] = await Promise.all([loadTexture(renderer, BOARD_IMAGE), loadPosterFonts()])
  track(boardTexture)
  const board = new THREE.Mesh(
    track(new THREE.PlaneGeometry(BOARD_SIZE.width, BOARD_SIZE.height)),
    track(new THREE.MeshBasicMaterial({ map: boardTexture })),
  )
  scene.add(board)

  // --- Dust ------------------------------------------------------------------------------------
  const dustCount = window.innerWidth < 700 ? 220 : 480
  const dustGeometry = track(new THREE.BufferGeometry())
  {
    const positions = new Float32Array(dustCount * 3)
    const seeds = new Float32Array(dustCount * 4)
    for (let i = 0; i < dustCount; i++) {
      positions.set([(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 9, 0.15 + Math.random() * 3.6], i * 3)
      seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4))
  }
  const dustMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uProjection: { value: 1 } },
    vertexShader: DUST_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }))
  const dust = new THREE.Points(dustGeometry, dustMaterial)
  dust.frustumCulled = false
  scene.add(dust)

  // Chalk puff when a poster is hung back on its pin.
  const PUFF = 72
  const puffGeometry = track(new THREE.BufferGeometry())
  puffGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUFF * 3), 3))
  puffGeometry.setAttribute('aVelocity', new THREE.BufferAttribute(new Float32Array(PUFF * 3), 3))
  puffGeometry.setAttribute('aBirth', new THREE.BufferAttribute(new Float32Array(PUFF).fill(-100), 1))
  const puffMaterial = track(new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uProjection: { value: 1 }, uOpacity: { value: 1 } },
    vertexShader: PUFF_VERTEX,
    fragmentShader: DUST_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }))
  const puff = new THREE.Points(puffGeometry, puffMaterial)
  puff.frustumCulled = false
  scene.add(puff)
  let puffCursor = 0
  function spawnPuff(x, y, time) {
    const pos = puffGeometry.attributes.position
    const vel = puffGeometry.attributes.aVelocity
    const birth = puffGeometry.attributes.aBirth
    for (let n = 0; n < 24; n++) {
      const i = puffCursor++ % PUFF
      const a = Math.random() * Math.PI * 2
      pos.setXYZ(i, x + (Math.random() - 0.5) * 0.25, y + (Math.random() - 0.5) * 0.12, 0.05)
      vel.setXYZ(i, Math.cos(a) * 0.35 * Math.random(), -0.05 + Math.random() * 0.25, 0.15 + Math.random() * 0.35)
      birth.setX(i, time + Math.random() * 0.08)
    }
    pos.needsUpdate = vel.needsUpdate = birth.needsUpdate = true
  }

  // --- Posters ---------------------------------------------------------------------------------
  const texWidth = Math.min(window.innerWidth, window.innerHeight) * pixelRatio >= 900 ? 1024 : 768
  const pinGeo = track(pinGeometry())
  const shadowGeo = track(new THREE.PlaneGeometry(1, 1))
  const dotTexture = track(canvasTexture(renderer, blurredDot(), false))
  const posters = []

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i]
    const seed = 1009 + i * 7919
    const front = await drawPosterFront(project, i, { width: texWidth, seed })
    await nextTask() // keep the reveal video smooth while the paper is generated

    const frontMap = track(canvasTexture(renderer, front.canvas))
    const normalMap = track(canvasTexture(renderer, normalMapFrom(front.sheet.heightMap), false))
    const geometry = track(posterGeometry(seed))
    const frontMaterial = track(new THREE.MeshStandardMaterial({
      map: frontMap,
      normalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughness: 0.93,
      metalness: 0,
      alphaTest: 0.5,
      alphaToCoverage: true,
      envMapIntensity: 0.12,
      side: THREE.FrontSide,
    }))
    const backMaterial = track(frontMaterial.clone())
    backMaterial.side = THREE.BackSide
    backMaterial.map = frontMap // replaced by the real back as soon as it is drawn
    const frontMesh = new THREE.Mesh(geometry, frontMaterial)
    const backMesh = new THREE.Mesh(geometry, backMaterial)
    frontMesh.userData.poster = backMesh.userData.poster = i

    const root = new THREE.Group()
    const hinge = new THREE.Group()
    const center = new THREE.Group()
    const turn = new THREE.Group()
    center.position.y = -HANG
    turn.add(frontMesh, backMesh)
    center.add(turn)
    hinge.add(center)
    root.add(hinge)
    root.visible = false
    scene.add(root)

    const shadowInfo = drawShadow(front.sheet)
    const shadowMaterial = track(new THREE.MeshBasicMaterial({
      map: track(canvasTexture(renderer, shadowInfo.canvas, false)),
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }))
    const shadow = new THREE.Mesh(shadowGeo, shadowMaterial)
    shadow.renderOrder = 1
    scene.add(shadow)

    const brass = new THREE.Color().setHSL(0.1 + (Math.random() - 0.5) * 0.02, 0.45, 0.32 + Math.random() * 0.06)
    const pinMaterial = track(new THREE.MeshStandardMaterial({ color: brass, metalness: 0.9, roughness: 0.36 }))
    const pin = new THREE.Mesh(pinGeo, pinMaterial)
    pin.scale.setScalar(0.001)
    const pinShadowMaterial = track(new THREE.MeshBasicMaterial({ map: dotTexture, transparent: true, opacity: 0, depthWrite: false }))
    const pinShadow = new THREE.Mesh(shadowGeo, pinShadowMaterial)
    scene.add(pin, pinShadow)

    posters.push({
      index: i,
      project,
      front,
      back: null,
      backMaterial,
      meshes: [frontMesh, backMesh],
      root, hinge, center, turn, shadow, shadowPad: shadowInfo.pad, pin, pinShadow,
      slot: { x: 0, y: 0, scale: 1, rot: TILTS[i % TILTS.length] },
      lift: new Spring(),
      lean: new Spring(120, 18),
      settle: new Spring(90, 9),
      unroll: 0,
      pinScale: 0,
      flip: 0, // 0 = front, 1 = back
      mode: 'home', // home | flyOut | inspect | flyBack
      flight: null,
      flipAnim: null,
    })
  }

  // Draw the backs when the browser is idle, so the first flip doesn't stall.
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200))
  const cancelIdle = window.cancelIdleCallback || clearTimeout
  let idleHandle = null
  function ensureBack(p) {
    if (p.back) return
    p.back = drawPosterBack(p.project, p.index, p.front)
    const map = track(canvasTexture(renderer, p.back.canvas))
    p.backMaterial.map = map
    p.backMaterial.needsUpdate = true
  }
  function drawBacksLater(i = 0) {
    if (i >= posters.length || disposed) return
    idleHandle = idle(() => {
      ensureBack(posters[i])
      drawBacksLater(i + 1)
    })
  }

  // --- Post-processing (depth of field while inspecting) ----------------------------------------
  const rtOptions = { type: THREE.HalfFloatType, depthBuffer: false }
  const rtSharp = track(new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }))
  const rtA = track(new THREE.WebGLRenderTarget(1, 1, rtOptions))
  const rtB = track(new THREE.WebGLRenderTarget(1, 1, rtOptions))
  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const quadGeometry = track(new THREE.BufferGeometry())
  quadGeometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3))
  quadGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2))
  const quad = new THREE.Mesh(quadGeometry)
  quad.frustumCulled = false
  const quadScene = new THREE.Scene()
  quadScene.add(quad)
  const copyMaterial = track(new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: FULLSCREEN_VERTEX, fragmentShader: COPY_FRAGMENT, depthTest: false, depthWrite: false,
  }))
  const blurMaterial = track(new THREE.ShaderMaterial({
    uniforms: { tMap: { value: null }, uDirection: { value: new THREE.Vector2() } },
    vertexShader: FULLSCREEN_VERTEX, fragmentShader: BLUR_FRAGMENT, depthTest: false, depthWrite: false,
  }))
  const compositeMaterial = track(new THREE.ShaderMaterial({
    uniforms: { tSharp: { value: rtSharp.texture }, tBlur: { value: rtA.texture }, uDof: { value: 0 }, uAspect: { value: 1 } },
    vertexShader: FULLSCREEN_VERTEX, fragmentShader: COMPOSITE_FRAGMENT, depthTest: false, depthWrite: false,
  }))
  function pass(material, target) {
    quad.material = material
    renderer.setRenderTarget(target)
    renderer.render(quadScene, quadCamera)
  }

  // --- View + layout -----------------------------------------------------------------------------
  const view = { width: 1, height: 1, aspect: 1, visW: 16, visH: 9, distance: 10, panLimit: 0, pans: false }
  let panX = 0
  let panVelocity = 0

  function resize() {
    const width = Math.max(1, container.clientWidth)
    const height = Math.max(1, container.clientHeight)
    renderer.setSize(width, height, false)
    const aspect = width / height
    // Cover-fit the viewport into the region the clip variant shows (same as the <video>).
    const src = SOURCE_RECT[variant]
    let visH = src.height
    let visW = visH * aspect
    if (visW > src.width) {
      visW = src.width
      visH = visW / aspect
    }
    const tan = Math.tan((FOV * Math.PI) / 360)
    Object.assign(view, { width, height, aspect, visW, visH, distance: visH / 2 / tan })
    camera.aspect = aspect
    camera.updateProjectionMatrix()

    const buffer = renderer.getDrawingBufferSize(new THREE.Vector2())
    rtSharp.setSize(buffer.x, buffer.y)
    const qw = Math.max(1, Math.round(buffer.x / 4))
    const qh = Math.max(1, Math.round(buffer.y / 4))
    rtA.setSize(qw, qh)
    rtB.setSize(qw, qh)
    copyMaterial.uniforms.uTexel.value.set(1 / buffer.x, 1 / buffer.y)
    compositeMaterial.uniforms.uAspect.value = aspect
    const projection = buffer.y / (2 * tan)
    dustMaterial.uniforms.uProjection.value = projection
    puffMaterial.uniforms.uProjection.value = projection

    layout()
  }

  // Zigzag across the slate. Wide screens fit all five; narrow screens keep full-size posters and
  // let the board pan sideways.
  function layout() {
    const usableH = Math.min(view.visH, SLATE.y * 2) - 1.6
    const natural = { w: 4 * GAP + POSTER_W, h: POSTER_H + 2 * AMPLITUDE }
    view.pans = view.visW < 9
    let scale
    if (view.pans) {
      scale = Math.min(1, usableH / natural.h, (view.visW - 0.6) / (POSTER_W + 0.3))
      view.panLimit = Math.min(BOARD_SIZE.width / 2 - view.visW / 2, 2 * GAP * scale)
    } else {
      const usableW = Math.min(view.visW, SLATE.x * 2) - 0.6
      scale = Math.min(1, usableW / natural.w, usableH / natural.h)
      view.panLimit = 0
    }
    panX = Math.max(-view.panLimit, Math.min(view.panLimit, panX))
    posters.forEach((p, i) => {
      const x = (i - (posters.length - 1) / 2) * GAP * scale
      const centerY = (i % 2 === 0 ? AMPLITUDE : -AMPLITUDE) * scale
      // The slot is the pin; the poster hangs below it.
      p.slot.x = x
      p.slot.y = centerY + HANG * scale
      p.slot.scale = scale
    })
  }

  // --- State ---------------------------------------------------------------------------------------
  let disposed = false
  let state = 'hidden' // hidden | entering | board | busy | inspect | leaving
  let active = null // poster being inspected
  let dof = 0
  let dustOpacity = 0
  let dustTarget = 0
  const clock = { start: performance.now(), now: 0 }
  const pointer = { x: 0, y: 0, ndc: new THREE.Vector2(), inside: false }
  let press = null
  const raycaster = new THREE.Raycaster()

  function emitState() {
    ui.state?.({
      mode: state === 'inspect' ? 'inspect' : state === 'board' ? 'board' : 'busy',
      side: active && active.flip > 0.5 ? 'back' : 'front',
      index: active ? active.index : null,
      pans: view.pans,
      hasLink: Boolean(active?.back?.button),
    })
  }

  function inspectRootPosition() {
    const tan = Math.tan((FOV * Math.PI) / 360)
    const byHeight = POSTER_H / (0.78 * 2 * tan)
    const byWidth = POSTER_W / (0.84 * 2 * tan * view.aspect)
    const distance = Math.max(byHeight, byWidth)
    return new THREE.Vector3(camera.position.x, HANG, view.distance - distance)
  }

  function homePose(p) {
    return { position: new THREE.Vector3(p.slot.x, p.slot.y, 0.012), rotZ: p.slot.rot, scale: p.slot.scale }
  }

  function startFlight(p, kind, duration) {
    const from = { position: p.root.position.clone(), rotZ: p.root.rotation.z, scale: p.root.scale.x, flip: p.flip }
    p.flight = { kind, from, t0: clock.now, duration: reducedMotion ? Math.min(duration, 0.28) : duration }
  }

  function inspect(index) {
    if (state !== 'board' || disposed) return
    const p = posters[index]
    active = p
    state = 'busy'
    p.mode = 'flyOut'
    p.lift.target = 0
    p.meshes.forEach((m) => m.layers.set(1))
    startFlight(p, 'out', 1.05)
    emitState()
    ui.hold?.(null)
  }

  function hangBack() {
    if (state !== 'inspect' || !active) return
    const p = active
    if (p.flipAnim) {
      p.flip = p.flipAnim.to
      p.flipAnim = null
      p.turn.position.z = 0
    }
    state = 'busy'
    p.mode = 'flyBack'
    startFlight(p, 'back', 0.95)
    emitState()
    ui.hold?.(null)
  }

  function flip() {
    if (state !== 'inspect' || !active || active.flipAnim) return
    const p = active
    if (p.flip < 0.5) ensureBack(p)
    p.flipAnim = { from: p.flip, to: p.flip < 0.5 ? 1 : 0, t0: clock.now, duration: reducedMotion ? 0.3 : 0.8 }
  }

  function onFlightDone(p) {
    const kind = p.flight.kind
    p.flight = null
    if (kind === 'out') {
      p.mode = 'inspect'
      state = 'inspect'
    } else {
      p.mode = 'home'
      p.flip = 0
      p.meshes.forEach((m) => m.layers.set(0))
      p.settle.velocity = reducedMotion ? 0 : -0.9 // a small swing as it settles on the pin
      if (!reducedMotion) spawnPuff(p.slot.x, p.slot.y - 0.05, clock.now)
      active = null
      state = 'board'
    }
    emitState()
  }

  // --- Pointer -----------------------------------------------------------------------------------
  function toPointer(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = event.clientX - rect.left
    pointer.y = event.clientY - rect.top
    pointer.ndc.set((pointer.x / rect.width) * 2 - 1, -(pointer.y / rect.height) * 2 + 1)
  }

  function hit(layer) {
    camera.layers.set(layer)
    raycaster.layers.set(layer)
    raycaster.setFromCamera(pointer.ndc, camera)
    const meshes = posters.flatMap((p) => p.meshes)
    const found = raycaster.intersectObjects(meshes, false)[0]
    return found ? { poster: posters[found.object.userData.poster], uv: found.uv } : null
  }

  let hovered = null
  function setHovered(p) {
    if (hovered === p) return
    if (hovered) hovered.lift.target = 0
    hovered = p
    if (p) p.lift.target = 1
    canvas.style.cursor = p ? 'pointer' : view.pans ? 'grab' : ''
  }

  function onPointerDown(event) {
    if (event.button !== 0 || state === 'hidden' || state === 'entering' || state === 'leaving') return
    toPointer(event)
    canvas.setPointerCapture(event.pointerId)
    const target = state === 'board' ? hit(0)?.poster ?? null : state === 'inspect' ? active : null
    press = {
      id: event.pointerId,
      type: event.pointerType,
      x: pointer.x,
      y: pointer.y,
      lastX: pointer.x,
      t0: performance.now(),
      target,
      moved: false,
      done: false,
      panning: state === 'board' && view.pans,
    }
    if (target && state === 'board') setHovered(target)
    panVelocity = 0
  }

  function onPointerMove(event) {
    toPointer(event)
    pointer.inside = true
    if (press && press.id === event.pointerId) {
      if (Math.hypot(pointer.x - press.x, pointer.y - press.y) > TAP_SLOP) press.moved = true
      if (press.moved && press.panning) {
        const worldPerPixel = view.visW / view.width
        const dx = (pointer.x - press.lastX) * worldPerPixel
        panX = Math.max(-view.panLimit, Math.min(view.panLimit, panX - dx))
        panVelocity = -dx / (1 / 60)
        canvas.style.cursor = 'grabbing'
        if (hovered && press.type === 'touch') setHovered(null)
      }
      press.lastX = pointer.x
      if (press.moved) ui.hold?.(null)
      return
    }
    if (state === 'board' && event.pointerType !== 'touch') setHovered(hit(0)?.poster ?? null)
  }

  function onPointerUp(event) {
    if (!press || press.id !== event.pointerId) return
    const p = press
    press = null
    ui.hold?.(null)
    if (p.done || p.moved) {
      if (p.type === 'touch') setHovered(null)
      else if (state === 'board') setHovered(hit(0)?.poster ?? null)
      return
    }
    if (state === 'board') {
      if (p.target) ui.nudge?.('board') // a quick tap: remind that it's press-and-hold
      if (p.type === 'touch') setTimeout(() => state === 'board' && setHovered(null), 350)
    } else if (state === 'inspect') {
      const found = hit(1)
      if (!found) {
        ui.nudge?.('inspect')
        return
      }
      // A click on the back's link button opens the project; anywhere else flips the poster.
      const button = active.flip > 0.5 ? active.back?.button : null
      if (button && found.uv) {
        const { width, height } = active.front.sheet
        const x = (1 - found.uv.x) * width
        const y = (1 - found.uv.y) * height
        if (x >= button.x && x <= button.x + button.w && y >= button.y && y <= button.y + button.h) {
          window.open(active.project.link.url, '_blank', 'noopener,noreferrer')
          return
        }
      }
      flip()
    }
  }

  function onPointerCancel(event) {
    if (press && press.id === event.pointerId) press = null
    ui.hold?.(null)
  }

  function onPointerLeave(event) {
    pointer.inside = false
    if (event.pointerType !== 'touch' && !press) setHovered(null)
  }

  function updateHold() {
    if (!press || press.done || press.moved) return
    const holdable = (state === 'board' && press.target) || state === 'inspect'
    if (!holdable) return
    const elapsed = performance.now() - press.t0
    const progress = clamp01((elapsed - HOLD_SHOW_MS * 0.5) / (HOLD_MS - HOLD_SHOW_MS * 0.5))
    ui.hold?.(elapsed > HOLD_SHOW_MS ? { x: press.x, y: press.y, progress, mode: state === 'inspect' ? 'back' : 'inspect' } : null)
    if (elapsed >= HOLD_MS) {
      press.done = true
      ui.hold?.(null)
      if (state === 'board') inspect(press.target.index)
      else hangBack()
    }
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  canvas.style.touchAction = 'none'

  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(container)
  resize()

  // --- Frame loop --------------------------------------------------------------------------------
  let raf = 0
  let last = performance.now()
  const tmp = new THREE.Vector3()

  function updatePoster(p, dt) {
    p.lift.update(dt)
    p.lean.update(dt)
    p.settle.update(dt)
    const home = homePose(p)
    let flightProgress = 0

    if (p.flight) {
      const f = p.flight
      const t = clamp01((clock.now - f.t0) / f.duration)
      const e = easeInOut(t)
      const target = f.kind === 'out'
        ? { position: inspectRootPosition(), rotZ: 0, scale: 1 }
        : home
      p.root.position.lerpVectors(f.from.position, target.position, e)
      p.root.position.z += Math.sin(Math.PI * t) * (reducedMotion ? 0 : 0.9)
      p.root.rotation.z = lerp(f.from.rotZ, target.rotZ, e)
      p.root.scale.setScalar(lerp(f.from.scale, target.scale, e))
      // Peel off the pin on the way out; ease back flat on the way home.
      const peel = reducedMotion ? 0 : Math.sin(Math.PI * Math.min(1, t * 1.4)) * (f.kind === 'out' ? -0.32 : -0.18)
      p.hinge.rotation.x = peel
      // A poster showing its back keeps turning the same way until the front faces out again.
      if (f.kind === 'back') p.turn.rotation.y = lerp(f.from.flip * Math.PI, f.from.flip > 0.5 ? Math.PI * 2 : 0, e)
      dof = f.kind === 'out' ? e : 1 - e
      flightProgress = f.kind === 'out' ? e : 1 - e
      if (t >= 1) onFlightDone(p)
    } else if (p.mode === 'inspect') {
      const target = inspectRootPosition()
      const time = clock.now
      p.root.position.set(target.x, target.y + (reducedMotion ? 0 : Math.sin(time * 0.9) * 0.025), target.z)
      p.root.rotation.z = reducedMotion ? 0 : Math.sin(time * 0.6) * 0.006
      p.root.scale.setScalar(1)
      p.hinge.rotation.x = 0
      flightProgress = 1
      dof = 1
    } else {
      // At home on the board: hover lifts the bottom off the slate, straightens the tilt a little
      // and leans slightly toward the pointer.
      const lift = p.lift.value
      p.root.position.set(home.position.x, home.position.y, home.position.z + lift * 0.015)
      p.root.rotation.z = home.rotZ * (1 - lift * 0.5)
      p.root.scale.setScalar(home.scale * (1 + lift * 0.018))
      p.hinge.rotation.x = -0.09 * lift + p.settle.value * 0.12
      if (p === hovered && pointer.inside) {
        tmp.set(home.position.x, home.position.y - HANG * home.scale, 0).project(camera)
        p.lean.target = Math.max(-1, Math.min(1, (pointer.ndc.x - tmp.x) * 4))
      } else {
        p.lean.target = 0
      }
    }

    // Flip + inspection tilt toward the pointer.
    if (p.flipAnim) {
      const a = p.flipAnim
      const t = clamp01((clock.now - a.t0) / a.duration)
      const e = easeInOut(t)
      p.flip = lerp(a.from, a.to, e)
      p.turn.position.z = reducedMotion ? 0 : Math.sin(Math.PI * t) * 0.45
      if (t >= 1) {
        p.flip = a.to
        p.flipAnim = null
        p.turn.position.z = 0
        emitState()
      }
    }
    if (!p.flight || p.flight.kind !== 'back') {
      const tiltX = p.mode === 'inspect' && pointer.inside && !reducedMotion ? -pointer.ndc.y * 0.07 : 0
      const tiltY = p.mode === 'inspect' && pointer.inside && !reducedMotion ? pointer.ndc.x * 0.1 : p.lean.value * 0.05
      p.turn.rotation.x = lerp(p.turn.rotation.x, tiltX, 0.08)
      p.turn.rotation.y = p.flip * Math.PI + tiltY
    }

    // Entrance / exit: the sheet unrolls downward from its pin.
    p.hinge.scale.y = Math.max(0.001, p.unroll)
    p.root.visible = p.unroll > 0.002

    // Contact shadow: grows softer and fainter as the sheet leaves the slate.
    const lift = p.lift.value + p.settle.value * 0.3
    const away = flightProgress
    const s = home.scale / (1 - 2 * p.shadowPad)
    const theta = home.rotZ
    const cx = home.position.x + Math.sin(theta) * HANG * home.scale
    const cy = home.position.y - Math.cos(theta) * HANG * home.scale
    p.shadow.position.set(cx + (0.07 + lift * 0.07 + away * 0.4) * home.scale, cy - (0.1 + lift * 0.1 + away * 0.5) * home.scale, 0.004)
    p.shadow.rotation.z = theta
    p.shadow.scale.set(POSTER_W * s * (1 + lift * 0.05 + away * 0.25), POSTER_H * s * p.unroll * (1 + lift * 0.05 + away * 0.25), 1)
    p.shadow.material.opacity = 0.62 * (1 - lift * 0.35) * (1 - away) * Math.min(1, p.unroll * 1.4)

    p.pin.position.set(p.slot.x, p.slot.y, 0.045)
    p.pin.scale.setScalar(Math.max(0.001, p.pinScale * home.scale))
    p.pinShadow.position.set(p.slot.x + 0.035 * home.scale, p.slot.y - 0.05 * home.scale, 0.006)
    p.pinShadow.scale.setScalar(0.24 * home.scale * p.pinScale)
    p.pinShadow.material.opacity = 0.7 * p.pinScale
  }

  function render() {
    renderer.setRenderTarget(null)
    renderer.clear()
    if (dof < 0.002) {
      camera.layers.set(0)
      camera.layers.enable(1)
      renderer.render(scene, camera)
      return
    }
    // Background (slate, other posters, dust) → blurred; the inspected poster → sharp on top.
    camera.layers.set(0)
    renderer.setRenderTarget(rtSharp)
    renderer.clear()
    renderer.render(scene, camera)
    copyMaterial.uniforms.tMap.value = rtSharp.texture
    pass(copyMaterial, rtA)
    // Many narrow passes: wide tap spacing would smear small highlights (the pins) into a lattice.
    const radius = 1.3 * easeOut(dof)
    for (let i = 0; i < 5; i++) {
      blurMaterial.uniforms.tMap.value = rtA.texture
      blurMaterial.uniforms.uDirection.value.set(radius / rtA.width, 0)
      pass(blurMaterial, rtB)
      blurMaterial.uniforms.tMap.value = rtB.texture
      blurMaterial.uniforms.uDirection.value.set(0, radius / rtA.height)
      pass(blurMaterial, rtA)
    }
    compositeMaterial.uniforms.uDof.value = dof
    pass(compositeMaterial, null)
    renderer.clearDepth()
    camera.layers.set(1)
    renderer.render(scene, camera)
  }

  function frame(now) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    clock.now = (now - clock.start) / 1000

    // Inertial pan on narrow screens.
    if (!press?.panning || !press.moved) {
      panX += panVelocity * dt
      panVelocity *= Math.pow(0.02, dt)
      if (Math.abs(panVelocity) < 0.01) panVelocity = 0
      panX = Math.max(-view.panLimit, Math.min(view.panLimit, panX))
    }
    camera.position.set(panX, 0, view.distance)

    dofIdle()
    posters.forEach((p) => updatePoster(p, dt))
    updateHold()

    dustOpacity += (dustTarget - dustOpacity) * Math.min(1, dt * 1.2)
    dustMaterial.uniforms.uOpacity.value = dustOpacity
    dustMaterial.uniforms.uTime.value = reducedMotion ? 0 : clock.now
    puffMaterial.uniforms.uTime.value = clock.now
    render()
  }
  function dofIdle() {
    if (!active) dof = Math.max(0, dof - 0.08)
  }

  function onVisibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf)
      raf = 0
    } else if (!raf && !disposed) {
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  // First frame (bare slate) before the page crossfades into it.
  camera.position.set(0, 0, view.distance)
  renderer.compile(scene, camera)
  render()
  raf = requestAnimationFrame(frame)

  // --- Public API ----------------------------------------------------------------------------------
  function animate(duration, step) {
    return new Promise((resolve) => {
      const t0 = performance.now()
      const tick = (now) => {
        if (disposed) return resolve()
        const t = clamp01((now - t0) / (duration * 1000))
        step(t)
        if (t < 1) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })
  }

  async function enter() {
    if (state !== 'hidden') return
    state = 'entering'
    dustTarget = 1
    if (reducedMotion) {
      posters.forEach((p) => {
        p.unroll = 1
        p.pinScale = 1
      })
    } else {
      await Promise.all(posters.map((p, i) => (async () => {
        await new Promise((r) => setTimeout(r, i * 110))
        await animate(0.22, (t) => { p.pinScale = easeOutBack(t, 1.7) })
        await animate(0.75, (t) => { p.unroll = easeOutBack(t, 1.15) })
      })()))
    }
    state = 'board'
    emitState()
    drawBacksLater()
  }

  async function exit() {
    if (state === 'inspect') hangBack()
    while (state === 'busy' && !disposed) await new Promise((r) => setTimeout(r, 30))
    state = 'leaving'
    setHovered(null)
    dustTarget = 0
    emitState()
    if (reducedMotion) {
      posters.forEach((p) => {
        p.unroll = 0
        p.pinScale = 0
      })
      return
    }
    // Roll up right to left, pins last: the slate ends bare, like the return clip's first frame.
    await Promise.all([...posters].reverse().map((p, i) => (async () => {
      await new Promise((r) => setTimeout(r, i * 70))
      await animate(0.38, (t) => { p.unroll = 1 - easeIn(t) })
      await animate(0.16, (t) => { p.pinScale = 1 - easeIn(t) })
    })()))
    // Glide back to the centered framing the return clip starts from.
    const fromPan = panX
    panVelocity = 0
    if (Math.abs(fromPan) > 0.001) await animate(0.4, (t) => { panX = fromPan * (1 - easeInOut(t)) })
  }

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(raf)
    if (idleHandle) cancelIdle(idleHandle)
    document.removeEventListener('visibilitychange', onVisibility)
    resizeObserver.disconnect()
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerCancel)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    for (const item of disposables) item.dispose()
    disposables.clear()
    scene.clear()
    renderer.dispose()
    renderer.forceContextLoss()
    canvas.remove()
  }

  return {
    enter,
    exit,
    dispose,
    inspect: (index) => inspect(index),
    flip,
    hangBack,
    get state() {
      return state
    },
  }
}
