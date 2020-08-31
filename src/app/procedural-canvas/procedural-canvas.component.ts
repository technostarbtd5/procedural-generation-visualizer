import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';
import getChunk from './chunk';
import * as THREE from 'three';
import { range, isEqual } from 'lodash';

interface PathPoint {
  x: number;
  y: number;
  z: number;
}

const cameraRadius = 500;

@Component({
  selector: 'app-procedural-canvas',
  templateUrl: './procedural-canvas.component.html',
  styleUrls: ['./procedural-canvas.component.css'],
})
export class ProceduralCanvasComponent implements OnInit {
  @ViewChild('canvas') private canvasRef: ElementRef;

  is2D = true;
  theta = 0;
  pathToTrace = {
    isActive: false,
    stepsRemaining: 0,
    currentPath: {
      to: {
        x: 0,
        y: 0,
        z: 0,
      },
      from: {
        x: 0,
        y: 0,
        z: 0,
      },
      numSteps: 0,
    },
  };
  canvasWidth = 0;
  canvasHeight = 0;



  constructor() {
    
  }

  renderScene() {
    const width = this.canvasWidth;
    const viz_width = width;
    let theta = 0;
    const height = this.canvasHeight;
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
    renderer.setSize(width, height);
    this.canvasRef.nativeElement.append(renderer.domElement);

    this.renderChunks(scene);
    camera.position.y = 600;
    camera.lookAt(scene.position);

    const light = new THREE.DirectionalLight( 0xffffff, 0.9 );
    light.position.set(0, 10, 10);
    light.target.position.set(-5, 0, 0);
    scene.add( light );
    scene.add( light.target );
    
    const animate = () => {
      requestAnimationFrame(animate);
      if(this.pathToTrace.isActive) {
        const {x, y, z} = this.getPathPosition();
        camera.position.x = x;
        camera.position.y = y;
        camera.position.z = z;
        this.pathToTrace.stepsRemaining--;
        if(this.pathToTrace.stepsRemaining === 0) {
          this.pathToTrace.isActive = false;
        }
        camera.lookAt(scene.position);
      } else {
        if(this.is2D) {
          camera.position.x = 0;
          camera.position.z = 0;
          camera.lookAt(scene.position);
        } else {
          this.theta += 0.1;
          camera.position.x = cameraRadius * Math.sin( THREE.MathUtils.degToRad( this.theta ) );
          camera.position.z = cameraRadius * Math.cos( THREE.MathUtils.degToRad( this.theta ) );
          camera.lookAt(scene.position);
        }
      }
      renderer.render(scene, camera);
    };

    animate();
  }

  renderChunks(scene: THREE.Object3D): void {
    const scalar = 8;
    range(-2, 2).forEach(x => {
      range(-2, 2).forEach(y => {
        const chunk = getChunk(x, y);
        chunk.forEach((row, chunkX) => {
          row.forEach((height, chunkY) => {
            const geometry = new THREE.BoxGeometry(scalar, scalar, scalar);
            const material = new THREE.MeshPhongMaterial({ color: this.heightToColor(height) });
            const cube = new THREE.Mesh(geometry, material);
            cube.position.y = height * scalar + scalar / 2;
            cube.position.x = (x * 16 + chunkX) * scalar;
            cube.position.z = (y * 16 + chunkY) * scalar;

            const geometry2 = new THREE.BoxGeometry(scalar, height * scalar, scalar);
            const material2 = new THREE.MeshPhongMaterial({ color: 0x221100 });
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
    const maxValue = 128;
    const color = Math.floor(255 * (height - minValue) / (maxValue - minValue));
    // return color * 256 * 256 + color * 256 + color;
    return 256 * color;
  }

  ngOnInit(): void {
    this.canvasWidth = Math.min(window.innerWidth, 800);
    this.canvasHeight = Math.min(window.innerHeight, 600);
  }
  
  ngAfterViewInit(): void {
    this.renderScene();
  }

  toggle2D(): void {
    this.is2D = !this.is2D;
    const point2D = {
      x: 0,
      y: 600,
      z: 200,
    };
    const point3D = {
      x: cameraRadius * Math.sin( THREE.MathUtils.degToRad( this.theta ) ),
      y: 600,
      z: cameraRadius * Math.cos( THREE.MathUtils.degToRad( this.theta ) ),
    };
    const pointCurrent = this.getPathPosition();
    if(this.is2D) {
      if(this.pathToTrace.isActive) {
        this.tracePath(pointCurrent, point2D, 20);
      } else {
        this.tracePath(point3D, point2D, 20);
      }
    } else {
      if(this.pathToTrace.isActive) {
        this.tracePath(pointCurrent, point3D, 20);
      } else {
        this.tracePath(point2D, point3D, 20);
      }
    }
  }

  tracePath(from: PathPoint, to: PathPoint, steps: number): void {
    this.pathToTrace.isActive = true;
    this.pathToTrace.stepsRemaining = steps;
    this.pathToTrace.currentPath.from = from;
    this.pathToTrace.currentPath.to = to;
    this.pathToTrace.currentPath.numSteps = steps;
  }

  getPathPosition(): PathPoint {
    const {from, to, numSteps} = this.pathToTrace.currentPath;
    const {stepsRemaining} = this.pathToTrace;
    return {
      x: (from.x - to.x) * (stepsRemaining / numSteps) + to.x,
      y: (from.y - to.y) * (stepsRemaining / numSteps) + to.y,
      z: (from.z - to.z) * (stepsRemaining / numSteps) + to.z,
    }
  }
}
