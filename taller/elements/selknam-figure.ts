// The Selk'nam figure (taller/selknam-figure/build.mjs writes its GLB): it walks a slow circle on a pale floor.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import url from '../selknam-figure/selknam-figure.glb?url';
import type { Element } from './types';

export const selknamFigure: Element = {
  id: 'selknam-figure',
  name: 'Figura selk’nam',
  about: 'A figure in the language of the Hain spirits’ body paint: red panels with white dots, white stripes edged in black, a conical black head. It walks (animation “walk”). Rebuild: node taller/selknam-figure/build.mjs',
  background: '#8f9fc0',
  async open(stage){
    const lights = [new THREE.HemisphereLight('#ffffff', '#55607a', 1.6), new THREE.DirectionalLight('#ffffff', 1.4)];
    lights[1].position.set(1.5, 2.5, 2);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.2, 96), new THREE.MeshStandardMaterial({ color: '#b9c0cf', roughness: .95 }));
    floor.rotation.x = -Math.PI/2;
    const gltf = await new GLTFLoader().loadAsync(url);
    const fig = gltf.scene;
    stage.scene.add(...lights, floor, fig);
    const mixer = new THREE.AnimationMixer(fig);
    const clip = gltf.animations.find((a) => a.name === 'walk');
    if(clip) mixer.clipAction(clip).play();
    stage.look(new THREE.Vector3(0, .45, 0), new THREE.Vector3(0, 1.1, 3.6));
    const R = 1.1, SPEED = .3;
    let a = 0;
    return {
      update(dt){
        mixer.update(dt);
        a += dt*SPEED/R;
        fig.position.set(Math.sin(a)*R, 0, Math.cos(a)*R);
        fig.rotation.y = a + Math.PI/2;
      },
      close(){ stage.scene.remove(...lights, floor, fig); mixer.stopAllAction(); },
    };
  },
};
