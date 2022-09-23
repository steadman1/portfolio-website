import * as Three from "three";
import * as Tween from "@tweenjs/tween.js";

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { FXAAEffect, EffectPass, RenderPass } from "postprocessing";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { MeshLine, MeshLineMaterial, MeshLineRaycast } from 'three.meshline';

import ApartmentGLTF from "./assets/apartment.gltf";

class ApartmentScene {
    scene: Three.Scene;
    cam: Three.Camera;
    renderer: Three.WebGLRenderer;
    composer: EffectComposer;
    controls: OrbitControls;
    apartmentLoaded: number;
    apartmentGLTF: Three.Mesh;
    loaded: Boolean;
    backgroundColor: Three.Color;
    sceneToAdd: Array<Three.Object3D>;
    sceneExtras: Array<Three.Object3D>;
    outlineElements: Record<string, string>;
    raycaster: Three.Raycaster;
    activeCameraView: String | null;

    constructor(scene, camera, renderer, composer, controls, backgroundColor) {
        this.scene = scene;
        this.cam = camera;
        this.renderer = renderer;
        this.composer = composer;
        this.controls = controls;
        this.apartmentLoaded = 0.0;
        this.apartmentGLTF = new Three.Mesh();
        this.loaded = false;
        this.backgroundColor = backgroundColor;
        this.sceneToAdd = new Array();
        this.sceneExtras = new Array();
        this.outlineElements = {
            "Cube029" : "record_box",
            "Cube032" : "record_box",
            "Sphere012" : "camera",
            "Sphere013" : "camera",
        }
        this.raycaster = new Three.Raycaster();
        this.activeCameraView = null;
    }

    GLTFSetup(progressCallback) {
        const gltfLoader = new GLTFLoader();

        const sceneToAdd = new Array();
        const sceneExtras = new Array();

        gltfLoader.load(ApartmentGLTF, (obj) => {
            obj.scene.traverse(function (object) {
                // const objHelper = new Three.BoxHelper(object);
                // scene.add(objHelper);
                if (object.isMesh) {
                    //object.material.flatShading = Three.SmoothShading;

                    if (!object.name.endsWith("_no_cast") || !object.name.endsWith("_outline")) {
                        object.castShadow = true;
                        object.receiveShadow = true;
                    }
                    object.matrixAutoUpdate = true;
                } else if (object.type == "PointLight"|| object.type == "SpotLight") {
                    object.intensity = object.intensity / 1400;
                    object.castShadow = true;
                    object.shadow.bias = -0.001;
    
                    object.shadow.mapSize.width = 512;
                    object.shadow.mapSize.height = 512;
                }
                if (object.name.endsWith("_outline")) {

                    const outlineMaterial = new Three.MeshBasicMaterial({color: 0xffffff, side: Three.BackSide});

                    function outlineMesh (i?: number) {
                        const mesh = i !== undefined ? object.children[i].clone() : object.clone();

                        mesh.material = outlineMaterial;

                        mesh.rotation.set(
                            object.rotation.x,
                            object.rotation.y,
                            object.rotation.z,
                        );

                        sceneToAdd.push([mesh, object]);
                    }

                    if (object.type === "Group") {
                        for (let i = 0; i < object.children.length; i++) {
                            outlineMesh(i);
                        }

                    } else {
                        outlineMesh()
                    }
                } else if (object.name.endsWith("_ex")) {
                    sceneExtras.push(object);
                }
            });
            this.sceneToAdd = sceneToAdd;
            this.sceneExtras = sceneExtras;
            this.apartmentGLTF = obj.scene;

        }, async (progress) => {
            progress.total = 62793993;
            this.apartmentLoaded = progress.loaded / progress.total;
            progressCallback(this.apartmentLoaded);
        });
    }

