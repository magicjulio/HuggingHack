// Ch2 Step 7 post effect: the flashback look, the memory layer and the poison spread, as ONE pmndrs `postprocessing` Effect
// (the app's library, 6.39.x). Imports: three + postprocessing only. Put it in its own EffectPass AFTER bloom + tone mapping.
//   uFlashback     0..1  soft, desaturated, blurred + vignetted edges, faint grain, a little haze ("if you know you know")
//   uMemory        texture (sRGB PNG still: the Gate, the Ch1 desk); uMemoryMix 0..1 = how much of it covers the frame
//   uMemoryZoom    vec3 (cx, cy, scale): slow push-in on the still, centre in still uv, scale >= 1
//   uPoison        0..1  dark green spreads out from uPoisonOrigin across the frame and stays; the void turns green-black
//   uPoisonOrigin  vec2 in screen uv (0..1, y up): where it starts (the orb on screen)
//   uCut           0..1  hard-cut flash (1 on the cut frame, decay it fast): sharp, full colour, a white kick
// The flashback blurs the memory with the scene, so stills and world read as one remembered image.
import * as THREE from 'three';
import { Effect, EffectAttribute, BlendFunction } from 'postprocessing';

export const FLASHBACK_FRAG = /* glsl */`
uniform float uFlashback, uMemoryMix, uPoison, uCut, uTime;
uniform sampler2D uMemory;
uniform vec3 uMemoryZoom;
uniform vec2 uPoisonOrigin, uMemorySize;

float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h12(i), h12(i+vec2(1,0)), f.x), mix(h12(i+vec2(0,1)), h12(i+vec2(1,1)), f.x), f.y); }

// the memory still, scaled to cover the frame (like CSS object-fit: cover), then pushed in
vec2 memUv(vec2 uv){
  float fa = resolution.x/resolution.y, ma = uMemorySize.x/uMemorySize.y;
  vec2 q = uv - .5; if (fa > ma) q.y *= ma/fa; else q.x *= fa/ma;
  return uMemoryZoom.xy + q/uMemoryZoom.z;
}
vec3 frameAt(vec2 uv){
  vec3 s = texture2D(inputBuffer, uv).rgb;
  if (uMemoryMix <= 0.) return s;
  vec3 m = texture2D(uMemory, memUv(uv)).rgb;
  return mix(s, m, uMemoryMix);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  float f = uFlashback;
  vec2 c = uv - .5; c.x *= aspect;
  float edge = smoothstep(.25, .85, length(c));
  vec3 col = frameAt(uv);
  // flashback: blur that grows toward the edges (13 taps on a golden spiral)
  if (f > .001) {
    float r = mix(1.2, 9., edge) * f;
    vec3 acc = col; float w = 1.;
    for (int i = 1; i < 13; i++) { float fi = float(i), a = fi*2.39996, d = sqrt(fi/12.); vec2 o = vec2(cos(a), sin(a))*d*r*texelSize; acc += frameAt(uv + o); w += 1.; }
    vec3 blur = acc / w;
    col = mix(col, blur, clamp(.35 + edge, 0., 1.) * f);
    float l = dot(col, vec3(.2126, .7152, .0722));
    col = mix(col, vec3(l) * vec3(1.02, 1., .96), .72 * f);           // desaturate, a touch warm
    col = mix(col, blur * .35 + col, .25 * f);                        // soft glow (halation)
    col = col * (1. - .12*f) + vec3(.012, .014, .016) * f;            // lifted blacks: haze
    col *= 1. - .62 * f * smoothstep(.35, 1.05, length(c));           // vignette
    col += (h12(uv*resolution + fract(uTime*7.)*391.) - .5) * .045 * f; // grain
  }
  // poison: a dark-green front grows out of the origin with ragged tendrils, then holds the whole frame
  if (uPoison > .001) {
    vec2 p = uv - uPoisonOrigin; p.x *= aspect;
    float d = length(p), ang = atan(p.y, p.x);
    float rag = n2(vec2(ang*3., d*4. - uTime*.3))*.22 + n2(vec2(ang*9., d*10.))*.08;
    float R = uPoison * uPoison * 2.2;                                  // slow start, then it races out
    float inside = 1. - smoothstep(R - .05, R + .08, d + rag * min(1., R*2.));
    float front = inside * (1. - smoothstep(0., .12, R - d - rag*.5)) * step(.001, R) * (1. - smoothstep(.85, 1., uPoison));
    float l = dot(col, vec3(.2126, .7152, .0722));
    vec3 deep = vec3(.0015, .0085, .0035), body = vec3(.006, .045, .016);   // #04150b, #0f3d22 in linear
    vec3 sick = deep + body * smoothstep(0., .06, l) + col * vec3(.28, .62, .34) * smoothstep(.02, .5, l); // brights survive, sick and green
    col = mix(col, sick, inside * .88);
    col += vec3(.04, .30, .11) * front * .9;                            // the advancing edge, #2fa85a-ish
  }
  // hard cut back to the present: sharp, full colour, a white kick
  col = col + uCut * (.35 + col * .8);
  outputColor = vec4(max(col, 0.), inputColor.a);
}`;

const BLACK = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); BLACK.needsUpdate = true;

export class FlashbackEffect extends Effect {
  constructor() {
    super('FlashbackEffect', FLASHBACK_FRAG, {
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.SRC,
      uniforms: new Map([
        ['uFlashback', new THREE.Uniform(0)], ['uMemoryMix', new THREE.Uniform(0)], ['uPoison', new THREE.Uniform(0)], ['uCut', new THREE.Uniform(0)], ['uTime', new THREE.Uniform(0)],
        ['uMemory', new THREE.Uniform(BLACK)], ['uMemoryZoom', new THREE.Uniform(new THREE.Vector3(.5, .5, 1))], ['uMemorySize', new THREE.Uniform(new THREE.Vector2(16, 9))],
        ['uPoisonOrigin', new THREE.Uniform(new THREE.Vector2(.5, .5))],
      ]),
    });
  }
  // a still for the memory layer (sRGB colour space, its pixel size for the cover fit)
  setMemory(tex) { const u = this.uniforms; u.get('uMemory').value = tex ?? BLACK; if (tex?.image) u.get('uMemorySize').value.set(tex.image.width, tex.image.height); }
}
