const baseRadius = 0.4; // Base radius of the candle
const candleHeight = 4; // Total height of the candle
const candleCount=10; // Number of candles

var hide = true;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(3, 5, 8).setLength(15);
var renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x101005);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);
window.addEventListener("resize", _event => {
	camera.aspect = innerWidth / innerHeight;
	camera.updateProjectionMatrix()
	renderer.setSize(innerWidth, innerHeight);
})

var controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enablePan = false;
controls.minPolarAngle = THREE.Math.degToRad(60);
controls.maxPolarAngle = THREE.Math.degToRad(95);
controls.minDistance = 4;
controls.maxDistance = 20;
controls.autoRotate = true;
controls.autoRotateSpeed = 1;
controls.target.set(0, 2, 0);
controls.update();

var light = new THREE.DirectionalLight(0xffffff, 0.025);
light.position.setScalar(10);
scene.add(light);
scene.add(new THREE.AmbientLight(0xffffff, 0.0625));


// flame
var flameMaterials = [];
function flame() {
	let flameGeo = new THREE.SphereBufferGeometry(0.5, 32, 32);
	flameGeo.translate(0, 0.5, 0);
	let flameMat = getFlameMaterial(true);
	flameMaterials.push(flameMat);
	let flame = new THREE.Mesh(flameGeo, flameMat);
	flame.position.set(0.06, candleHeight, 0.06);
	flame.rotation.y = THREE.Math.degToRad(-45);
	return flame;
}


// create candle except flame
function createCandle() {

	var casePath = new THREE.Path();
	casePath.moveTo(0, 0);
	casePath.lineTo(0, 0);
	casePath.absarc(0, 0, baseRadius, Math.PI * 1.5, Math.PI * 2);
	casePath.lineTo(baseRadius, candleHeight); // Use baseRadius and candleHeight
	var caseGeo = new THREE.LatheBufferGeometry(casePath.getPoints(), 64);
	var caseMat = new THREE.MeshStandardMaterial({ color: 0xff4500 }); // Orange-red color
	var caseMesh = new THREE.Mesh(caseGeo, caseMat);
	caseMesh.castShadow = true;

	// top part of the candle
	const topGeometry = new THREE.CylinderGeometry(0.2, baseRadius, 0.1, 32); // Use baseRadius for the top base
	const topMaterial = new THREE.MeshStandardMaterial({ color: 0xff4500 });
	const topMesh = new THREE.Mesh(topGeometry, topMaterial);
	topMesh.position.y = candleHeight; // Use candleHeight for positioning
	caseMesh.add(topMesh);

	// candlewick
	var candlewickProfile = new THREE.Shape();
	candlewickProfile.absarc(0, 0, 0.0625, 0, Math.PI * 2);

	var candlewickCurve = new THREE.CatmullRomCurve3([
		new THREE.Vector3(0, candleHeight-1, 0),
		new THREE.Vector3(0, candleHeight-0.5, -0.0625),
		new THREE.Vector3(0.25, candleHeight-0.5, 0.125)
	]);

	var candlewickGeo = new THREE.ExtrudeBufferGeometry(candlewickProfile, {
		steps: 8,
		bevelEnabled: false,
		extrudePath: candlewickCurve
	});
	var colors = [];
	var color1 = new THREE.Color("black");
	var color2 = new THREE.Color(0x994411);
	var color3 = new THREE.Color(0xffff44);
	for (let i = 0; i < candlewickGeo.attributes.position.count; i++) {
		if (candlewickGeo.attributes.position.getY(i) < 0.4) {
			color1.toArray(colors, i * 3);
		}
		else {
			color2.toArray(colors, i * 3);
		};
		if (candlewickGeo.attributes.position.getY(i) < 0.15) color3.toArray(colors, i * 3);
	}
	candlewickGeo.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
	candlewickGeo.translate(0, 0.95, 0);
	var candlewickMat = new THREE.MeshBasicMaterial({ vertexColors: THREE.VertexColors });

	var candlewickMesh = new THREE.Mesh(candlewickGeo, candlewickMat);
	caseMesh.add(candlewickMesh);

	return caseMesh;
}

