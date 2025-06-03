import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import tableMatImage from "./table.png";
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// SECTION constants
const candleRadius = 0.35;       // Base radius of the candle
const candleHeight = 3.5;        // Total height of the candle
const candleCount = 5;           // Number of candles

const baseRadius = 2.5;          // Base radius of the cake
const baseHeight = 2;            // Height of the cake base
const middleRadius = 2;          // Middle radius of the cake
const middleHeight = 1.25;       // Height of the cake middle
const topRadius = 1.5;           // Top radius of the cake
const topHeight = 1;             // Height of the cake top

const tableHeightOffset = 1;

// ─────────────────────────────────────────────────────────────────────────────
// 1) SET UP SCENE, CAMERA, RENDERER, CONTROLS, LIGHTS
// ─────────────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	1,
	1000
);
camera.position.set(3, 5, 8).setLength(15);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x101005);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minPolarAngle = THREE.MathUtils.degToRad(60);
controls.maxPolarAngle = THREE.MathUtils.degToRad(95);
controls.minDistance = 4;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 1;
controls.target.set(0, 2, 0);
controls.update();

const dirLight = new THREE.DirectionalLight(0xffffff, 0.025);
dirLight.position.setScalar(10);
scene.add(dirLight);
scene.add(new THREE.AmbientLight(0xffffff, 0.05));

