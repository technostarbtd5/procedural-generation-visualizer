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
const chunksize = 16;
const mouseZoomAmount = Math.pow(2, 1 / 225);
const minZoom = 1;
const maxZoom = 8;
const chunkRenderRadius = Math.floor(256 / chunksize);
const material = new THREE.MeshLambertMaterial({side: THREE.DoubleSide, vertexColors: true});
const mouseDragScalar = 400;

const KEY = {
  SHIFT: 16,
};

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
  shiftDown = false;
  shiftDownTheta = this.theta;
  mouseDownLocation = new THREE.Vector3();
  mouseDownSceneLocation = new THREE.Vector3();
  mouseDownScreenLocation = new THREE.Vector2();
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
  chunks = {};

  constructor() {
    
  }

  onMouseMove(event: MouseEvent): void {
    // console.log(event);
    // console.log(`${event.offsetX}, ${event.offsetY}`);
    const {offsetX, offsetY} = event;
    this.mouse.x = 2 * offsetX / this.canvasWidth - 1;
    this.mouse.y = - 2 * offsetY / this.canvasHeight + 1;
  }

  setMouseDragOrigin(): void {
    this.globalRaycaster.setFromCamera( this.mouse, this.globalCamera );
    const intersects = new THREE.Vector3();
    this.globalRaycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), intersects);
    this.mouseDownLocation = intersects;
    this.mouseDownSceneLocation = cloneDeep(this.globalScene.position);
  }

  setMouseRotateOrigin(): void {
    const {x, y} = this.mouse;
    this.mouseDownScreenLocation = new THREE.Vector2(x, y);
    this.shiftDownTheta = this.theta;
  }

  onMouseDown(event: MouseEvent): void {
    console.log("Mouse Down");
    // console.log(event);
    this.mouseDown = true;
    this.setMouseDragOrigin();
    if(this.shiftDown) { this.setMouseRotateOrigin(); }
  }

  @HostListener('mouseup', ['$event'])
  onMouseUp(event: MouseEvent): void {
    console.log("Mouse Up");
    // console.log(event);
    this.mouseDown = false;
  }

  @HostListener('window:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if(event.keyCode === KEY.SHIFT && !this.shiftDown) {
      console.log("Shift Down");
      this.shiftDown = true;
      if(this.mouseDown) { this.setMouseRotateOrigin(); }
    }
  }

  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent): void {
    if(event.keyCode === KEY.SHIFT && this.shiftDown) {
      console.log("Shift Up");
      this.shiftDown = false;
      if(this.mouseDown) { this.setMouseDragOrigin(); }
    }
  }

  onMouseWheel(event: WheelEvent): void {
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
    return this.zoom;
  }

  renderScene(): void {
    const width = this.canvasWidth;
    const viz_width = width;
    // let theta = 45;
    const height = this.canvasHeight;
    const scene = this.globalScene;
    // this.globalCamera = new THREE.OrthographicCamera(
    //   width / -2,
    //   width / 2,
    //   height / 2,
    //   height / -2,
    //   1,
    //   10000
    // );

    this.globalCamera = new THREE.OrthographicCamera(
      -400,
      400,
      800 * height / width / 2,
      800 * height / width / -2,
      1,
      10000
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

      // Drag mouse
      if(this.mouseDown) {
        // console.log(scene.position);
        if(this.shiftDown && !this.is2D) {
          const {x} = this.mouse;
          const xDiff = (this.mouseDownScreenLocation.x - x) * mouseDragScalar;
          this.theta = this.shiftDownTheta + xDiff;
          // console.log(`Theta set to ${this.theta}`);
        } else {
          const {x, z} = intersects;
          const xOffset = x - this.mouseDownLocation.x;
          const zOffset = z - this.mouseDownLocation.z;
          scene.position.x = xOffset + this.mouseDownSceneLocation.x;
          scene.position.z = zOffset + this.mouseDownSceneLocation.z;
        }
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
          // this.theta = 45;
          // console.log(this.theta);
          camera.position.x = cameraRadius * Math.sin( THREE.MathUtils.degToRad( this.theta ) );
          camera.position.z = cameraRadius * Math.cos( THREE.MathUtils.degToRad( this.theta ) );
          // console.log(`camera position: ${camera.position.x} ${camera.position.z}`);
          camera.lookAt(new THREE.Vector3(0, 0, 0));
        }
      }

      this.renderChunks(scene);

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
    
    const mesh = new THREE.Mesh(geometry, material);
    
    mesh.position.x = x * chunksize * scalar;
    mesh.position.z = y * chunksize * scalar;
    // const {mesh} = data;
    scene.add( mesh );
    this.chunks[this.stringifyCoords(new THREE.Vector2(x, y))] = mesh;
  }

  renderChunks(scene: THREE.Object3D): void {

    // 
    // range(-4, 4).forEach(x => {
    //   range(-4, 4).forEach(y => {
    //     this.renderChunkWithWorker(scene, x, y);
    //     // this.renderChunk(scene, x, y);
    //   });
    // });
    const chunk = this.getSceneChunk(scene);
    // console.log(`Scanning chunk from ${this.stringifyCoords(chunk)}`);
    range(chunk.x - chunkRenderRadius, chunk.x + chunkRenderRadius + 1).forEach(x => {
      range(chunk.y - chunkRenderRadius, chunk.y + chunkRenderRadius + 1).forEach(y => {
        this.renderChunkWithWorker(scene, x, y);
      });
    });


  }

  getSceneChunk(scene: THREE.Object3D): THREE.Vector2 {
    const chunkify = (position: number): number => Math.floor(-1 * position / chunksize / scalar) ;
    return new THREE.Vector2(chunkify(scene.position.x), chunkify(scene.position.z));
  }

  stringifyCoords = (coords: THREE.Vector2): string => `${coords.x}, ${coords.y}`;

  renderChunkWithWorker(scene: THREE.Object3D, x: number, y: number): void {
    const coordsString = this.stringifyCoords(new THREE.Vector2(x, y))
    if(this.chunks[coordsString]) { return; }
    this.chunks[coordsString] = true;
    // console.log(`Building chunk ${coordsString}`);
    if (typeof Worker !== 'undefined') {
      // Create a new
      // console.log("Creating Worker");
      const worker = new Worker('../chunk.worker.ts', { type: 'module' });
      worker.onmessage = ({ data }) => {
        this.activeWorkers--;
        this.renderQueue.push({x, y, data});
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


  ngOnInit(): void {
    this.canvasWidth = window.innerWidth/*Math.min(window.innerWidth, 800)*/;
    this.canvasHeight = window.innerHeight/*Math.min(window.innerHeight, 600)*/;
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