const candleMesh = createCandle();

// candle light
var candleLight = new THREE.PointLight(0xffaa33, 1, 5, 2);
candleLight.position.set(0, candleHeight, 0);
candleLight.castShadow = true;
candleMesh.add(candleLight);
var candleLight2 = new THREE.PointLight(0xffaa33, 1, 10, 2);
candleLight2.position.set(0, candleHeight+1, 0);
candleLight2.castShadow = true;
candleMesh.add(candleLight2);

candleMesh.add(flame());
candleMesh.add(flame())

// table
var tableGeo = new THREE.CylinderBufferGeometry(14, 14, 0.5, 64);
tableGeo.translate(0, -0.25, 0);
var tableMat = new THREE.MeshStandardMaterial({ map: new THREE.TextureLoader().load("https://threejs.org/examples/textures/hardwood2_diffuse.jpg"), metalness: 0, roughness: 0.75 });
var tableMesh = new THREE.Mesh(tableGeo, tableMat);
tableMesh.receiveShadow = true;

tableMesh.add(candleMesh);
scene.add(tableMesh);

var clock = new THREE.Clock();
var time = 0;

render();
function render() {
	requestAnimationFrame(render);
	time += clock.getDelta();
	flameMaterials[0].uniforms.time.value = time;
	flameMaterials[1].uniforms.time.value = time;
	candleLight2.position.x = Math.sin(time * Math.PI) * 0.25;
	candleLight2.position.z = Math.cos(time * Math.PI * 0.75) * 0.25;
	candleLight2.intensity = 2 + Math.sin(time * Math.PI * 2) * Math.cos(time * Math.PI * 1.5) * 0.25;
	controls.update();
	renderer.render(scene, camera);
}

// 蛋糕主體
function createCake() {
	const cakeGroup = new THREE.Group();

	// 蛋糕底層
	const baseGeometry = new THREE.CylinderGeometry(2, 2, 0.75, 32);
	const baseMaterial = new THREE.MeshPhongMaterial({ color: 0xf4a460 });
	const baseMesh = new THREE.Mesh(baseGeometry, baseMaterial);

	// 蛋糕中層
	const middleGeometry = new THREE.CylinderGeometry(1.8, 1.8, 0.5, 32);
	const middleMaterial = new THREE.MeshPhongMaterial({ color: 0xffdab9 });
	const middleMesh = new THREE.Mesh(middleGeometry, middleMaterial);
	middleMesh.position.y = 0.5;

	// 蛋糕頂層
	const topGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 32);
	const topMaterial = new THREE.MeshPhongMaterial({ color: 0xffe4b5 });
	const topMesh = new THREE.Mesh(topGeometry, topMaterial);
	topMesh.position.y = 1;

	cakeGroup.add(baseMesh, middleMesh, topMesh);
	return cakeGroup;
}

const cake = createCake();
scene.add(cake);

// 修改 caseMesh 的縮放和位置
candleMesh.scale.set(0.3, 0.3, 0.3);
candleMesh.position.y = 1.25; // 調整高度以放置在蛋糕頂部

// 創建多個蠟燭並放置在蛋糕上
function createCandles(count) {
	const candleGroup = new THREE.Group();
	const radius = 1;
	for (let i = 0; i < count; i++) {
		const angle = (i / count) * Math.PI * 2;
		const candle = candleMesh.clone();
		candle.position.x = Math.cos(angle) * radius;
		candle.position.z = Math.sin(angle) * radius;
		candleGroup.add(candle);
	}
	return candleGroup;
}

const candles = createCandles(candleCount);
cake.add(candles);

// 調整相機位置
camera.position.set(0, 5, 10);
camera.lookAt(cake.position);

// 添加環境光和平行光以更好地照亮蛋糕
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);
