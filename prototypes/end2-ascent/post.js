import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FullScreenQuad } from "three/addons/postprocessing/Pass.js";

// Renderer + bloom + a light grade (vignette, warm/cool split, damage tint).
// Bloom runs at half resolution and only lifts emissives above ~1.0.
//
// Perf (2026-10-19): the default path renders the scene once into a 4× MSAA half-float
// target, runs the bloom mip chain from it, then does bloom-add + grade + tone mapping +
// sRGB in ONE full-screen pass to the canvas. Same maths as the classic EffectComposer chain,
// whose full-screen passes each wrote into 4× MSAA half-float targets (and resolved them):
// ~10 ms → ~1.5 ms of GPU at 1080p on the Iris Xe.
// Knobs (T.fx.msaa / T.fx.renderScale in main.js, or URL): ?msaa=0|2|4 (scene MSAA, 4 = the look so
// far), ?res=0.5..1 (render scale, 1 = full), ?post=classic (the old composer chain, for A/B).
const GRADE_UNIFORMS = () => ({
  vignette: { value: 0.32 },
  hurt: { value: 0 },
  tint: { value: new THREE.Color(0xff2a1a) },
  aberration: { value: 0 },
});
const GRADE_GLSL = `
  vec2 d = vUv - 0.5;
  float r = length(d);
  float v = smoothstep(0.85, 0.25, r * (1.0 + vignette));
  c.rgb *= mix(1.0, v, 0.85);
  c.rgb = mix(c.rgb, c.rgb * 0.6 + tint * 0.5, hurt * smoothstep(0.2, 0.75, r));`;