// ─────────────────────────────────────────────────────────────────────────────
// 2) FLAME SHADER MATERIAL & HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
function getFlameMaterial(isFrontSide) {
	let side = isFrontSide ? THREE.FrontSide : THREE.BackSide;
	return new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0 }
		},
		vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying float hValue;

      // 2D Random
      float random(in vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }

      // 2D Noise based on Morgan McGuire
      float noise(in vec2 st) {
        vec2 i = floor(st);
        vec2 f = fract(st);
        float a = random(i);
        float b = random(i + vec2(1.0, 0.0));
        float c = random(i + vec2(0.0, 1.0));
        float d = random(i + vec2(1.0, 1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a, b, u.x) +
               (c - a)* u.y * (1.0 - u.x) +
               (d - b) * u.x * u.y;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;
        pos *= vec3(0.8, 2, 0.725);
        hValue = position.y;
        float posXZlen = length(position.xz);

        pos.y *= 1. + (
          cos((posXZlen + 0.25) * 3.1415926) * 0.25 +
          noise(vec2(0, time)) * 0.125 +
          noise(vec2(position.x + time, position.z + time)) * 0.5
        ) * position.y;

        pos.x += noise(vec2(time * 2., (position.y - time) * 4.0)) * hValue * 0.0312;
        pos.z += noise(vec2((position.y - time) * 4.0, time * 2.)) * hValue * 0.0312;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `,
		fragmentShader: `
      varying float hValue;
      varying vec2 vUv;

      vec3 heatmapGradient(float t) {
        return clamp(
          (pow(t, 1.5) * 0.8 + 0.2) *
          vec3(
            smoothstep(0.0, 0.35, t) + t * 0.5,
            smoothstep(0.5, 1.0, t),
            max(1.0 - t * 1.7, t * 7.0 - 6.0)
          ), 0.0, 1.0
        );
      }

      void main() {
        float v = abs(smoothstep(0.0, 0.4, hValue) - 1.);
        float alpha = (1. - v) * 0.99;
        alpha -= 1. - smoothstep(1.0, 0.97, hValue);
        vec3 color = heatmapGradient(smoothstep(0.0, 0.3, hValue)) * vec3(0.95, 0.95, 0.4);
        color = mix(vec3(0, 0, 1), color, smoothstep(0.0, 0.3, hValue));
        color += vec3(1, 0.9, 0.5) * (1.25 - vUv.y);
        color = mix(color, vec3(0.66, 0.32, 0.03), smoothstep(0.95, 1.0, hValue));
        gl_FragColor = vec4(color, alpha);
      }
    `,
		transparent: true,
		side: side
	});
}

let flameMaterials = [];
function flame() {
	const flameGeo = new THREE.SphereGeometry(0.5, 32, 32);
	flameGeo.translate(0, 0.5, 0);
	const flameMat = getFlameMaterial(true);
	flameMaterials.push(flameMat);
	const flameMesh = new THREE.Mesh(flameGeo, flameMat);
	flameMesh.position.set(0.06, candleHeight, 0.06);
	flameMesh.rotation.y = THREE.MathUtils.degToRad(-45);
	return flameMesh;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) CREATE CANDLE MESH (WITHOUT FLAME) AND ADD LIGHT + FLAME
// ─────────────────────────────────────────────────────────────────────────────
function createCandle() {
	// Candle body using LatheGeometry
	const casePath = new THREE.Path();
	casePath.moveTo(0, 0);
	casePath.lineTo(0, 0);
	casePath.absarc(0, 0, candleRadius, Math.PI * 1.5, Math.PI * 2);
	casePath.lineTo(candleRadius, candleHeight);
	const caseGeo = new THREE.LatheGeometry(casePath.getPoints(), 64);
	const caseMat = new THREE.MeshStandardMaterial({ color: 0xff4500 });
	const caseMesh = new THREE.Mesh(caseGeo, caseMat);
	caseMesh.castShadow = true;

	// Candle top cap
	const topGeo = new THREE.CylinderGeometry(0.2, candleRadius, 0.1, 32);
	const topMat = new THREE.MeshStandardMaterial({ color: 0xff4500 });
	const topMesh = new THREE.Mesh(topGeo, topMat);
	topMesh.position.y = candleHeight;
	caseMesh.add(topMesh);

	// Candlewick using ExtrudeGeometry
	const wickProfile = new THREE.Shape();
	wickProfile.absarc(0, 0, 0.0625, 0, Math.PI * 2);
	const wickCurve = new THREE.CatmullRomCurve3([
		new THREE.Vector3(0, candleHeight - 1, 0),
		new THREE.Vector3(0, candleHeight - 0.5, -0.0625),
		new THREE.Vector3(0.25, candleHeight - 0.5, 0.125),
	]);
	const wickGeo = new THREE.ExtrudeGeometry(wickProfile, {
		steps: 8,
		bevelEnabled: false,
		extrudePath: wickCurve,
	});
	const colors = [];
	const color1 = new THREE.Color("black");
	const color2 = new THREE.Color(0x994411);
	const color3 = new THREE.Color(0xffff44);
	for (let i = 0; i < wickGeo.attributes.position.count; i++) {
		const y = wickGeo.attributes.position.getY(i);
		if (y < 0.4) {
			color1.toArray(colors, i * 3);
		} else {
			color2.toArray(colors, i * 3);
		}
		if (y < 0.15) color3.toArray(colors, i * 3);
	}
	wickGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
	wickGeo.translate(0, 0.95, 0);
	const wickMat = new THREE.MeshBasicMaterial({ vertexColors: true });
	const wickMesh = new THREE.Mesh(wickGeo, wickMat);
	caseMesh.add(wickMesh);

	// Candle point lights
	const candleLight1 = new THREE.PointLight(0xffaa33, 1, 5, 2);
	candleLight1.position.set(0, candleHeight, 0);
	candleLight1.castShadow = true;
	caseMesh.add(candleLight1);

	const candleLight2 = new THREE.PointLight(0xffaa33, 1, 10, 2);
	candleLight2.position.set(0, candleHeight + 1, 0);
	candleLight2.castShadow = true;
	caseMesh.add(candleLight2);

	// Add two flame meshes
	caseMesh.add(flame());
	caseMesh.add(flame());

	return caseMesh;
}

const candleMesh = createCandle();

// ─────────────────────────────────────────────────────────────────────────────
// 4) CREATE TABLE (CYLINDER WITH TEXTURE)
// ─────────────────────────────────────────────────────────────────────────────
const tableGeo = new THREE.CylinderGeometry(14, 14, 0.5, 64);
tableGeo.translate(0, -tableHeightOffset, 0);
const textureLoader = new THREE.TextureLoader();
const tableTexture = textureLoader.load(tableMatImage);
const tableMat = new THREE.MeshStandardMaterial({
	map: tableTexture,
	metalness: 0,
	roughness: 0.75
});
const tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.receiveShadow = true;
scene.add(tableMesh);

// ─────────────────────────────────────────────────────────────────────────────
// 5) RENDER LOOP SETUP
// ─────────────────────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let time = 0;

function render() {
	requestAnimationFrame(render);
	time += clock.getDelta();

	// Update flame shaders
	if (flameMaterials[0]) flameMaterials[0].uniforms.time.value = time;
	if (flameMaterials[1]) flameMaterials[1].uniforms.time.value = time;

	// Candle flicker for the second point light
	const flickerX = Math.sin(time * Math.PI) * 0.25;
	const flickerZ = Math.cos(time * Math.PI * 0.75) * 0.25;
	const flickerIntensity = 2 + Math.sin(time * Math.PI * 2) * Math.cos(time * Math.PI * 1.5) * 0.25;
	candleMesh.children.forEach(child => {
		if (child instanceof THREE.PointLight && child.distance === 10) {
			child.position.x = flickerX;
			child.position.z = flickerZ;
			child.intensity = flickerIntensity;
		}
	});

	controls.update();
	renderer.render(scene, camera);
}
render();

// ─────────────────────────────────────────────────────────────────────────────
// 6) CREATE CAKE & ADD CANDLES
// ─────────────────────────────────────────────────────────────────────────────
function createCake() {
	const cakeGroup = new THREE.Group();

	// Base layer
	const baseGeo = new THREE.CylinderGeometry(baseRadius, baseRadius, baseHeight, 32);
	const baseMat = new THREE.MeshPhongMaterial({ color: 0xfff5ee });
	const baseMesh = new THREE.Mesh(baseGeo, baseMat);

	// Middle layer
	const midGeo = new THREE.CylinderGeometry(middleRadius, middleRadius, middleHeight, 32);
	const midMat = new THREE.MeshPhongMaterial({ color: 0xfffafa });
	const midMesh = new THREE.Mesh(midGeo, midMat);
	midMesh.position.y = baseHeight / 2 + middleHeight / 2;

	// Top layer
	const topGeo = new THREE.CylinderGeometry(topRadius, topRadius, topHeight, 32);
	const topMat = new THREE.MeshPhongMaterial({ color: 0xf0ffff });
	const topMesh = new THREE.Mesh(topGeo, topMat);
	topMesh.position.y = baseHeight / 2 + middleHeight + topHeight / 2;

	cakeGroup.add(baseMesh);
	cakeGroup.add(midMesh);
	cakeGroup.add(topMesh);
	return cakeGroup;
}

const cake = createCake();
scene.add(cake);

// Scale and position the single candle mesh
candleMesh.scale.set(0.3, 0.3, 0.3);
candleMesh.castShadow = false;
candleMesh.position.y = baseHeight / 2 + middleHeight + topHeight;

// Create multiple candles around the top of the cake
function createCandles(count) {
	const group = new THREE.Group();
	const radius = 1; // distance from center
	for (let i = 0; i < count; i++) {
		const angle = (i / count) * Math.PI * 2;
		const clone = candleMesh.clone();
		clone.position.x = Math.cos(angle) * radius;
		clone.position.z = Math.sin(angle) * radius;
		group.add(clone);
	}
	return group;
}

const candles = createCandles(candleCount);
cake.add(candles);

// Adjust camera to look at the cake
camera.position.set(0, 5, 10);
camera.lookAt(cake.position);

// Add a small ambient light for better cake illumination
const ambientCakeLight = new THREE.AmbientLight(0xffffff, 0.05);
scene.add(ambientCakeLight);

// ─────────────────────────────────────────────────────────────────────────────
// 7) LOAD FONT AND CREATE “Happy Birthday Kelsei” TEXT (AFTER CAKE EXISTS)
// ─────────────────────────────────────────────────────────────────────────────
const fontLoader = new FontLoader();
fontLoader.load(
	'https://threejs.org/examples/fonts/helvetiker_regular.typeface.json',
	(font) => {
		const textGeo = new TextGeometry('Happy Birthday Kelsei', {
			font: font,
			size: 0.5,    // adjust so the letters aren’t too large
			height: 0.1,  // extrusion thickness
			curveSegments: 8
		});
		textGeo.computeBoundingBox();
		textGeo.center();

		const textMat = new THREE.MeshStandardMaterial({ color: 0xffff66 });
		const textMesh = new THREE.Mesh(textGeo, textMat);

		// Place it just above the top of the cake (4.25 = 2 + 1.25 + 1)
		textMesh.position.set(0, 6, 0);

		scene.add(textMesh);
	}
);

// ─────────────────────────────────────────────────────────────────────────────
// 8) “HOLD TO BLOW OUT” LOGIC & CONGRATULATION OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
let holdTimeout;
let allowBlowout = false;

const holdReminder = document.getElementById('hold-reminder');
const audio = document.getElementById("happy-birthday-audio");

audio.addEventListener('ended', function () {
	holdReminder.style.display = 'flex';
	setTimeout(() => {
		holdReminder.classList.add('show');
	}, 10);
	allowBlowout = true;
});

function handleHoldStart() {
	if (!allowBlowout) return;
	holdTimeout = setTimeout(() => {
		blowOutCandles();
	}, 500);
}

function handleHoldEnd() {
	clearTimeout(holdTimeout);
}

document.addEventListener('mousedown', handleHoldStart);
document.addEventListener('touchstart', handleHoldStart);
document.addEventListener('mouseup', handleHoldEnd);
document.addEventListener('touchend', handleHoldEnd);

function showCongratulation() {
	const overlay = document.getElementById('congratulation-overlay');
	overlay.style.pointerEvents = 'auto';
	overlay.style.background = 'rgba(0, 0, 0, 0.8)';
	overlay.style.opacity = '1';
}

function blowOutCandles() {
	candles.children.forEach(candle => {
		const speed = 1 + Math.random() * 3;
		extinguishCandle(candle, speed);
	});

	let ambientIntensity = ambientCakeLight.intensity;
	const interval = setInterval(() => {
		ambientIntensity += 0.01;
		if (ambientIntensity >= 0.1) {
			clearInterval(interval);
			ambientCakeLight.intensity = 0.1;
			showCongratulation();
		} else {
			ambientCakeLight.intensity = ambientIntensity;
		}
	}, 50);

	holdReminder.style.display = 'none';
}

function extinguishCandle(candle, speed) {
	const flames = candle.children.filter(child => child.material && child.material.type === 'ShaderMaterial');
	const lights = candle.children.filter(child => child instanceof THREE.PointLight);

	let progress = 0;
	const fadeInterval = setInterval(() => {
		progress += 0.02 * speed;
		if (progress >= 1) {
			clearInterval(fadeInterval);
			flames.forEach(f => f.visible = false);
			lights.forEach(l => l.intensity = 0);
		} else {
			flames.forEach(f => {
				f.material.opacity = 1 - progress;
				f.scale.set(1 - progress, 1 - progress, 1 - progress);
			});
			lights.forEach(l => {
				l.intensity = 1 - progress;
			});
		}
	}, 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// 9) HANDLE WINDOW RESIZE
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
	const w = window.innerWidth;
	const h = window.innerHeight;
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
	renderer.setSize(w, h);
});
