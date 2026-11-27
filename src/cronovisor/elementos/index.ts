/*
 * Los elementos de la mesa (Eze, 2026-11-27): piezas que acompañan al dragón, diseñadas con sus mismas reglas gráficas
 * (src/cronovisor/dragon/estilo.ts) y dibujadas con su mismo motor, para animarlas en una segunda etapa. Cada elemento
 * es un objeto con su nombre, una línea sobre él y `dibujar`: dibuja el elemento centrado en un lienzo de w × h, al
 * reloj t (segundos), sin estado (así el bucle y el video salen exactos). Se muestran en /mesa/elementos/.
 * Para agregar uno: un archivo en esta carpeta que exporte su Elemento, y sumarlo a ELEMENTOS. Por ahora son
 * estáticos (Eze: el diseño primero); el movimiento previsto queda en `animacion`.
 */
export interface Elemento {
  id: string;
  grupo?: string;          // para agruparlos en la página (los tres wagara, por ejemplo)
  nombre: string;
  descripcion: string;
  animacion?: string;      // el movimiento previsto, tal como lo describió Eze: para la etapa de animación
  dibujar(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
}

import { seigaiha, asanoha, shippo } from './wagara';
import { enso, fuego } from './shodo';
import { chawan, piedra } from './kintsugi';
import { fusion, sabor, bienvenidos } from './neon';
import { darumaDeseo, darumaGuino } from './daruma';
import { toriiAgua, toriiTunel } from './torii';
import { sensuAbierto, wagasa, sensuFila } from './sensu';
import { chochinGrande, chochinHilera } from './chochin';
import { fujiAmanecer, fujiNoche, fujiEclipse } from './fuji';
import { bosqueBambu, bambuDorado } from './bambu';
import { momijiCae, sakuraCae, cortina } from './sakura';
import { olaOro, olaNeonE } from './ola';
import { nekoOro, nekoCalle } from './neko';
import { kitsuneMascara, kyubi } from './kitsune';
import { tsuruSol, tsuruNubes } from './tsuru';
import { koiYinYang, koiEstanque } from './koi';
import { hanabiRio, hanabiKiku, senko } from './hanabi';

export const ELEMENTOS: Elemento[] = [seigaiha, asanoha, shippo, enso, fuego, chawan, piedra, fusion, sabor, bienvenidos, darumaDeseo, darumaGuino, toriiAgua, toriiTunel, sensuAbierto, wagasa, sensuFila, chochinGrande, chochinHilera, fujiAmanecer, fujiNoche, fujiEclipse, bosqueBambu, bambuDorado, momijiCae, sakuraCae, cortina, olaOro, olaNeonE, nekoOro, nekoCalle, kitsuneMascara, kyubi, tsuruSol, tsuruNubes, koiYinYang, koiEstanque, hanabiRio, hanabiKiku, senko];

// El elemento quieto (Eze, 2026-11-27: poder ver el elemento estático, no sólo animado): el segundo de su animación que
// mejor lo muestra entero, como fue diseñado (el ensō ya escrito, el cuenco ya reparado, el neón encendido, los fuegos
// abiertos). Sin entrada, el segundo 0.
export const FOTO: Record<string, number> = {
  asanoha: 3, shippo: 1, enso: 5.5, 'kanji-fuego': 6.5, 'kintsugi-chawan': 10.5, 'kintsugi-piedra': 10.5,
  'neon-fusion': 6.3, 'neon-sabor': 6.3, 'neon-bienvenidos': 6.3, 'daruma-deseo': 3, 'daruma-guino': 5.65,
  sensu: 4, wagasa: 5, 'sensu-fila': 2.35, 'fuji-amanecer': 15, 'fuji-noche': 5, 'fuji-eclipse': 15,
  'sakura-cortina': 3.75, 'neko-oro': 1.3, 'neko-streetwear': 1.3, 'kitsune-mascara': 2,
  'hanabi-rio': 6.2, 'hanabi-kiku': 1.8, 'hanabi-senko': 9,
};
