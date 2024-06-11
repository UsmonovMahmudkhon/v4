import * as THREE from 'three';
import { ARButton } from 'three/examples/jsm/webxr/ARButton.js';

let container, camera, scene, renderer;
let reticle, controller;
let currentImageMesh = null;
let hitTestSource = null;
let hitTestSourceRequested = false;
let session;

document.getElementById('arButton').addEventListener('click', startAR);

function startAR() {
    // Hide the AR button
    document.getElementById('arButton').style.display = 'none';

    initThreeJS();
    initAR();
}

function initThreeJS() {
    // Create Three.js scene
    container = document.getElementById('container');

    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // Add lighting
    const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
    light.position.set(0.5, 1, 0.25);
    scene.add(light);

    // Add reticle
    const geometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial();
    reticle = new THREE.Mesh(geometry, material);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Add controller
    controller = renderer.xr.getController(0);
    controller.addEventListener('select', onSelect);
    scene.add(controller);

    // Handle gestures
    const hammer = new Hammer(renderer.domElement);
    hammer.get('pinch').set({ enable: true });
    hammer.on('pinch', onPinch);
    hammer.on('rotate', onRotate);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);
}

function initAR() {
    // Request AR session
    navigator.xr.requestSession('immersive-ar', {
        requiredFeatures: ['hit-test']
    }).then((xrSession) => {
        session = xrSession;
        renderer.xr.setSession(xrSession);
        session.addEventListener('end', onSessionEnd);
        xrSession.requestReferenceSpace('viewer').then((referenceSpace) => {
            xrSession.requestHitTestSource({ space: referenceSpace }).then((source) => {
                hitTestSource = source;
            });
        });
    });
}

function onSessionEnd() {
    hitTestSourceRequested = false;
    hitTestSource = null;
    session = null;
    document.getElementById('arButton').style.display = 'block';
}

function onSelect() {
    if (reticle.visible && currentImageMesh) {
        currentImageMesh.position.setFromMatrixPosition(reticle.matrix);
        currentImageMesh.quaternion.setFromRotationMatrix(reticle.matrix);
        scene.add(currentImageMesh);
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

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
    if (frame) {
        const referenceSpace = renderer.xr.getReferenceSpace();
        const session = renderer.xr.getSession();

        if (!hitTestSourceRequested) {
            session.requestReferenceSpace('viewer').then((referenceSpace) => {
                session.requestHitTestSource({ space: referenceSpace }).then((source) => {
                    hitTestSource = source;
                });
            });
            session.addEventListener('end', () => {
                hitTestSourceRequested = false;
                hitTestSource = null;
            });
            hitTestSourceRequested = true;
        }

        if (hitTestSource) {
            const viewerPose = frame.getViewerPose(referenceSpace);
            if (viewerPose) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length > 0) {
                    const hit = hitTestResults[0];
                    reticle.visible = true;
                    reticle.matrix.fromArray(hit.getPose(referenceSpace).transform.matrix);
                } else {
                    reticle.visible = false;
                }
            }
        }
    }

    renderer.render(scene, camera);
}

document.getElementById('imageUpload').addEventListener('change', (event) => {
    const file = event.target.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(e.target.result, function (texture) {
            const material = new THREE.MeshBasicMaterial({ map: texture });
            const geometry = new THREE.PlaneGeometry(1, 1);
            currentImageMesh = new THREE.Mesh(geometry, material);
            currentImageMesh.visible = false;
            scene.add(currentImageMesh);
        });
    };

    reader.readAsDataURL(file);
});

animate();
