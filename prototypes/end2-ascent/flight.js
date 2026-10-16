import * as THREE from "three";

// The approach owns this group only. Hide it to hand control to the ground game.
export function createFlight(scene, T) {
  const C = T.flight;
  const root = new THREE.Group();
  root.name = "armada-approach";
  root.visible = false;
  scene.add(root);
  const duration = C.duration ?? 34;
  const distance = duration * (C.speed ?? 70);
  const altitude = C.approachAltitude ?? 155;
  const landingY = C.landingAltitude ?? 7;
  const endZ = 38;
  const fleet = [],
    obstacles = [],
    lights = [];
  const materials = new Map();
  function material(color, glow = 0, roughness = 0.6) {
    const key = `${color}/${glow}/${roughness}`;
    if (!materials.has(key))
      materials.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          emissive: glow ? color : 0,
          emissiveIntensity: glow,
          roughness,
          metalness: 0.55,
        }),
      );
    return materials.get(key);
  }
  function box(parent, x, y, z, w, h, d, color, glow = 0) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      material(color, glow),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  const smooth = (t) => t * t * (3 - 2 * t);
  const baseY = (p) => landingY + (altitude - landingY) * (1 - smooth(p));
  const basic = (color) => new THREE.MeshBasicMaterial({ color });

  // The near façade is only a small part of a building which disappears into fog.
  box(root, 0, 1020, -220, 820, 2060, 400, 0x18252e);
  box(root, 0, 1350, -320, 500, 2700, 510, 0x1c2d36);
  box(root, -455, 730, -295, 150, 1480, 500, 0x20333d);
  box(root, 455, 940, -295, 150, 1900, 500, 0x20333d);
  for (let x = -375; x <= 375; x += 75) {
    box(root, x, 950, -13, 7, 1900, 24, 0x354c57);
    box(root, x + 4, 950, 1, 1.3, 1900, 1.5, 0x81c9bf, 0.7);
  }
  for (let y = 45; y < 1900; y += 65) {
    box(root, 0, y, -3, 805, 3, 18, 0x35434a);
    for (let x = -350; x <= 350; x += 35) {
      if (Math.sin(x * 3 + y) > -0.2)
        box(
          root,
          x,
          y + 12,
          -1,
          15,
          2,
          1,
          y % 3 === 0 ? 0xffcf73 : 0x8ac8cf,
          0.5,
        );
    }
  }
  box(root, 0, -10, 600, 1600, 14, 3000, 0x101a22);
  box(root, 0, -1, 145, 150, 7, 390, 0x2b3c44);
  box(root, 0, 22, 4, 64, 45, 8, 0x040b12);
  box(root, -34, 24, 10, 3, 48, 5, 0x9aefbc, 2);
  box(root, 34, 24, 10, 3, 48, 5, 0x9aefbc, 2);
  box(root, 0, 48, 10, 72, 3, 5, 0x9aefbc, 2);
  for (let z = 35; z < 320; z += 28) {
    box(root, -48, 3, z, 2, 0.3, 9, 0x9fff9c, 2);
    box(root, 48, 3, z, 2, 0.3, 9, 0x9fff9c, 2);
  }
  // Procedural mark: yellow smiling face, cheeks, hugging hands, readable at range.
  const logoCanvas = document.createElement("canvas");
  logoCanvas.width = logoCanvas.height = 512;
  const g = logoCanvas.getContext("2d");
  g.shadowColor = "#ffd359";
  g.shadowBlur = 30;
  g.fillStyle = "#ffd24a";
  g.beginPath();
  g.arc(256, 226, 161, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#4e342c";
  g.beginPath();
  g.ellipse(199, 207, 13, 19, -0.15, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(313, 207, 13, 19, 0.15, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 13;
  g.lineCap = "round";
  g.strokeStyle = "#4e342c";
  g.beginPath();
  g.arc(256, 224, 67, 0.15, Math.PI - 0.15);
  g.stroke();
  g.fillStyle = "#f4a643";
  g.beginPath();
  g.ellipse(157, 248, 27, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(355, 248, 27, 14, 0, 0, Math.PI * 2);
  g.fill();
  for (const side of [-1, 1]) {
    g.save();
    g.translate(256 + side * 130, 340);
    g.rotate(side * -0.6);
    g.fillStyle = "#ffdb63";
    g.strokeStyle = "#dfa933";
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(0, 0, 49, 37, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.roundRect(-43 + i * 22, -69 + Math.abs(i - 1.5) * 8, 20, 67, 10);
      g.fill();
      g.stroke();
    }
    g.restore();
  }
  const logoTexture = new THREE.CanvasTexture(logoCanvas);
  logoTexture.colorSpace = THREE.SRGBColorSpace;
  const logo = new THREE.Mesh(
    new THREE.PlaneGeometry(210, 210),
    new THREE.MeshBasicMaterial({
      map: logoTexture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  logo.position.set(0, 230, 15);
  root.add(logo);
  const signCanvas = document.createElement("canvas");
  signCanvas.width = 1024;
  signCanvas.height = 128;
  const sg = signCanvas.getContext("2d");
  sg.fillStyle = "#d1e6de";
  sg.textAlign = "center";
  sg.font = "700 68px sans-serif";
  sg.fillText("HUGGING FACE", 512, 85);
  const signTexture = new THREE.CanvasTexture(signCanvas);
  signTexture.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 27.5),
    new THREE.MeshBasicMaterial({
      map: signTexture,
      transparent: true,
      depthWrite: false,
    }),
  );
  sign.position.set(0, 116, 15);
  root.add(sign);

  // Buttresses and neighboring masses make scale visible before the tower emerges.
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? -1 : 1,
      z = 300 + Math.floor(i / 2) * 440;
    box(
      root,
      side * (210 + i * 17),
      30 + i * 8,
      z,
      70,
      80 + i * 18,
      150,
      0x1c303b,
    );
    box(root, side * (210 + i * 17), 75 + i * 15, z, 72, 2, 150, 0x3a6976, 0.3);
  }
  const hemisphere = new THREE.HemisphereLight(0xaccbdb, 0x101e27, 2.5);
  root.add(hemisphere);
  const keyLight = new THREE.DirectionalLight(0xd4eced, 3);
  keyLight.position.set(-100, 350, 200);
  root.add(keyLight);

  function ship(isPlayer = false) {
    const s = new THREE.Group(),
      color = isPlayer ? 0x879b91 : 0x3c5867;
    box(s, 0, 0, 0, 5, 2.3, 12, color);
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(3.1, 6, 4),
      material(color),
    );
    nose.rotation.x = -Math.PI / 2;
    nose.rotation.z = Math.PI / 4;
    nose.position.z = -8;
    s.add(nose);
    box(s, 0, 1.45, -2, 3.2, 1, 4.5, 0x111d25);
    box(s, 0, 2, -2, 2.7, 0.14, 3.4, isPlayer ? 0xb6ff6b : 0x92e6df, 1);
    box(s, 0, -0.25, 1, 18, 0.6, 4.4, color);
    box(s, 0, 1.5, 5, 1, 4, 3, color);
    for (const side of [-1, 1]) {
      box(s, side * 7, -0.1, 1, 2.6, 2.6, 8, 0x263a43);
      const engine = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 7, 8),
        basic(isPlayer ? 0xaaff76 : 0x7adfff),
      );
      engine.rotation.x = Math.PI / 2;
      engine.position.set(side * 7, -0.1, 8);
      s.add(engine);
      lights.push(engine);
      box(s, side * 9.5, 0, 1, 0.5, 0.4, 1, side < 0 ? 0xff7771 : 0x9affc4, 3);
    }
    root.add(s);
    return s;
  }
  const player = ship(true);
  for (let i = 0; i < (C.fleetCount ?? 38); i++) {
    const s = ship();
    const side = i % 2 ? -1 : 1;
    fleet.push({
      mesh: s,
      x: side * (32 + (i % 7) * 25),
      y: (i % 5) * 14 - 20,
      z: -70 - Math.floor(i / 2) * 55,
      phase: i * 1.73,
    });
  }
  for (let i = 0; i < (C.obstacleCount ?? 3); i++) {
    const p = 0.28 + i * 0.205,
      z = endZ + distance * (1 - p);
    const x = [-20, 8, -12][i % 3],
      y = baseY(p) + [0, 2, -8][i % 3];
    const group = new THREE.Group();
    group.position.set(x, y, z);
    root.add(group);
    box(group, 0, 0, 0, 22, 4, 5, 0x5c665f);
    box(group, 0, 0, 3, 22, 1.2, 0.4, 0xffb65d, 2);
    box(group, -13, -1, 0, 4, 10, 8, 0x2b3a43);
    box(group, 13, -1, 0, 4, 10, 8, 0x2b3a43);
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 26, 5),
        basic(0xffb761),
      );
      beam.position.set(side * 13, -18, 0);
      group.add(beam);
    }
    obstacles.push({ mesh: group, x, y, z, hit: false });
  }
  const cameraTarget = new THREE.Vector3(),
    cameraPosition = new THREE.Vector3();
  let elapsed = 0,
    lateral = 0,
    vertical = 0,
    collisions = 0,
    stall = 0,
    shake = 0,
    running = false,
    totalTime = 0;
  let oldFog, oldBackground;
  function start() {
    elapsed = lateral = vertical = collisions = stall = shake = totalTime = 0;
    if (!root.visible) {
      oldFog = scene.fog;
      oldBackground = scene.background;
    }
    running = true;
    root.visible = true;
    scene.fog = new THREE.Fog(0x101b28, 90, 1100);
    scene.background = new THREE.Color(0x101b28);
    for (const o of obstacles) o.hit = false;
    player.position.set(0, altitude, endZ + distance);
    player.rotation.set(0, 0, 0);
  }
  function update(dt, keys, camera) {
    if (!running)
      return {
        done: elapsed >= duration,
        collisions,
        progress: Math.min(1, elapsed / duration),
        penaltySeconds: collisions * (C.collisionPenalty ?? 0.7),
      };
    totalTime += dt;
    if (stall > 0) stall = Math.max(0, stall - dt);
    else elapsed = Math.min(duration, elapsed + dt);
    const p = elapsed / duration;
    const landing = smooth(THREE.MathUtils.clamp((p - 0.88) / 0.12, 0, 1));
    const dx =
      (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
      (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    const dy =
      (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
      (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0);
    lateral = THREE.MathUtils.clamp(
      lateral + dx * (C.steerSpeed ?? 25) * dt,
      -(C.width ?? 40),
      C.width ?? 40,
    );
    vertical = THREE.MathUtils.clamp(
      vertical + dy * (C.steerSpeed ?? 25) * dt,
      -(C.height ?? 22),
      C.height ?? 22,
    );
    player.position.set(
      lateral * (1 - landing),
      Math.max(landingY, baseY(p) + vertical * (1 - landing)),
      endZ + distance * (1 - p),
    );
    player.rotation.z = THREE.MathUtils.damp(
      player.rotation.z,
      -dx * 0.32 * (1 - landing),
      5,
      dt,
    );
    player.rotation.x = THREE.MathUtils.damp(
      player.rotation.x,
      dy * 0.12 * (1 - landing),
      4,
      dt,
    );
    for (const o of obstacles) {
      if (
        !o.hit &&
        Math.abs(player.position.z - o.z) < 10 &&
        Math.abs(player.position.x - o.x) < 16 &&
        Math.abs(player.position.y - o.y) < 7
      ) {
        o.hit = true;
        collisions++;
        stall = C.collisionPenalty ?? 0.7;
        shake = 1;
      }
      o.mesh.rotation.z = Math.sin(totalTime * 0.5 + o.z) * 0.015;
    }
    for (const f of fleet) {
      const z = player.position.z + f.z;
      f.mesh.position.set(
        f.x + Math.sin(totalTime * 0.45 + f.phase) * 5,
        Math.max(
          18,
          baseY(Math.min(1, p + 0.05)) +
            f.y +
            Math.sin(totalTime + f.phase) * 2,
        ),
        z,
      );
      // The swarm fans toward different entrances as the player's lane narrows.
      f.mesh.position.x += Math.sign(f.x) * landing * 90;
      f.mesh.rotation.z = Math.sin(totalTime + f.phase) * 0.025;
      f.mesh.visible = z > 18;
    }
    for (let i = 0; i < lights.length; i++)
      lights[i].scale.y = 0.85 + Math.sin(totalTime * 22 + i) * 0.14;
    shake = Math.max(0, shake - dt * 2);
    cameraPosition
      .copy(player.position)
      .add(
        new THREE.Vector3(
          Math.sin(totalTime * 43) * shake * 1.7,
          9 + shake * Math.cos(totalTime * 37),
          C.cameraDistance ?? 34,
        ),
      );
    const lookLift = Math.sin(Math.PI * p) * 11;
    cameraTarget.set(
      player.position.x * 0.7,
      player.position.y + 3 + lookLift,
      player.position.z - 90,
    );
    if (totalTime <= dt * 1.1) camera.position.copy(cameraPosition);
    else camera.position.lerp(cameraPosition, 1 - Math.exp(-dt * 6));
    camera.lookAt(cameraTarget);
    const done = elapsed >= duration;
    if (done) running = false;
    return {
      done,
      collisions,
      progress: p,
      penaltySeconds: collisions * (C.collisionPenalty ?? 0.7),
    };
  }
  function dispose() {
    root.visible = false;
    running = false;
    if (oldFog !== undefined) scene.fog = oldFog;
    if (oldBackground !== undefined) scene.background = oldBackground;
  }
  return { root, start, update, dispose };
}
