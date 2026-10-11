/**
 * Text label in the 3D world, drawn to a canvas texture with the game's own fonts
 * (no network font loading). Always faces the camera (sprite).
 */
import { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

export interface Label3DProps {
  text: string;
  position: [number, number, number];
  color?: string;
  /** World height of the text in metres. */
  size?: number;
  opacity?: number;
}

export function Label3D({
  text,
  position,
  color = '#d7e6ff',
  size = 0.16,
  opacity = 1,
}: Label3DProps) {
  const { texture, aspect } = useMemo(() => {
    const font = `700 64px "Chakra Petch", system-ui, sans-serif`;
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 32;
    c.width = w;
    c.height = 96;
    const tex = new CanvasTexture(c);
    tex.colorSpace = SRGBColorSpace;
    const draw = () => {
      g.clearRect(0, 0, c.width, c.height);
      g.font = font;
      g.textBaseline = 'middle';
      g.shadowColor = color;
      g.shadowBlur = 12;
      g.fillStyle = color;
      g.fillText(text, 16, 50);
      tex.needsUpdate = true;
    };
    draw();
    // redraw once the webfont is ready (first frame may use the fallback font)
    document.fonts?.load(font).then(draw, () => {});
    return { texture: tex, aspect: w / 96 };
  }, [text, color]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <sprite position={position} scale={[size * aspect * 1.5, size * 1.5, 1]}>
      <spriteMaterial
        map={texture}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </sprite>
  );
}
