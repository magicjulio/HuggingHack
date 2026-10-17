import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";

// Renderer + bloom + a light grade (vignette, warm/cool split, damage tint).
// Bloom runs at half resolution and only lifts emissives above ~1.0.
export function createRenderer(canvasEl, { pixelRatio = 1.5, exposure = 1.1, bloom = true } = {}) {
  const renderer = new THREE.WebGLRenderer({
    canvas: canvasEl,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, pixelRatio));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  let composer = null,
    bloomPass = null,
    grade = null,
    renderPass = null;
  if (bloom) {
    composer = new EffectComposer(
      renderer,
      new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
    );
    renderPass = new RenderPass(null, null);
    composer.addPass(renderPass);
    bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.4, 1.0);
    composer.addPass(bloomPass);
    grade = new ShaderPass({
      uniforms: {
        tDiffuse: { value: null },
        vignette: { value: 0.32 },
        hurt: { value: 0 },
        tint: { value: new THREE.Color(0xff2a1a) },
        aberration: { value: 0 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float vignette; uniform float hurt; uniform vec3 tint; uniform float aberration;
        varying vec2 vUv;
        void main(){
          vec2 d = vUv - 0.5;
          float r = length(d);
          vec2 off = d * aberration * 0.012;
          vec4 c = texture2D(tDiffuse, vUv);
          c.r = texture2D(tDiffuse, vUv + off).r;
          c.b = texture2D(tDiffuse, vUv - off).b;
          float v = smoothstep(0.85, 0.25, r * (1.0 + vignette));
          c.rgb *= mix(1.0, v, 0.85);
          c.rgb = mix(c.rgb, c.rgb * 0.6 + tint * 0.5, hurt * smoothstep(0.2, 0.75, r));
          gl_FragColor = c;
        }`,
    });
    composer.addPass(grade);
    composer.addPass(new OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  }
  return {
    renderer,
    composer,
    bloomPass,
    grade,
    render(scene, camera) {
      if (!composer) return renderer.render(scene, camera);
      renderPass.scene = scene;
      renderPass.camera = camera;
      composer.render();
    },
    resize() {
      renderer.setSize(innerWidth, innerHeight);
      if (composer) {
        composer.setSize(innerWidth, innerHeight);
        bloomPass.resolution.set(innerWidth / 2, innerHeight / 2);
      }
    },
  };
}
