/** External engineer (Codex): designer film effect, early GPU warm-up and adaptive quality. */
import { useEffect, useMemo, useRef, useContext } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, useTexture } from '@react-three/drei';
import {
  Bloom,
  EffectComposer,
  EffectComposerContext,
  EffectGroup,
  ToneMapping,
} from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { SRGBColorSpace, Vector2, Vector3, type Texture } from 'three';
import { useCh2Store } from './context';
import { FIXED_QUALITY, MEMORY_URLS, QUALITY, type QualityTier } from './presentation';
import { FlashbackEffect } from './world/fxFlashback.js';
import { direct } from './world/step7.js';
import { isDebug } from '../../ui/DebugPanel';

function FilmEffect({ orbPosition, textures }: { orbPosition: Vector3; textures: Texture[] }) {
  const store = useCh2Store();
  const { gl, scene, camera } = useThree();
  const { composer } = useContext(EffectComposerContext);
  const effect = useMemo(() => new FlashbackEffect(), []);
  const projected = useMemo(() => new Vector3(), []);
  const warm = useRef(false);
  useEffect(() => {
    warm.current = false;
  }, [composer]);

  useEffect(() => {
    if (!import.meta.env.DEV && !isDebug()) return;
    const debug = { gl, scene, camera, composer, effect, warmed: () => warm.current };
    const w = window as unknown as { __ch2render?: typeof debug };
    w.__ch2render = debug;
    return () => {
      if (w.__ch2render === debug) delete w.__ch2render;
    };
  }, [gl, scene, camera, composer, effect]);

  useEffect(() => {
    for (const texture of textures) {
      // useTexture eagerly uploads its cache; changing colour space requires a fresh upload.
      if (texture.colorSpace !== SRGBColorSpace) {
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
      }
      gl.initTexture(texture);
    }
    return () => effect.dispose();
  }, [effect, gl, textures]);

  useFrame(() => {
    const s = store.getState();
    const post = s.phase === 'cutscene' || s.phase === 'ended' ? direct(s.cutT).post : null;
    const u = effect.uniforms;
    effect.setMemory(textures[post?.still === 'desk' ? 1 : 0]);
    (u.get('uMemoryZoom')!.value as Vector3).fromArray(post?.zoom ?? [0.5, 0.5, 1]);
    u.get('uFlashback')!.value = post?.flashback ?? 0;
    u.get('uMemoryMix')!.value = post?.mix ?? 0;
    u.get('uCut')!.value = post?.cut ?? 0;
    u.get('uPoison')!.value = post?.poison ?? (s.poisoned ? 1 : 0);
    u.get('uTime')!.value = s.time + s.cutT;
    projected.copy(orbPosition).project(camera);
    (u.get('uPoisonOrigin')!.value as Vector2).set((projected.x + 1) / 2, (projected.y + 1) / 2);

    if (
      !warm.current &&
      scene.getObjectByName('playerOrb') &&
      scene.getObjectByName('forge') &&
      composer.passes.length >= 4
    ) {
      warm.current = true;
      // Compile world materials and render the full effect chain into its own buffers before
      // the film. No warm-up frame goes to the screen. Stills were uploaded above.
      void gl.compileAsync(scene, camera);
      const screen = composer.passes.map((p) => p.renderToScreen);
      const target = gl.getRenderTarget();
      try {
        composer.passes.forEach((p) => {
          p.renderToScreen = false;
        });
        const memory = u.get('uMemoryMix')!.value;
        const flashback = u.get('uFlashback')!.value;
        u.get('uMemoryMix')!.value = 1;
        u.get('uFlashback')!.value = 1;
        composer.render(0);
        u.get('uMemoryMix')!.value = memory;
        u.get('uFlashback')!.value = flashback;
      } finally {
        composer.passes.forEach((p, i) => {
          p.renderToScreen = screen[i];
        });
        gl.setRenderTarget(target);
      }
    }
  });

  // Dedicated pass AFTER bloom + AgX; convolution must not be merged with those effects.
  return (
    <EffectGroup>
      <primitive object={effect} dispose={null} />
    </EffectGroup>
  );
}

/** 60 fps target: remove MSAA first, then reduce resolution. Retain the tier for this run. */
export function Rendering({
  orbPosition,
  bloom,
  tier,
  onTier,
}: {
  orbPosition: Vector3;
  bloom: boolean;
  tier: QualityTier;
  onTier: React.Dispatch<React.SetStateAction<QualityTier>>;
}) {
  // Load before the composer mounts, so suspension cannot tear down already mounted Html roots.
  const textures = useTexture([MEMORY_URLS.gate, MEMORY_URLS.desk]);
  const { gl } = useThree();
  const q = QUALITY[tier];
  useEffect(() => {
    gl.domElement.dataset.quality = tier;
  }, [gl, tier]);
  return (
    <>
      {!FIXED_QUALITY && (
        <PerformanceMonitor
          ms={500}
          iterations={4}
          threshold={0.5}
          // Do not re-enable a tier that already missed the budget during this chapter.
          // Otherwise mid → high → mid repeatedly reallocates buffers in the middle of the film.
          bounds={() => [tier === 'low' ? 0 : 59, Infinity]}
          onDecline={() => onTier((t) => (t === 'high' ? 'mid' : 'low'))}
        />
      )}
      {bloom && (
        <EffectComposer multisampling={q.msaa}>
          <EffectGroup>
            <Bloom mipmapBlur luminanceThreshold={1} intensity={1.1} radius={0.62} />
            <ToneMapping mode={ToneMappingMode.AGX} />
          </EffectGroup>
          <FilmEffect orbPosition={orbPosition} textures={textures} />
        </EffectComposer>
      )}
    </>
  );
}