    environmentSetup() {
        this.scene.clear();

        // this.scene.background = this.backgroundColor;
    
        const resolution = new Three.Vector2( window.innerWidth, window.innerHeight );
        
        const bloomPass = new UnrealBloomPass(resolution, 0.9, 0.2, 0.98);
        const FXAAPass = new EffectPass(this.cam, new FXAAEffect());      
        const renderPass = new RenderPass(this.scene, this.cam);
        // this.composer.addPass(bloomPass);
        // this.composer.addPass(FXAAPass);
        this.composer.addPass(renderPass);
    
        const hemilight = new Three.HemisphereLight(0xFFFFFF, 0xFFFFFF, 0.3);
        this.scene.add(hemilight);
    
        this.cam.position.set(35, 12, 35);
        this.controls.target.set(0, 12, 0);
        this.renderer.shadowMap.autoUpdate = false;
        this.renderer.shadowMap.needsUpdate = true;

        this.scene.add(this.apartmentGLTF);
        this.sceneToAdd.forEach((obj) => {
            this.scene.add(obj[0]);
        });

        let fog = new Three.Fog(this.backgroundColor, 50, 70)
        this.scene.fog = fog
        
        const mouse = new Three.Vector2()

        let onClick = (event) => {

            mouse.x = ( event.layerX / window.innerWidth ) * 2 - 1;
            mouse.y = - ( event.layerY / window.innerHeight ) * 2 + 1;

            checkIntersection();

        }

        let checkIntersection = () => {

            this.raycaster.setFromCamera( mouse, this.cam );

            const intersects = this.raycaster.intersectObject( this.scene, true );

            if ( intersects.length > 0) {

                let intersect_split;
                let intersect = intersects[0].object;

                if (this.activeCameraView !== null) {
                    for (let i = 0; i < intersects.length; i++) {
                        intersect_split = intersects[i].object.name.split("_")[0]
                        if (this.outlineElements.hasOwnProperty(intersect_split) 
                            && this.outlineElements[intersect_split] !== "camera") {
                            
                            intersect = intersects[i].object;
                        } else if (!this.outlineElements.hasOwnProperty(intersect_split) 
                            && this.outlineElements[intersect_split] !== "camera") {

                            break
                        }
                    }
                }

                intersect_split = intersect.name.split("_")[0];

                if (this.outlineElements[intersect_split] === "camera" 
                    && intersect.visible
                    && this.outlineElements.hasOwnProperty(intersect_split)) {

                    this.cameraIntersect(intersect)
                } else if (this.outlineElements[intersect_split] === "record_box" 
                    && intersect.visible
                    && this.outlineElements.hasOwnProperty(intersect_split)) {

                    this.infoCardIntersect(false, mouse);
                }
            }
        }

        this.renderer.domElement.addEventListener(window.isMobile() ? "touchend" : "click", onClick);

        const returnViewButton = document.getElementById("returnMainView");
        returnViewButton?.addEventListener("click", () => this.returnView());

        const closeInfoCard = document.getElementsByClassName("closeIcon");
        for (let i = 0; i < closeInfoCard.length; i++) {
            closeInfoCard[i]?.addEventListener("click", () => this.infoCardIntersect(true)); 
        }

        this.loaded = true
    }

    private switchCameraView(cameraView) {
        const button = document.getElementById("returnMainView");
        if (button !==  null) {
            if (cameraView !== null) {
                button.style.opacity = "1";
                setTimeout(() => {
                    button.style.animation = "floatUp 0.3s ease-out 1";
                    button.style.transform = "translate(-50%, 0px)";
                }, 550)
            } else if (cameraView === null) {
                button.style.animation = "floatDown 0.3s ease-in-out 1";
                button.style.transform = "translate(-50%, 160px)";

                if (!this.controls.enabled) {
                    this.infoCardIntersect(true)
                }
            }
        }

        this.activeCameraView = cameraView;
    }

    private cameraIntersect(intersect) {
        const intersect_split = intersect.name.split("_")[0];

        const duration = 1100;

        const camTweenInto = new Tween.Tween(this.cam.position)
            .to(intersect.parent.position, duration)
            .easing(Tween.Easing.Cubic.InOut);

        camTweenInto.onUpdate((obj: { x: any; y: any; z: any; }, elapsed: number) => {
            this.cam.position.set(obj.x, obj.y, obj.z);    
        });

        const targetTweenInto = new Tween.Tween(this.controls.target)
            .to({
                x: intersect.parent.position.x,
                y: intersect.parent.position.y,
                z: intersect.parent.position.z - 8,
            }, duration)
            .easing(Tween.Easing.Cubic.InOut);

        targetTweenInto.onUpdate((obj: { x: any; y: any; z: any; }, elapsed: number) => {
            this.controls.target.set(obj.x, obj.y, obj.z)
        });

        targetTweenInto.onComplete(() => {
            this.controls.target.set(
                intersect.parent.position.x,
                intersect.parent.position.y,
                intersect.parent.position.z - 0.01,
            );  
        })

        this.controls.minDistance = 0;
        this.controls.maxPolarAngle = Math.PI;

        targetTweenInto.start()
        camTweenInto.start()

        const returnVisible = (obj, name) => obj.name.startsWith(name);

        for (let i = 0; i < this.scene.children.length; i++) {
            const sceneChild = this.scene.children[i];
            const sceneToAddChild = this.sceneToAdd.length > i ? this.sceneToAdd[i][1] : null;

            sceneChild.visible = !returnVisible(sceneChild, intersect_split);
            if (sceneToAddChild !== null) {
                sceneToAddChild.children.forEach((obj) => {
                    obj.visible = !returnVisible(obj, intersect_split);
                });
            }
        }
        
        this.switchCameraView(intersect_split);
    }

