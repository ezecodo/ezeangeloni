// The workshop's sky: the universe's night and a field of stars, shared by every element that lives in space.
import * as THREE from 'three';

export const NIGHT = '#080810';

export function stars(scene: THREE.Scene, n = 1100, near = 60, far = 260){
  const pos = new Float32Array(n*3);
  for(let i = 0; i < n; i++){ const v = new THREE.Vector3().randomDirection().multiplyScalar(near + Math.random()*(far - near)); pos.set([v.x, v.y, v.z], i*3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(g, new THREE.PointsMaterial({ color: '#f0ede8', size: 1.4, sizeAttenuation: false, transparent: true, opacity: .55, depthWrite: false }));
  scene.add(points);
  return { points, dispose(){ scene.remove(points); g.dispose(); (points.material as THREE.Material).dispose(); } };
}
