import { range } from 'lodash';
/// <reference lib="webworker" />
// import * as THREE from 'three';
import getChunk, {updateSeed} from './procedural-canvas/chunk';

// const scalar = 1;

// console.log("Worker created");

addEventListener('message', ({ data }) => {
  // const response = `worker response to ${data}`;
  // // console.log("response");
  // postMessage(response);

  const {x, y, seed, scalar, chunksize} = data;
  updateSeed(seed);
  const chunk = getChunk(x, y, chunksize);

  // const geometry = new THREE.BufferGeometry();

  const vertices = [];
  const normals = [];
  const colors = [];

  const pushSurfaceSquare = (chunkX: number, chunkY: number, height: number) => {
    const x1 = chunkX * scalar - scalar * 8;
    const x2 = x1 + scalar;
    const y1 = chunkY * scalar - scalar * 8;
    const y2 = y1 + scalar;
    const h = height * scalar + scalar;

    vertices.push(x1, h, y1);
    vertices.push(x2, h, y2);
    vertices.push(x2, h, y1);
    vertices.push(x1, h, y1);
    vertices.push(x1, h, y2);
    vertices.push(x2, h, y2);

    const colorRGB = heightToColor(height);
    const red = Math.floor(colorRGB / (256 ** 2)) / 255;
    const green = Math.floor((colorRGB % (256 ** 2)) / 256) / 255;
    const blue = (colorRGB % 256) / 255;

    range(6).forEach(() => {
      colors.push(red, green, blue);
      normals.push(0, 1, 0);
    });
  };

  const pushSides = (chunkX: number, chunkY: number, height: number) => {
    const x1 = chunkX * scalar - scalar * 8;
    const x2 = x1 + scalar;
    const y1 = chunkY * scalar - scalar * 8;
    const y2 = y1 + scalar;
    const h1 = height * scalar;
    const h2 = height * scalar + scalar;

    const pushRect = (x1s, x2s, y1s, y2s, h1s, h2s, n1, n2, r, g, b) => {
      vertices.push(x1s, h1s, y1s);
      vertices.push(x2s, h2s, y2s);
      vertices.push(x2s, h1s, y2s);
      vertices.push(x1s, h1s, y1s);
      vertices.push(x1s, h2s, y1s);
      vertices.push(x2s, h2s, y2s);
      range(6).forEach(() => {
        colors.push(r, g, b);
        normals.push(n1, 0, n2);
      });
    };

    const colorRGB = heightToColor(height);
    const red = Math.floor(colorRGB / (256 ** 2)) / 255;
    const green = Math.floor((colorRGB % (256 ** 2)) / 256) / 255;
    const blue = (colorRGB % 256) / 255;

    // Side 1
    pushRect(x1, x1, y1, y2, h1, h2,  0, -1, red, green, blue);
    pushRect(x2, x2, y1, y2, h1, h2,  0,  1, red, green, blue);
    pushRect(x1, x2, y1, y1, h1, h2,  1,  0, red, green, blue);
    pushRect(x1, x2, y2, y2, h1, h2, -1,  0, red, green, blue);

    pushRect(x1, x1, y1, y2, 0, h1,  0, -1, .2, .1, 0);
    pushRect(x2, x2, y1, y2, 0, h1,  0,  1, .2, .1, 0);
    pushRect(x1, x2, y1, y1, 0, h1,  1,  0, .2, .1, 0);
    pushRect(x1, x2, y2, y2, 0, h1, -1,  0, .2, .1, 0);

  }

  chunk.forEach((row, chunkX) => {
    row.forEach((height, chunkY) => {
      // One mesh
      pushSurfaceSquare(chunkX, chunkY, height);
      pushSides(chunkX, chunkY, height);
    });
  });

  // console.log(vertices);
  // console.log(normals);
  // console.log(colors);
  // geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  // geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  // geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  // const material = new THREE.MeshLambertMaterial({side: THREE.DoubleSide, vertexColors: true});
  // const mesh = new THREE.Mesh(geometry, material);
  
  // mesh.position.x = x * 16 * scalar;
  // mesh.position.z = y * 16 * scalar;
  postMessage({vertices, normals, colors});
  self.close();
});

function heightToColor(height: number): number {
  const minValue = 0;
  const maxValue = 128;
  const color = Math.floor(255 * (height - minValue) / (maxValue - minValue));
  // return color * 256 * 256 + color * 256 + color;
  return 256 * color;
}
