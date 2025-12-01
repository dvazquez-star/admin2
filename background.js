import * as THREE from 'three';

let scene, camera, renderer, particles;
const canvasContainer = document.getElementById('three-canvas');

function animate() {
    requestAnimationFrame(animate);

    particles.rotation.x += 0.0001;
    particles.rotation.y += 0.0002;

    renderer.render(scene, camera);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

export function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 50;

    renderer = new THREE.WebGLRenderer({ alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    canvasContainer.appendChild(renderer.domElement);

    const particleCount = 5000;
    const vertices = [];
    for (let i = 0; i < particleCount; i++) {
        const x = (Math.random() - 0.5) * 200;
        const y = (Math.random() - 0.5) * 200;
        const z = (Math.random() - 0.5) * 200;
        vertices.push(x, y, z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0x00ffff,
        size: 0.1,
        transparent: true,
        blending: THREE.AdditiveBlending,
        opacity: 0.7,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);

    animate();
    window.addEventListener('resize', onWindowResize, false);
}

