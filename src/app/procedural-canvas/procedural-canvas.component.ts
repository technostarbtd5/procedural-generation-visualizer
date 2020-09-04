import { Component, ViewChild, ElementRef, OnInit, HostListener } from '@angular/core';
import getChunk from './chunk';
import * as THREE from 'three';
import { range, isEqual, cloneDeep } from 'lodash';
import Stats from 'stats-js';
import { normalizeGenFileSuffix } from '@angular/compiler/src/aot/util';
import { Scene } from 'three';

interface PathPoint {
  x: number;
  y: number;
  z: number;
}

// worker.postMessage({x, y, seed, scalar, chunksize});
interface ChunkWorkerData {
  x: number;
  y: number;
  seed: number;
  scalar: number;
  chunksize: number;
}

interface ChunkQueueWorker {
  worker: Worker;
  data: ChunkWorkerData;
}

const cameraRadius = 500;
// const seed = Math.floor(Math.random() * (2 ** 32));
// const maxWorkers = 256; // Should be near global CPU thread maximum
const maxWorkers = 16;
const scalar = 2;
const chunksize = 64;
const mouseZoomAmount = Math.pow(2, 1 / 225);
const minZoom = 1;
const maxZoom = 8;

@Component({
  selector: 'app-procedural-canvas',
  templateUrl: './procedural-canvas.component.html',
  styleUrls: ['./procedural-canvas.component.css'],
})
export class ProceduralCanvasComponent implements OnInit {
  @ViewChild('canvas') private canvasRef: ElementRef;



  is2D = true;
  theta = 45;
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
  seed = Math.floor(Math.random() * (2 ** 32));
  chunkWorkerQueue: ChunkQueueWorker[] = [];
  activeWorkers = 0;
  renderQueue = [];
  mouse = new THREE.Vector2(0, 1);
  mouseDown = false;
  mouseDownLocation = new THREE.Vector3();
  mouseDownSceneLocation = new THREE.Vector3();
  globalRaycaster = new THREE.Raycaster();
  globalCamera = new THREE.OrthographicCamera(
    800 / -2,
    800 / 2,
    600 / 2,
    600 / -2,
    1,
    1000
  );
  globalScene = new THREE.Scene();
  globalRender = new THREE.WebGLRenderer();
  // globalControls = new OrbitControls(this.globalCamera, this.globalRender);
  zoom = 1;

  constructor() {
    
  }

  onMouseMove(event): void {
    // console.log(event);
    // console.log(`${event.offsetX}, ${event.offsetY}`);
    const {offsetX, offsetY} = event;
    this.mouse.x = 2 * offsetX / this.canvasWidth - 1;
    this.mouse.y = - 2 * offsetY / this.canvasHeight + 1;
  }

