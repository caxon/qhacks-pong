var camera, scene, renderer;
var mesh1
var controls;

init();
animate();

var geo1 = new THREE.BoxBufferGeometry(100, 100, 100);
var mat1 = new THREE.MeshBasicMaterial({color : 0xff0000, transparent : true, opacity : 0.2});

var box1 = new THREE.Mesh(geo1, mat1);

scene.add(box1);

function init(){
  camera = new THREE.PerspectiveCamera(70, window.innerWidth/window.innerHeight, 1, 1000);
  camera.position.z = 400;

  controls = new THREE.OrbitControls(camera);

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x555555);

  scene = new THREE.Scene();

  document.body.appendChild(renderer.domElement);
}

function animate(){
  requestAnimationFrame( animate );
  controls.update();
  renderer.render(scene, camera);
}
