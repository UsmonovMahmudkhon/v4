import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

let container, camera, scene, renderer;
let reticle, controller;
let currentImageMesh = null;

init();
animate();

function init() {
    container = document.createElement('div');
    document.body.appendChild(container);

    // Setup scene
    scene = new THREE.Scene();

    // Setup camera
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // AR button for entering AR mode
    document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

    // Lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // Reticle
    const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial();
    reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Controller
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Image upload handling
    const imageUpload = document.getElementById('imageUpload');
    imageUpload.addEventListener('change', onImageUpload);

    // Gesture handling
    const hammer = new Hammer(renderer.domElement);
    hammer.get('pinch').set({ enable: true });
    hammer.on('pinch', onPinch);
    hammer.on('rotate', onRotate);
}

function onImageUpload(event) {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(e.target.result, function (texture) {
            const material = new THREE.MeshBasicMaterial({ map: texture });
            const geometry = new THREE.PlaneGeometry(1, 1);
            currentImageMesh = new THREE.Mesh(geometry, material);
            console.log('Image mesh created:', currentImageMesh);
        }, undefined, function (err) {
            console.error('An error occurred:', err);
        });
    };

    reader.readAsDataURL(file);
}

function onSelect() {
    if (reticle.visible && currentImageMesh) {
        currentImageMesh.position.setFromMatrixPosition(reticle.matrix);
        currentImageMesh.quaternion.setFromRotationMatrix(reticle.matrix);
        scene.add(currentImageMesh);
        console.log('Image placed at:', currentImageMesh.position);
    }
}

function onPinch(event) {
    if (currentImageMesh) {
        const scale = event.scale;
        currentImageMesh.scale.set(scale, scale, scale);
    }
}

function onRotate(event) {
    if (currentImageMesh) {
        currentImageMesh.rotation.z += event.rotation * (Math.PI / 180);
    }
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        const viewerPose = frame.getViewerPose(referenceSpace);

        const hitTestSource = session.requestHitTestSource({ space: referenceSpace });
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
            const hit = hitTestResults[0];
            reticle.visible = true;
            reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
        } else {
            reticle.visible = false;
        }
    }

    renderer.render(scene, camera);
}
