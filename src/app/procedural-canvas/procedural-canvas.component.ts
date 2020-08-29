import { Component, OnInit } from '@angular/core';
import getChunk from './chunk';
import * as THREE from 'three';
import { range } from 'lodash';

@Component({
  selector: 'app-procedural-canvas',
  templateUrl: './procedural-canvas.component.html',
  styleUrls: ['./procedural-canvas.component.css'],
})
export class ProceduralCanvasComponent implements OnInit {
  is2D = true;
  theta = 0;

  constructor() {
    this.renderScene();
  }

  renderScene() {
    const width = window.innerWidth / 2;
    const viz_width = width;
    const cameraRadius = 500;
    let theta = 0;
    const height = window.innerHeight / 2;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(
      width / -2,
      width / 2,
      height / 2,
      height / -2,
      1,
      1000
    );

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    this.renderChunks(scene);
    camera.position.y = 600;
    camera.lookAt(scene.position);

    const animate = () => {
      requestAnimationFrame(animate);
      this.theta += 0.1;
      camera.position.x = cameraRadius * Math.sin( THREE.MathUtils.degToRad( this.theta ) );
      camera.position.z = cameraRadius * Math.cos( THREE.MathUtils.degToRad( this.theta ) );
      camera.lookAt(scene.position);
      renderer.render(scene, camera);
    };

    animate();
  }

  renderChunks(scene: THREE.Object3D): void {
    const scalar = 16;
    range(-2, 2).forEach(x => {
      range(-2, 2).forEach(y => {
        const chunk = getChunk(x, y);
        chunk.forEach((row, chunkX) => {
          row.forEach((height, chunkY) => {
            const geometry = new THREE.BoxGeometry(scalar, scalar, scalar);
            const material = new THREE.MeshBasicMaterial({ color: this.heightToColor(height) });
            const cube = new THREE.Mesh(geometry, material);
            cube.position.y = height * scalar + scalar / 2;
            cube.position.x = (x * 16 + chunkX) * scalar;
            cube.position.z = (y * 16 + chunkY) * scalar;

            const geometry2 = new THREE.BoxGeometry(scalar, height * scalar, scalar);
            const material2 = new THREE.MeshBasicMaterial({ color: 0x221100 });
            const stack = new THREE.Mesh(geometry2, material2);
            stack.position.y = height * scalar / 2;
            stack.position.x = (x * 16 + chunkX) * scalar;
            stack.position.z = (y * 16 + chunkY) * scalar;

            scene.add(cube);
            scene.add(stack);
          });
        });
      });
    });
  }

  heightToColor(height: number): number {
    const minValue = 0;
    const maxValue = 40;
    const color = Math.floor(255 * (height - minValue) / (maxValue - minValue));
    // return color * 256 * 256 + color * 256 + color;
    return 256 * color;
  }

  ngOnInit(): void {

  }
}
