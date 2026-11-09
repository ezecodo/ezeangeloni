// The Selk'nam figure (taller/selknam-figure/build.mjs writes its GLB) walking through space, as Tanu swims there
// (Eze, 2026-11-09): nothing under its feet, but every step leaves a print of light that glows and fades, so it
// reads as walking, not floating, and leaves a trail of where it went. It follows a wide, slowly turning course;
// the camera walks with it. A soft cool light and a rim behind it so its paint reads in the dark.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import url from '../selknam-figure/selknam-figure.glb?url';
import type { Element } from './types';
import { NIGHT, stars } from './space';

const CYCLE = 1.2;         // the walk's length in the GLB: two steps
const SPEED = .3;          // its stride, units a second
const HIP_X = .078;        // where the feet are, either side
const PRINT_LIFE = 5;      // seconds a footprint glows

function printTexture(){
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.35, 'rgba(255,240,225,.55)'); g.addColorStop(1, 'rgba(255,230,210,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export const selknamFigure: Element = {
  id: 'selknam-figure',
  name: 'Figura selk’nam',
  about: 'A figure in the language of the Hain spirits’ body paint: red panels with white dots, white stripes edged in black, a conical black head. It walks through space, each step a print of light (animation “walk” in its GLB). Rebuild: node taller/selknam-figure/build.mjs',
  background: NIGHT,
  async open(stage){
    const sky = stars(stage.scene, 1100, 20, 120);
    const lights = [new THREE.HemisphereLight('#c9d4ff', '#0a0a18', 1.1), new THREE.DirectionalLight('#fff4e6', 1.7), new THREE.DirectionalLight('#8fa6ff', 1.2)];
    lights[1].position.set(2, 3, 2.5);   // the key, warm
    lights[2].position.set(-2, 1.5, -3); // the rim, cool, from behind
    const gltf = await new GLTFLoader().loadAsync(url);
    const fig = gltf.scene;
    stage.scene.add(...lights, fig);
    const mixer = new THREE.AnimationMixer(fig);
    const clip = gltf.animations.find((a) => a.name === 'walk');
    const action = clip ? mixer.clipAction(clip).play() : null;
    // footprints: small glowing discs left where each foot lands, fading out
    const tex = printTexture(), prints: { mesh: THREE.Mesh; born: number }[] = [];
    const printGeo = new THREE.PlaneGeometry(.2, .28);
    const leavePrint = (at: THREE.Vector3, heading: number, now: number) => {
      const m = new THREE.Mesh(printGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#ffe9d6' }));
      m.rotation.set(-Math.PI/2, 0, -heading);
      m.position.copy(at).setY(.002);
      stage.scene.add(m); prints.push({ mesh: m, born: now });
    };
    // its course: a wide circle that slowly wanders (never quite the same loop twice)
    let heading = 0, t = 0, lastStep = -1;
    const pos = new THREE.Vector3();
    stage.look(new THREE.Vector3(0, .5, 0), new THREE.Vector3(2.2, 1.3, 3.2));
    stage.follow(() => pos.clone().setY(.5));
    return {
      update(dt){
        t += dt;
        mixer.update(dt);
        heading += dt*(.12 + .08*Math.sin(t*.13));          // turning gently, more and less
        pos.x += Math.sin(heading)*SPEED*dt; pos.z += Math.cos(heading)*SPEED*dt;
        fig.position.copy(pos); fig.rotation.y = heading;
        // a step lands every half cycle: the left foot, then the right
        const step = Math.floor(((action?.time ?? t) % CYCLE)/(CYCLE/2) + .25) % 2;
        if(step !== lastStep){
          lastStep = step;
          const side = step === 0 ? 1 : -1;
          const foot = new THREE.Vector3(side*HIP_X, 0, .03).applyAxisAngle(new THREE.Vector3(0, 1, 0), heading).add(pos);
          leavePrint(foot, heading, t);
        }
        for(let i = prints.length - 1; i >= 0; i--){
          const p = prints[i], age = (t - p.born)/PRINT_LIFE;
          const mat = p.mesh.material as THREE.MeshBasicMaterial;
          mat.opacity = Math.max(0, (1 - age))*Math.min(1, (t - p.born)*6)*.9;
          if(age >= 1){ stage.scene.remove(p.mesh); mat.dispose(); prints.splice(i, 1); }
        }
      },
      close(){
        stage.scene.remove(...lights, fig);
        for(const p of prints){ stage.scene.remove(p.mesh); (p.mesh.material as THREE.Material).dispose(); }
        printGeo.dispose(); tex.dispose(); sky.dispose(); mixer.stopAllAction();
      },
    };
  },
};
