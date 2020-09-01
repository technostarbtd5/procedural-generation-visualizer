import { range } from 'lodash';
import { HashIntService } from './hash-int.service';
import { Injectable } from '@angular/core';

const permutation = [151,160,137,91,90,15,					// Hash lookup table as defined by Ken Perlin.  This is a randomly
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,	// arranged array of all numbers from 0-255 inclusive.
  190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161,1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180,
];

const p = permutation.concat(permutation);

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, x: number): number {
  return a + x * (b - a);
}

function grad(hash: number, x: number, y: number, z: number): number {
  switch(hash & 0xF) {
      case 0x0: return  x + y;
      case 0x1: return -x + y;
      case 0x2: return  x - y;
      case 0x3: return -x - y;
      case 0x4: return  x + z;
      case 0x5: return -x + z;
      case 0x6: return  x - z;
      case 0x7: return -x - z;
      case 0x8: return  y + z;
      case 0x9: return -y + z;
      case 0xA: return  y - z;
      case 0xB: return -y - z;
      case 0xC: return  y + x;
      case 0xD: return -y + z;
      case 0xE: return  y - x;
      case 0xF: return -y - z;
      default: return 0; // never happens
  }
}

let seed = Math.floor(Math.random() * (2 ** 32));

@Injectable({
  providedIn: 'root'
})
export class PerlinService {
  // Adapted from https://gist.github.com/Flafla2/f0260a861be0ebdeef76
  seedX = 0;
  seedY = 0;
  seedZ = 0;
  constructor() {
    this.seedX = HashIntService.hashInt(seed);
    this.seedY = HashIntService.hashInt(this.seedX);
    this.seedZ = HashIntService.hashInt(this.seedY);
    this.seedX &= (2 ** 16 - 1);
    this.seedY &= (2 ** 16 - 1);
    this.seedZ &= (2 ** 16 - 1);
    seed++;
    console.log(`Perlin with seed ${this.seedX}, ${this.seedY}, ${this.seedZ}`);
  }

  static perlin2DImproved(x: number, y: number): number {
    return PerlinService.perlin3DImproved(x, y, 0);
  }

  static perlin3DImproved(x: number, y: number, z: number): number {
    // const xi = HashIntService.hashInt(Math.floor(x)) & 255;
    // const yi = HashIntService.hashInt(Math.floor(y)) & 255;
    // const zi = HashIntService.hashInt(Math.floor(z)) & 255;
    // const xi = Math.floor(x) & 255;
    // const yi = Math.floor(y) & 255;
    // const zi = Math.floor(z) & 255;
    const xi1 = HashIntService.hashInt(Math.floor(x)) & 255;
    const yi1 = HashIntService.hashInt(Math.floor(y)) & 255;
    const zi1 = HashIntService.hashInt(Math.floor(z)) & 255;
    const xi2 = HashIntService.hashInt(Math.floor(x) + 1) & 255;
    const yi2 = HashIntService.hashInt(Math.floor(y) + 1) & 255;
    const zi2 = HashIntService.hashInt(Math.floor(z + 1)) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = fade(xf);
    const v = fade(yf);
    const w = fade(zf);
    const aaa = p[p[p[xi1] + yi1] + zi1];
    const aba = p[p[p[xi1] + yi2] + zi1];
    const aab = p[p[p[xi1] + yi1] + zi2];
    const abb = p[p[p[xi1] + yi2] + zi2];
    const baa = p[p[p[xi2] + yi1] + zi1];
    const bba = p[p[p[xi2] + yi2] + zi1];
    const bab = p[p[p[xi2] + yi1] + zi2];
    const bbb = p[p[p[xi2] + yi2] + zi2];

    let x1, x2, y1, y2;
    x1 = lerp(	grad (aaa, xf  , yf  , zf),				// The gradient function calculates the dot product between a pseudorandom
                grad (baa, xf-1, yf  , zf),				// gradient vector and the vector from the input coordinate to the 8
                u);										            // surrounding points in its unit cube.
    x2 = lerp(	grad (aba, xf  , yf-1, zf),				// This is all then lerped together as a sort of weighted average based on the faded (u,v,w)
                grad (bba, xf-1, yf-1, zf),				// values we made earlier.
                u);
    y1 = lerp(x1, x2, v);

    x1 = lerp(	grad (aab, xf  , yf  , zf-1),
                grad (bab, xf-1, yf  , zf-1),
                u);
    x2 = lerp(	grad (abb, xf  , yf-1, zf-1),
                grad (bbb, xf-1, yf-1, zf-1),
                u);
    y2 = lerp (x1, x2, v);
    return (lerp (y1, y2, w)+1)/2;
  }

  offset2DOctave(x: number, y: number, octaves: number,
                 frequency: number = 1, persistence: number = 0.5, offsetAmplitude: number = 0.1, offsetFrequency: number = 1): number {
    return this.offset3DOctave(x, y, 0, octaves, frequency, persistence, offsetAmplitude, offsetFrequency);
  }

  offset3DOctave(x: number, y: number, z: number,
                 octaves: number, frequency: number, persistence: number, offsetAmplitude: number = 0.1, offsetFrequency: number = 1): number {
    x = x + this.seedX;
    y = y + this.seedY;
    z = z + this.seedZ;
    let total = 0;
    let amplitude = 1;
    let maxValue = 0;
    range(octaves).forEach(() => {
      total += this.offset3D(x * frequency, y * frequency, z * frequency, offsetAmplitude, offsetFrequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    });
    return total / maxValue;
  }

  offset3D(x: number, y: number, z: number, offsetAmplitude: number, offsetFrequency: number): number {
    x += offsetAmplitude * PerlinService.perlin3DImproved((x + this.seedX) * offsetFrequency, 0, 0);
    y += offsetAmplitude * PerlinService.perlin3DImproved(0, (y + this.seedY) * offsetFrequency, 0);
    z += offsetAmplitude * PerlinService.perlin3DImproved(0, 0, (z + this.seedZ) * offsetFrequency);
    return PerlinService.perlin3DImproved(x, y, z);
  }


  perlin2DOctave(x: number, y: number, octaves: number, frequency: number = 1, persistence: number = 0.5): number {
    return this.perlin3DOctave(x, y, 0, octaves, frequency, persistence);
  }

  perlin3DOctave(x: number, y: number, z: number, octaves: number, frequency: number, persistence: number): number {
    x = x + this.seedX;
    y = y + this.seedY;
    z = z + this.seedZ;
    let total = 0;
    let amplitude = 1;
    let maxValue = 0;
    range(octaves).forEach(() => {
      total += PerlinService.perlin3DImproved(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= 2;
    });
    return total / maxValue;
  }
}
