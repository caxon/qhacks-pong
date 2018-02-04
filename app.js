var baseBoneRotation = ( new THREE.Quaternion ).setFromEuler( new THREE.Euler( 0, 0, Math.PI / 2 ) );
var armMeshes = [];
var boneMeshes = [];
var stats, renderer, scene, camera, controls, ball, sym_ball, sphereBody;
init();
Leap.loop( {background: true}, leapAnimate ).connect();
function init() {
  var css = document.head.appendChild( document.createElement( 'style' ) );
  css.innerHTML =
  `
    body { font: 12pt monospace; margin: 0; overflow: hidden; }
    h2 { margin: 0 }
    #aa {text-decoration: none; }
    #menu { margin: 0 20px; position: absolute; }
  `;
  var menu = document.body.appendChild( document.createElement( 'div' ) );
  menu.id = 'menu';
  menu.innerHTML =
  `
    <h2>
      <a href="" > ${ document.title }</a>
      <a id=aa href=http://jaanga.github.io/gestification-r2/template-leap-threejs/ >🛈</a>
    </h2>
    <div id=info ></div>
  `;
  stats = new Stats();
  stats.domElement.style.cssText = 'position: absolute; right: 0; top: 0; z-index: 100; ';
  document.body.appendChild( stats.domElement );
  renderer = new THREE.WebGLRenderer( { alpha: 1, antialias: true, clearColor: 0xffffff }  );
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );
  camera = new THREE.PerspectiveCamera( 40, window.innerWidth / window.innerHeight, 1, 5000 );
  camera.position.set( 0,190, 750);
  controls = new THREE.OrbitControls( camera, renderer.domElement );
  controls.maxDistance = 1000;
  scene = new THREE.Scene();

  // helpers
  var gridHelper = new THREE.GridHelper( 150, 10 );
  scene.add( gridHelper );
  var axisHelper = new THREE.AxisHelper( 150 );
  scene.add( axisHelper );

  // table for pong
  var geometry = new THREE.BoxGeometry( 600, 20, 2400 );
  var material = new THREE.MeshNormalMaterial();
  var table = new THREE.Mesh( geometry, material );
  table.position.set( 0, -40, -1000 );
  scene.add( table );

  window.addEventListener( 'resize', onWindowResize, false );
  // primary ball
  var geometry = new THREE.SphereGeometry( 20, 32, 32 );
  var material = new THREE.MeshBasicMaterial( {color: 0xaa00cc} );
  ball = new THREE.Mesh( geometry, material );
  ball.position.set(0,100,0);
  scene.add( ball );
  // symmetric ball (opponent)
  sym_ball = new THREE.Mesh(geometry, material);
  sym_ball.position.set(5,20, -2000); //starting point is arbitrary
  scene.add(sym_ball);
  var pos = firebase.database().ref('user1/position');
  pos.on('value', function(snapshot) {
    sym_ball.position.x = -snapshot.child('x').val();
    sym_ball.position.y = snapshot.child('y').val();
    sym_ball.position.z = -snapshot.child('z').val() - 2000;
    console.log(sym_ball.position);
  });

  // net for the table
  var netRect = new THREE.BoxGeometry(600, 50, 20);
  material = new THREE.MeshBasicMaterial({color: 0xaa00cc, transparent:true, opacity:0.6});
  var net = new THREE.Mesh(netRect, material);
  net.position.set(0,0,-800); //approximate middle?
  scene.add(net);

  // Physical logic
  var world = new CANNON.World();
  world.gravity.set(0,0,-9.82);
  world.broadphase = new CANNON.NaiveBroadphase();
  var radius = 0.02;
  // Create a sphere
  var mat1 = new CANNON.Material();
  sphereBody = new CANNON.Body({
     mass: 0.1, // kg
     material: mat1,
     velocity: new CANNON.Vec3(0, 0, 0), // m 0, 0.2, 0
     shape: new CANNON.Sphere(radius+0.01)
    });
  sphereBody.position.set(0,0,10);
  //sphereBody.linearDamping = 0.01;
  world.addBody(sphereBody);

  // Create a plane

  var groundMaterial = new CANNON.Material();
  var groundBody = new CANNON.Body({
      material: groundMaterial,
      mass: 0 // mass == 0 makes the body static
  });
  //groundBody.position.set(0,0,)
  var groundShape = new CANNON.Plane();
  groundBody.addShape(groundShape);
  world.addBody(groundBody);
  mat1_ground = new CANNON.ContactMaterial(groundMaterial, mat1, {friction:0.0, restitution:0.9});
  world.addContactMaterial(mat1_ground);

  var fixedTimeStep = 1.0 / 15.0; // seconds (not sure what this does)
  var maxSubSteps = 3;


  // Start the simulation loop
  var lastTime;
  (function simloop(time){
    requestAnimationFrame(simloop);
    if(lastTime !== undefined){
       var dt = (time - lastTime) / 1000;
       world.step(fixedTimeStep, dt, maxSubSteps);
    }
    //console.log("Sphere z position: " + sphereBody.position.z);
    ball.position.x = sphereBody.position.x*25.0;
    ball.position.y = sphereBody.position.z*25.0;
    ball.position.z = sphereBody.position.y*25.0;
    /*
    sym_ball.position.x = -ball.position.x;
    sym_ball.position.y = ball.position.y;
    sym_ball.position.z = -1600 + -ball.position.z; //TODO: actual symmetry
    */
    lastTime = time;
  })();
}
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
}
function addMesh( meshes ) {
  var geometry = new THREE.BoxGeometry( 1, 1, 1 );
  var material = new THREE.MeshNormalMaterial();
  var mesh = new THREE.Mesh( geometry, material );
  meshes.push( mesh );
  return mesh;
}
function updateMesh( bone, mesh ) {
    arr = bone.center().slice();
    arr[1] = arr[1] - 100; //Translate the floor down to capture more information
    mesh.position.fromArray( arr );
    mesh.setRotationFromMatrix( ( new THREE.Matrix4 ).fromArray( bone.matrix() ) );
    mesh.quaternion.multiply( baseBoneRotation );
    mesh.scale.set( bone.width, bone.width, bone.length );
    scene.add( mesh );
}
function leapAnimate( frame ) {
  var countBones = 0;
  var countArms = 0;
  armMeshes.forEach( function( item ) { scene.remove( item ) } );
  boneMeshes.forEach( function( item ) { scene.remove( item ) } );
  for ( var hand of frame.hands ) {

    /*for (i = 0; i < 3; i++){
      diff += Math.pow(hand.palmPosition[i] - Object.keys(ball.position)[i], 2);
    }*/
    //console.log(diff);

    var hitboxf = new THREE.Vector3(30,30,30);

    var isGrabbing = false;
    var diff = new THREE.Vector3(
      hand.palmPosition[0] - ball.position.x,
      hand.palmPosition[1] - 100 - ball.position.z,
      hand.palmPosition[2] - ball.position.z
    );
    // var diff = Math.pow(Math.pow(hand.palmPosition[0] - ball.position.x, 2) + Math.pow(hand.palmPosition[1] -100 - ball.position.z,2) + Math.pow(hand.palmPosition[2] - ball.position.y,2), 0.5);

    if(diff.distanceTo(ball.position) < 45 && hand.grabStrength > 0.80) {
      console.log("Grab");
      isGrabbing = true;
      sphereBody.velocity = new THREE.Vector(0,0,0);
      sphereBody.position.x = hand.palmPosition[0];
      sphereBody.position.y = hand.palmPosition[2];
      sphereBody.position.z = hand.palmPosition[1] - 100;
    }
    var hasHit = false;
    var f_velocity;
    for ( var finger of hand.fingers ) {
      for ( var bone of finger.bones ) {
        if ( countBones++ === 0 ) { continue; }
        var boneMesh = boneMeshes [ countBones ] || addMesh( boneMeshes );
        updateMesh( bone, boneMesh );

        if(isGrabbing == false) {
          var deltaf = new THREE.Vector3(
            Math.abs(ball.position.x - bone.center()[0]),
            Math.abs(ball.position.y + 100 - bone.center()[1]),
            Math.abs(ball.position.z - bone.center()[2]),
          );
          if (deltaf.x < hitboxf.x && deltaf.y < hitboxf.y && deltaf.z < hitboxf.z){
            hasHit = true;
            f_velocity = hand.palmVelocity;
          }
        }
      }
    }
    var arm = hand.arm;
    var armMesh = armMeshes [ countArms++ ] || addMesh( armMeshes );
    updateMesh( arm, armMesh );
    armMesh.scale.set( arm.width / 4, arm.width / 2, arm.length );
    if (hasHit){
      //console.log("fingers touched");
      sphereBody.velocity.x = sphereBody.velocity.x + f_velocity[0]/100.0;
      sphereBody.velocity.y = sphereBody.velocity.y + f_velocity[2]/100.0;
      sphereBody.velocity.z = sphereBody.velocity.z + f_velocity[1]/100.0;

      // Write to Firebase!!
      firebase.database().ref('user1').set({
        position: ball.position,
        velocity: sphereBody.velocity,
      });
    }
  }
  renderer.render( scene, camera );
  controls.update();
  stats.update();
}