  onMouseDown(event): void {
    console.log("Mouse Down");
    // console.log(event);
    this.mouseDown = true;
    this.globalRaycaster.setFromCamera( this.mouse, this.globalCamera );
    const intersects = new THREE.Vector3();
    this.globalRaycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersects);
    this.mouseDownLocation = intersects;
    this.mouseDownSceneLocation = cloneDeep(this.globalScene.position);
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event): void {
    console.log("Mouse Up");
    // console.log(event);
    this.mouseDown = false;
  }

  onMouseWheel(event): void {
    const {deltaY} = event;
    const oldZoom = this.zoom;

    this.globalRaycaster.setFromCamera( this.mouse, this.globalCamera );
    const intersects = new THREE.Vector3();
    this.globalRaycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersects);

    const newZoom = this.changeZoom(deltaY);


    const {x, z} = intersects;
    const zoomOffset = oldZoom / newZoom;
    this.globalScene.position.x -= x - x * zoomOffset;
    this.globalScene.position.z -= z - z * zoomOffset;
  }

  changeZoom(deltaY: number): number {
    const newZoom = this.zoom * Math.pow(mouseZoomAmount, -deltaY);
    this.zoom = Math.max(Math.min(newZoom, maxZoom), minZoom);
    this.globalCamera.zoom = this.zoom;
    this.globalCamera.updateProjectionMatrix();
    // this.globalCamera.top = this.canvasHeight / this.zoom / 2;
    // this.globalCamera.bottom = this.canvasHeight / this.zoom / -2;
    // this.globalCamera.right = this.canvasWidth / this.zoom / 2;
    // this.globalCamera.left = this.canvasWidth / this.zoom / -2;
    return this.zoom;
  }

  renderScene(): void {
    const width = this.canvasWidth;
    const viz_width = width;
    // let theta = 45;
    const height = this.canvasHeight;
    const scene = this.globalScene;
    this.globalCamera = new THREE.OrthographicCamera(
      width / -2,
      width / 2,
      height / 2,
      height / -2,
      1,
      1000
    );
    const camera = this.globalCamera;

    const renderer = this.globalRender;
    renderer.setSize(width, height);
    this.canvasRef.nativeElement.append(renderer.domElement);
    const stats = new Stats();
    this.canvasRef.nativeElement.append(stats.dom);

    this.renderChunks(scene);
    camera.position.y = 600;
    camera.lookAt(scene.position);

    const light = new THREE.DirectionalLight( 0xffffff, 0.9 );
    light.position.set(0, 10, 10);
    light.target.position.set(-5, 0, 0);
    scene.add( light );
    scene.add( light.target );
    const raycaster = this.globalRaycaster;
    
    const animate = () => {
      requestAnimationFrame(animate);
      raycaster.setFromCamera( this.mouse, camera );
      const intersects = new THREE.Vector3();
      raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersects);
      // console.log(`Plane intersects:`);
      // console.log(intersects);

      // console.log(`Active workers: ${this.activeWorkers}`);
      if(this.activeWorkers < maxWorkers && this.chunkWorkerQueue.length > 0) {
        const numWorkersToSend = Math.min(maxWorkers - this.activeWorkers, this.chunkWorkerQueue.length);
        range(numWorkersToSend).forEach(() => {
          const {worker, data} = this.chunkWorkerQueue.shift();
          worker.postMessage(data);
          this.activeWorkers++;
        });
      }

      if(this.mouseDown) {
        // console.log(scene.position);
        const {x, z} = intersects;
        const xOffset = x - this.mouseDownLocation.x;
        const zOffset = z - this.mouseDownLocation.z;
        scene.position.x = xOffset + this.mouseDownSceneLocation.x;
        scene.position.z = zOffset + this.mouseDownSceneLocation.z;
      }

      if(this.renderQueue.length > 0) {
        const data = this.renderQueue.shift();
        this.addChunkToScene(scene, data);
      }

      if(this.pathToTrace.isActive) {
        const {x, y, z} = this.getPathPosition();
        camera.position.x = x;
        camera.position.y = y;
        camera.position.z = z;
        this.pathToTrace.stepsRemaining--;
        if(this.pathToTrace.stepsRemaining === 0) {
          this.pathToTrace.isActive = false;
        }
        camera.lookAt(new THREE.Vector3(0, 0, 0));
      } else {
        if(this.is2D) {
          camera.position.x = 0;
          camera.position.z = 0;
          camera.lookAt(new THREE.Vector3(0, 0, 0));
        } else {
          // this.theta += 0.1;
          this.theta = 45;
          // console.log(this.theta);
          camera.position.x = cameraRadius * Math.sin( THREE.MathUtils.degToRad( this.theta ) );
          camera.position.z = cameraRadius * Math.cos( THREE.MathUtils.degToRad( this.theta ) );
          // console.log(`camera position: ${camera.position.x} ${camera.position.z}`);
          camera.lookAt(new THREE.Vector3(0, 0, 0));
        }
      }
      renderer.render(scene, camera);
      stats.update();
    };

    animate();
  }

  addChunkToScene(scene: THREE.Object3D, allData): void {
    const geometry = new THREE.BufferGeometry();
    const {x, y, data} = allData;
    const {vertices, normals, colors} = data;
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshLambertMaterial({side: THREE.DoubleSide, vertexColors: true});
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.x = x * chunksize * scalar;
    mesh.position.z = y * chunksize * scalar;
    // const {mesh} = data;
    scene.add( mesh );
  }

  renderChunks(scene: THREE.Object3D): void {
    
    // const geometry = new THREE.BoxBufferGeometry(scalar, scalar, scalar);
    range(-4, 4).forEach(x => {
      range(-4, 4).forEach(y => {
        this.renderChunkWithWorker(scene, x, y);
        // this.renderChunk(scene, x, y)s;
      });
    });
  }

  renderChunkWithWorker(scene: THREE.Object3D, x: number, y: number): void {
    if (typeof Worker !== 'undefined') {
      // Create a new
      console.log("Creating Worker");
      const worker = new Worker('../chunk.worker.ts', { type: 'module' });
      worker.onmessage = ({ data }) => {
        // console.log(`page got message: ${JSON.stringify(data)}`);
        this.activeWorkers--;
        this.renderQueue.push({x, y, data});
        // const geometry = new THREE.BufferGeometry();
        // const {vertices, normals, colors} = data;
        // geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        // geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        // geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        // const material = new THREE.MeshLambertMaterial({side: THREE.DoubleSide, vertexColors: true});
        // const mesh = new THREE.Mesh(geometry, material);
        
        // mesh.position.x = x * chunksize * scalar;
        // mesh.position.z = y * chunksize * scalar;
        // // const {mesh} = data;
        // scene.add( mesh );
      };
      const seed = this.seed;
      const data = {x, y, seed, scalar, chunksize};
      this.addWorker({worker, data})
      // worker.postMessage({x, y, seed, scalar, chunksize});
    } else {
      console.log("No worker found");
      // Web workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
    }
  }

  addWorker(worker: ChunkQueueWorker): void {
    this.chunkWorkerQueue.push(worker);
  }



  // async renderChunk(scene: THREE.Object3D, x: number, y: number): Promise<void> {
  //   const scalar = 8;
  
  //   const chunkPromise = new Promise((resolve, reject) => {
  //     const chunk = getChunk(x, y, 16);

  //     const geometry = new THREE.BufferGeometry();

  //     const vertices = [];
  //     const normals = [];
  //     const colors = [];
      
  //     // const h2c = this.heightToColor;
  //     const pushSurfaceSquare = (chunkX: number, chunkY: number, height: number) => {
  //       const x1 = chunkX * scalar - scalar * 8;
  //       const x2 = x1 + scalar;
  //       const y1 = chunkY * scalar - scalar * 8;
  //       const y2 = y1 + scalar;
  //       const h = height * scalar + scalar;

  //       vertices.push(x1, h, y1);
  //       vertices.push(x2, h, y2);
  //       vertices.push(x2, h, y1);
  //       vertices.push(x1, h, y1);
  //       vertices.push(x1, h, y2);
  //       vertices.push(x2, h, y2);

  //       const colorRGB = this.heightToColor(height);
  //       const red = Math.floor(colorRGB / (256 ** 2)) / 255;
  //       const green = Math.floor((colorRGB % (256 ** 2)) / 256) / 255;
  //       const blue = (colorRGB % 256) / 255;

  //       range(6).forEach(() => {
  //         colors.push(red, green, blue);
  //         normals.push(0, 1, 0);
  //       });
  //     };

  //     chunk.forEach((row, chunkX) => {
  //       row.forEach((height, chunkY) => {
  //         // First implementation
  //         // const geometry = new THREE.BoxGeometry(scalar, scalar, scalar);
  //         // const material = new THREE.MeshPhongMaterial({ color: this.heightToColor(height) });
  //         // const cube = new THREE.Mesh(geometry, material);
  //         // cube.position.y = height * scalar + scalar / 2;
  //         // cube.position.x = (x * 16 + chunkX) * scalar;
  //         // cube.position.z = (y * 16 + chunkY) * scalar;

  //         // const geometry2 = new THREE.BoxGeometry(scalar, height * scalar, scalar);
  //         // const material2 = new THREE.MeshPhongMaterial({ color: 0x221100 });
  //         // const stack = new THREE.Mesh(geometry2, material2);
  //         // stack.position.y = height * scalar / 2;
  //         // stack.position.x = (x * 16 + chunkX) * scalar;
  //         // stack.position.z = (y * 16 + chunkY) * scalar;

  //         // Buffered
  //         // const material = new THREE.MeshLambertMaterial({ color: this.heightToColor(height) })
  //         // const cube = new THREE.Mesh(geometry, material);
  //         // cube.position.y = height * scalar + scalar / 2;
  //         // cube.position.x = (x * 16 + chunkX) * scalar;
  //         // cube.position.z = (y * 16 + chunkY) * scalar;

  //         // const material2 = new THREE.MeshLambertMaterial({ color: 0x221100 });
  //         // const stack = new THREE.Mesh(geometry, material2);
  //         // stack.position.y = height * scalar / 2;
  //         // stack.position.x = (x * 16 + chunkX) * scalar;
  //         // stack.position.z = (y * 16 + chunkY) * scalar;
  //         // stack.scale.y = height;

  //         // scene.add(cube);
  //         // scene.add(stack);

  //         // One mesh
  //         pushSurfaceSquare(chunkX, chunkY, height);
  //       });
  //     });

  //     // console.log(vertices);
  //     // console.log(normals);
  //     // console.log(colors);
  //     geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  //     geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  //     geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  //     const material = new THREE.MeshLambertMaterial({side: THREE.DoubleSide, vertexColors: true});
  //     const mesh = new THREE.Mesh(geometry, material);
      
  //     mesh.position.x = x * 16 * scalar;
  //     mesh.position.z = y * 16 * scalar;

  //     scene.add( mesh );
  //     resolve();
  //   });
  //   return chunkPromise.then(() => {
  //     console.log(`Chunk ${x}, ${y} loaded;`);
  //   });
  // }

  // heightToColor(height: number): number {
  //   const minValue = 0;
  //   const maxValue = 128;
  //   const color = Math.floor(255 * (height - minValue) / (maxValue - minValue));
  //   // return color * 256 * 256 + color * 256 + color;
  //   return 256 * color;
  // }

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
      z: 100,
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
