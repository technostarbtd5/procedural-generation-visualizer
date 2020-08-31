import { range } from 'lodash';
import { PerlinService } from './../perlin.service';

const perlin = range(4).map(() => new PerlinService());


function getChunk(x: number, y: number): number[][] {
  const chunk = [];
  for (let i = 0; i < 16; i++) {
    const row = [];
    for (let j = 0; j < 16; j++) {
      row.push(getValueAtPoint(x * 16 + i, y * 16 + j));
    }
    chunk.push(row);
  }
  return chunk;
}

function getValueAtPoint(x: number, y: number): number {
  // const result = Math.floor(PerlinService.perlin2DOctave(x, y, 8, 1 / 32) * 32);
  // console.log(`Perlin at ${x}, ${y}: ${result}`);
  return Math.floor(multiPerlinOctave(x, y));

  // const posToRad = 2 * Math.PI / 16;
  // return Math.floor(Math.sin(x * posToRad) * 4 + Math.cos(y * posToRad) * 4 + Math.random() * 2 + 8);

  // return x + y;
}

function multiPerlinOctave(x: number, y: number): number {
  let continentLayer = (perlin[0]).perlin2DOctave(x, y, 8, 1 / 128);
  if(continentLayer < .4) {
    continentLayer *= 10;
  } else if(continentLayer < 0.6) {
    continentLayer = (continentLayer - .4) * 24 * 5 + 4;
  } else {
    continentLayer = (continentLayer - .6) * 10 + 28;
  }
  const layer0 = (perlin[1]).perlin2DOctave(x, y, 8, 1 / 64) * 64;
  const layer1 = (perlin[2]).perlin2DOctave(x, y, 8, 1 / 16) * 64;
  const layer2 = (perlin[3]).perlin2DOctave(x, y, 8, 1 / 8) * 8;
  const tempsum = continentLayer + layer0 + layer1 + layer2;
  if(tempsum < 64) { 
    return tempsum / 4;
  } else {
    return tempsum - 48;
  }

}

export default getChunk;