    private deleteAllSelectors() {
        const selectors = document.getElementsByClassName("selector");

        for (let i = 0; i < selectors.length; i++) {
            selectors[i].style.animation = "deflate 0.15s ease-in 1";
            selectors[i].style.transform = "scale(0%)";
        }

        setTimeout(() => {
            const selectorsLength = selectors.length;

            for (let i = 0; i < selectorsLength; i++) {
                selectors[0].remove();
            }
        }, 150)
    }

    private deleteFirstSelector() {
        const selectors = document.getElementsByClassName("selector");

        const i = 0;

        selectors[i].style.animation = "deflate 0.15s ease-in 1";
        selectors[i].style.transform = "scale(0%)";

        setTimeout(() => {
            selectors[i].remove();
        }, 150)
    }

    private infoCardIntersect(close?: boolean, mouse?: Three.Vector2) {

        if (this.activeCameraView === null) return

        const recordBoxCard = document.getElementsByClassName("infoCard");
        for (let i = 0; i < recordBoxCard.length; i++) {
            const card = recordBoxCard[i];

            if (card !==  null) {
                
                const selector = document.createElement("div");
                selector.classList.add("selector");

                const selectors = document.getElementsByClassName("selector");

                if (close) {
                    if (selector !== null) {
                        this.deleteAllSelectors();
                    }

                    this.controls.enabled = true;
                    card.style.animation = "floatLeft 0.4s ease-in-out 1";
                    card.style.transform = "translate(var(--card-float))";
                } else {

                    if (selector !== null && mouse !== undefined) {

                        if (selectors.length > 0) {
                            this.deleteFirstSelector();
                        }
                        
                        document.body.appendChild(selector);

                        let width = parseInt(getComputedStyle(selector).width.replace("px", ""));

                        let coord = (x, size) => (x - size).toString() + "px"

                        selector.style.bottom = coord((mouse.y + 1) / 2 * window.innerHeight, width - 10);
                        selector.style.left = coord((mouse.x + 1) / 2 * window.innerWidth, width / 2);

                        selector.style.animation = "expand 0.2s ease-out 1";
                        selector.style.transform = "scale(100%)";
                    }

                    this.controls.enabled = false;
                    card.style.animation = "floatRight 0.55s ease-out 1";
                    card.style.transform = "translateX(0px)";
                }
            }
        }
    }

    private returnView() {

        if (this.activeCameraView !== null) {

            const target = new Three.Vector3(
                this.controls.target.x, 
                this.controls.target.y, 
                this.controls.target.z - 8,
            )
            this.controls.target = target;

            const camTweenOut = new Tween.Tween(this.cam.position)
                .to({x: 28, y: 12, z: 28,}, 800)
                .easing(Tween.Easing.Cubic.InOut);

            camTweenOut.onUpdate((obj: { x: any; y: any; z: any; }, elapsed: number) => {
                this.cam.position.set(obj.x, obj.y, obj.z); 
                this.controls.target.set(0, 12, 0);        
            });

            const targetTweenOut = new Tween.Tween(target)
                .to({x: 0, y: 12, z: 0,}, 800)
                .easing(Tween.Easing.Quadratic.InOut);

            targetTweenOut.onUpdate((obj: { x: any; y: any; z: any; }, elapsed: number) => {
                this.controls.target.set(obj.x, obj.y, obj.z)
            });

            targetTweenOut.onComplete(() => {
                this.controls.minDistance = 24;
                this.controls.maxPolarAngle = 2.5;
            })

            targetTweenOut.start()
            camTweenOut.start()

            const activeCameraViewTemp = this.activeCameraView;
            const returnVisible = (obj) => obj.name.startsWith(activeCameraViewTemp) ? true : obj.visble;

            setTimeout(() => {
                for (let i = 0; i < this.scene.children.length; i++) {
                    const sceneChild = this.scene.children[i];
                    const sceneToAddChild = this.sceneToAdd.length > i ? this.sceneToAdd[i][1] : null;
    
                    sceneChild.visible = returnVisible(sceneChild);
                    if (sceneToAddChild !== null) {
                        sceneToAddChild.children.forEach((obj) => {
                            obj.visible = returnVisible(obj);
                        });
                    }
                }
            }, 300);

            this.switchCameraView(null);
        }
    }

