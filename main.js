'use strict'

import * as Three from "three";
import * as Tween from "@tweenjs/tween.js";
import Stats from "stats.js"

import { PreloaderScene, ApartmentScene } from "./scenes";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";

let scene, stats, cam, renderer, controls, composer, interval;
let backgroundColor = new Three.Color(233 / 255, 229 / 255, 237 / 255);

window.isMobile = function() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
};

function init() {
    scene = new Three.Scene();

    cam = new Three.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight, 
        0.1, 
        1000
    );

    stats = new Stats();
    stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom

    renderer = new Three.WebGLRenderer({
        powerPreference: window.isMobile() ? "low-power" : "high-performance",
        canvas: document.querySelector("#threeCanvas"),
        alpha: true,
        antialias: true,
    });
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.outputEncoding = Three.sRGBEncoding;
    renderer.toneMapping = Three.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = Three.PCFSoftShadowMap;

    controls = new OrbitControls(cam, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 24;
    controls.maxDistance = window.isMobile ? 42 : 45;
    controls.maxPolarAngle = 2.5;

    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    function resize() {
        cam.aspect = window.innerWidth / window.innerHeight;
        renderer.setPixelRatio(window.devicePixelRatio);
        cam.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function onClick() {
        const threeCanvas = document.getElementById("threeCanvas");
        threeCanvas.style.zIndex = 1;
        
        const threeInFront = document.getElementsByClassName("threeInFront");
        for (let i = 0; i < threeInFront.length; i++) {
            threeInFront[i].style.opacity = 1;
        }

        const threeBehind = document.getElementsByClassName("threeBehind");
        for (let i = 0; i < threeBehind.length; i++) {
            threeBehind[i].style.opacity = 1;
        }

        const boot = document.getElementsByClassName("boot");
        for (let i = 0; i < threeBehind.length; i++) {
            boot[i].style.opacity = 0;
            boot[i].style.display = "none";
        }

        apartmentScene.environmentSetup()
        removeEventListener("click", onClick)

        setTimeout(() => {
            const card = document.getElementById("tutorialInfoCard");
            card.style.animation = "floatRight 0.55s ease-out 1";
            card.style.transform = "translateX(30px)";
        }, 1000);
    }

    const enterInteractive = document.getElementById("enterInteractive");
    enterInteractive.addEventListener("click", onClick);
    addEventListener("resize", resize);
}

function updateOptions() {
    renderer.setPixelRatio( window.devicePixelRatio * window.resolution ? 1.2 : 0.8 );
    renderer.shadowMap.enabled = window.shadows;
    renderer.antialias = window.edgeSmooth;
    interval = 1 / (window.frameCap ? 60 : 30);

    const statsExists = document.body.querySelector("#stats");

    if (window.stats && !statsExists) {
        document.body.appendChild(stats.dom).id = "stats";
    } else if (!window.stats && statsExists) {
        document.body.removeChild(stats.dom);
    }
}

init();

composer = new EffectComposer(renderer);

const apartmentScene = new ApartmentScene(scene, cam, renderer, composer, controls, backgroundColor);
const preloader = new PreloaderScene(scene, cam, renderer, composer, backgroundColor);

composer.renderToScreen = true;

const gltfLoad = new Event("gltfLoad", {"bubbles":true, "cancelable":false});

apartmentScene.GLTFSetup((value) => {
    let loadPercentText = document.getElementById("loadPercentText");
    let loadPercentBar = document.getElementById("loadPercentBar");

    let percentText = Math.round(value / 255 * 100).toString();

    loadPercentText.textContent = "0".repeat(3 - percentText.length) + percentText;
    loadPercentBar.style.width = percentText + "%";

    if (value === 1) {
        document.dispatchEvent(gltfLoad)
    }
})
preloader.environmentSetup()

cam.position.set(5, 5, 5)

controls.enabled = true;

window.shadows = !window.isMobile();
window.edgeSmooth = true;
window.resolution = true;
window.stats = false;
window.frameCap = !window.isMobile();

const clock = new Three.Clock();
let delta = 0;

function animate() {
	requestAnimationFrame(animate);
    delta += clock.getDelta();

    stats.begin();

    updateOptions();

    Tween.update();

    if (delta > interval) {
        if (controls.enabled) {
            controls.update();
        }
        if (!apartmentScene.loaded) {
            preloader.perFrame()
        } else if (apartmentScene.loaded) {
            apartmentScene.perFrame()
        }
    
        composer.render();

        delta = delta % interval;
    }

    stats.end();
}
animate();
