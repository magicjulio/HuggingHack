/**
 * Can this browser draw the game? Checked once, before the first level mounts: `none` = no WebGL 2
 * (three.js needs it), `software` = WebGL runs on the CPU (hardware acceleration off or the driver
 * blocklisted), which plays at a few frames per second.
 */
export type GpuStatus = 'ok' | 'software' | 'none';

const SOFTWARE = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

let status: GpuStatus | null = null;

export function gpuStatus(): GpuStatus {
  if (status) return status;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return (status = 'none');
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
  // automated test browsers may render on the CPU on purpose (E2E_SWIFTSHADER)
  status = SOFTWARE.test(renderer) && !navigator.webdriver ? 'software' : 'ok';
  gl.getExtension('WEBGL_lose_context')?.loseContext(); // free it: browsers cap live contexts
  return status;
}