    perFrame() {
        const scaleBy = 1.06 + (this.controls.getDistance() / this.controls.maxDistance) / 7;

        this.sceneToAdd.forEach((obj) => {
            const mesh = obj[0];
            const parent = obj[1];
            mesh.position.set(
                parent.position.x,
                parent.position.y,
                parent.position.z,
            );
            mesh.scale.set(
                parent.scale.x * scaleBy,
                parent.scale.y * scaleBy,
                parent.scale.z * scaleBy,
            );
            if (parent.name.endsWith("camera_outline")) {
                // mesh.lookAt(this.cam.position)
                // parent.lookAt(this.cam.position)

                const camQuat = this.cam.quaternion;
                mesh.quaternion.copy(camQuat);
                parent.quaternion.copy(camQuat);
            }
        })
    }
}

class PreloaderScene {
    scene: Three.Scene;
    cam: Three.Camera;
    renderer: Three.WebGLRenderer;
    composer: EffectComposer;
    loaded: Boolean;
    boxMesh: Three.Mesh;
    mesh: Three.Mesh;
    backgroundColor: Three.Color;

    constructor(scene, camera, renderer, composer, backgroundColor) {
        this.scene = scene;
        this.cam = camera;
        this.renderer = renderer;
        this.composer = composer;
        this.loaded = false;
        this.boxMesh = new Three.Mesh();
        this.mesh = new Three.Mesh();
        this.backgroundColor = backgroundColor;
    }

    environmentSetup() {       
        const points = [
            new Three.Vector3(-1.0, -1.0,  -1.0),
            new Three.Vector3(1.0, -1.0,  -1.0),

            new Three.Vector3(-1.0, -1.0,  -1.0),
            new Three.Vector3(-1.0, -1.0,  1.0),

            new Three.Vector3(1.0, -1.0,  1.0),
            new Three.Vector3(-1.0, -1.0,  1.0),

            new Three.Vector3(1.0, -1.0,  1.0),
            new Three.Vector3(1.0, -1.0,  -1.0),
            // bottom square

            new Three.Vector3(1.0, 1.0,  -1.0),
            new Three.Vector3(1.0, 1.0,  -1.0),

            new Three.Vector3(-1.0, 1.0,  -1.0),
            new Three.Vector3(-1.0, 1.0,  1.0),

            new Three.Vector3(1.0, 1.0,  1.0),
            new Three.Vector3(-1.0, 1.0,  1.0),

            new Three.Vector3(1.0, 1.0,  1.0),
            new Three.Vector3(1.0, 1.0,  -1.0),
            // top square

            new Three.Vector3(-1.0, 1.0,  -1.0),
            new Three.Vector3(-1.0, -1.0,  -1.0),
            
            new Three.Vector3(-1.0, -1.0,  -1.0),

            new Three.Vector3(-1.0, -1.0,  -1.0),
            new Three.Vector3(-1.0, 1.0,  -1.0),

            new Three.Vector3(1.0, 1.0,  -1.0),

            new Three.Vector3(1.0, 1.0,  1.0),
            new Three.Vector3(1.0, -1.0,  1.0),

            new Three.Vector3(1.0, -1.0,  1.0),

            new Three.Vector3(-1.0, -1.0,  1.0),
            new Three.Vector3(-1.0, 1.0,  1.0),
        ];

        const geometry = new Three.BufferGeometry().setFromPoints(points);
        const line = new MeshLine();
        line.setGeometry(geometry);

        const material = new MeshLineMaterial({
            useMap: false,
            color: new Three.Color("black"),
            opacity: 1,
            resolution: new Three.Vector2(window.innerWidth, window.innerHeight),
            sizeAttenuation: false,
            lineWidth: 15,
        });

        this.mesh = new Three.Mesh(line, material);

        let size = 1.98;
        const box = new Three.BoxGeometry(size, size, size)
        const mat = new Three.MeshBasicMaterial({color: new Three.Color("white")})
        this.boxMesh = new Three.Mesh(box, mat)

        this.scene.add(this.mesh, this.boxMesh);

        this.cam.lookAt(0,0,0);
        
        this.loaded = true
    }

    perFrame() {
        // console.log(this.boxMesh.position)
    }
}

export { PreloaderScene, ApartmentScene }
