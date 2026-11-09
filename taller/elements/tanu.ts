// Tanu, the same one that swims in the universe (src/cronovisor/tanu/): her code and her body are the site's own,
// so whatever changes there shows here, and back. Alone in the dark, wandering a small sky, the camera with her.
import * as THREE from 'three';
import { Tanu } from '../../src/cronovisor/tanu/tanu';
import type { Element } from './types';
import { NIGHT, stars } from './space';

export const tanu: Element = {
  id: 'tanu',
  name: 'Tanu · ballena',
  about: 'Tanu, the whale of the cosmos. In the universe since 2026-11-08. Body: “Game-ready Humpback Whale” by Allie2k, CC BY 4.0; painted and swimming in code.',
  background: NIGHT,
  async open(stage){
    const t = new Tanu({ zone: () => null, balloon: () => null, radius: () => 45, reduced: false, lowPower: () => false, model: '/models/tanu-humpback.glb' });
    stage.scene.add(t.group, t.wake);
    const sky = stars(stage.scene, 900, 260, 460); // so her movement reads against something
    const p = t.position;
    stage.look(p.clone(), p.clone().add(new THREE.Vector3(38, 10, 24)));
    stage.follow(() => t.position);
    return {
      update: (dt) => t.update(dt, stage.viewH(), stage.camera.fov),
      close: () => { stage.scene.remove(t.group, t.wake); sky.dispose(); },
    };
  },
};