export function createRenderer(canvasEl, { pixelRatio = 1.5, exposure = 1.1, bloom = true, msaa: msaa0 = 4, renderScale = 1 } = {}) {
  const q = new URLSearchParams(location.search);
  const classic = q.get("post") === "classic";
  const msaa = Math.max(0, Math.min(8, Math.round(q.has("msaa") ? +q.get("msaa") || 0 : msaa0)));
  // render scale (?res=0.5..1): draws fewer pixels and lets the browser upscale (softer image)
  const scale = THREE.MathUtils.clamp(q.has("res") ? +q.get("res") || 1 : renderScale, 0.5, 1);
  // With bloom on, the canvas only ever gets one full-screen pass: MSAA on it is wasted work.
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: !bloom || classic,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio) * scale);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  if (bloom && classic) return classicChain(renderer);
  if (!bloom)
    return {
      renderer,
      composer: null,
      bloomPass: null,
      grade: null,
      render: (scene, camera) => renderer.render(scene, camera),
      resize() {
        renderer.setSize(innerWidth, innerHeight);
      },
    };

  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: msaa });
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.4, 1.0);
  const final = new THREE.RawShaderMaterial({
    name: "FinalGradeOutput",
    uniforms: {
      tScene: { value: sceneRT.texture },
      tBloom: { value: bloomPass.renderTargetsHorizontal[0].texture },
      toneMappingExposure: { value: 1 },
      ...GRADE_UNIFORMS(),
    },
    vertexShader: `precision highp float;
      uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix;
      attribute vec3 position; attribute vec2 uv; varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `precision highp float;
      uniform sampler2D tScene; uniform sampler2D tBloom;
      uniform float vignette; uniform float hurt; uniform vec3 tint; uniform float aberration;
      #include <tonemapping_pars_fragment>
      #include <colorspace_pars_fragment>
      varying vec2 vUv;
      // the scene with the bloom added (what UnrealBloomPass's additive blend wrote back)
      vec4 lit(vec2 uv){ return texture2D(tScene, uv) + texture2D(tBloom, uv); }
      void main(){
        vec4 c = lit(vUv);
        if (aberration != 0.0) {
          vec2 off = (vUv - 0.5) * aberration * 0.012;
          c.r = lit(vUv + off).r;
          c.b = lit(vUv - off).b;
        }
        ${GRADE_GLSL}
        gl_FragColor = c;
        #ifdef ACES_FILMIC_TONE_MAPPING
          gl_FragColor.rgb = ACESFilmicToneMapping(gl_FragColor.rgb);
        #endif
        #ifdef SRGB_TRANSFER
          gl_FragColor = sRGBTransferOETF(gl_FragColor);
        #endif
      }`,
    depthTest: false,
    depthWrite: false,
  });
  final.defines = {};
  if (THREE.ColorManagement.getTransfer(renderer.outputColorSpace) === THREE.SRGBTransfer) final.defines.SRGB_TRANSFER = "";
  if (renderer.toneMapping === THREE.ACESFilmicToneMapping) final.defines.ACES_FILMIC_TONE_MAPPING = "";
  const quad = new FullScreenQuad(final);
  const grade = { uniforms: final.uniforms };
  const buf = new THREE.Vector2();
  const oldClear = new THREE.Color();
  function size() {
    renderer.getDrawingBufferSize(buf);
    sceneRT.setSize(buf.x, buf.y);
    bloomPass.setSize(buf.x, buf.y);
  }
  size();
  // UnrealBloomPass.render() minus its last step (the full-res additive blend back onto
  // the input): bright pass, the blurred mips, and the composite into renderTargetsHorizontal[0].
  function bloomMips() {
    const B = bloomPass,
      fs = B._fsQuad;
    renderer.getClearColor(oldClear);
    const oldAlpha = renderer.getClearAlpha();
    renderer.setClearColor(B.clearColor, 0);
    B.highPassUniforms.tDiffuse.value = sceneRT.texture;
    B.highPassUniforms.luminosityThreshold.value = B.threshold;
    fs.material = B.materialHighPassFilter;
    renderer.setRenderTarget(B.renderTargetBright);
    renderer.clear();
    fs.render(renderer);
    let input = B.renderTargetBright;
    for (let i = 0; i < B.nMips; i++) {
      const m = B.separableBlurMaterials[i];
      fs.material = m;
      m.uniforms.colorTexture.value = input.texture;
      m.uniforms.direction.value = UnrealBloomPass.BlurDirectionX;
      renderer.setRenderTarget(B.renderTargetsHorizontal[i]);
      renderer.clear();
      fs.render(renderer);
      m.uniforms.colorTexture.value = B.renderTargetsHorizontal[i].texture;
      m.uniforms.direction.value = UnrealBloomPass.BlurDirectionY;
      renderer.setRenderTarget(B.renderTargetsVertical[i]);
      renderer.clear();
      fs.render(renderer);
      input = B.renderTargetsVertical[i];
    }
    fs.material = B.compositeMaterial;
    B.compositeMaterial.uniforms.bloomStrength.value = B.strength;
    B.compositeMaterial.uniforms.bloomRadius.value = B.radius;
    B.compositeMaterial.uniforms.bloomTintColors.value = B.bloomTintColors;
    renderer.setRenderTarget(B.renderTargetsHorizontal[0]);
    renderer.clear();
    fs.render(renderer);
    renderer.setClearColor(oldClear, oldAlpha);
  }
  return {
    renderer,
    composer: null,
    bloomPass,
    grade,
    sceneTarget: sceneRT,
    render(scene, camera) {
      renderer.setRenderTarget(sceneRT);
      renderer.render(scene, camera);
      const autoClear = renderer.autoClear;
      renderer.autoClear = false;
      bloomMips();
      final.uniforms.toneMappingExposure.value = renderer.toneMappingExposure;
      renderer.setRenderTarget(null);
      quad.render(renderer);
      renderer.autoClear = autoClear;
    },
    resize() {
      renderer.setSize(innerWidth, innerHeight);
      size();
    },
  };
}

// The original chain (EffectComposer: RenderPass → UnrealBloom → grade → OutputPass), kept
// behind ?post=classic for A/B checks.
export function classicChain(renderer) {
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  const renderPass = new RenderPass(null, null);
  composer.addPass(renderPass);
  const bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.4, 1.0);
  composer.addPass(bloomPass);
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, ...GRADE_UNIFORMS() },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform float vignette; uniform float hurt; uniform vec3 tint; uniform float aberration;
      varying vec2 vUv;
      void main(){
        vec2 off = (vUv - 0.5) * aberration * 0.012;
        vec4 c = texture2D(tDiffuse, vUv);
        c.r = texture2D(tDiffuse, vUv + off).r;
        c.b = texture2D(tDiffuse, vUv - off).b;
        ${GRADE_GLSL}
        gl_FragColor = c;
      }`,
  });
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  return {
    renderer,
    composer,
    bloomPass,
    grade,
    render(scene, camera) {
      renderPass.scene = scene;
      renderPass.camera = camera;
      composer.render();
    },
    resize() {
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
      bloomPass.resolution.set(innerWidth / 2, innerHeight / 2);
    },
  };
}

// Perf (2026-10-19): three recomputes every object's world matrix each frame, hidden or not; on
// floor 3 about 1200 of the ~2000 objects sit in hidden subtrees (the approach armada, the other
// floors). This makes every container under `root` skip its subtree while it is hidden and
// recompute the whole subtree on the frame it shows again. getWorldPosition() & co. stay correct
// on hidden objects (they update their own parent chain). Containers added later are unaffected.
export function skipHiddenMatrices(root) {
  const base = THREE.Object3D.prototype.updateMatrixWorld;
  root.traverse((o) => {
    if (!o.children.length || o.isScene || o.__skipHidden) return;
    o.__skipHidden = true;
    let stale = false;
    o.updateMatrixWorld = function (force) {
      if (!this.visible) {
        stale = true;
        return;
      }
      if (stale) {
        stale = false;
        force = true;
      }
      base.call(this, force);
    };
  });
}
