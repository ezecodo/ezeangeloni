// One thing in the workshop: what it's called, a line about it, and how to set it on the stage.
import type * as THREE from 'three';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  look: (target: THREE.Vector3, from: THREE.Vector3) => void; // place the camera
  follow: (target: () => THREE.Vector3) => void;              // keep the camera's target on something that moves
  viewH: () => number;
}
export interface Element {
  id: string;
  name: string;
  about: string;
  background: string;
  open(stage: Stage): Promise<{ update(dt: number): void; close(): void }>;
}
