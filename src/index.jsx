
import './style.css'
import * as THREE from 'three'
import { CreateRenderer } from './src/path.js';
import { CreateScene } from './src/scene';
import { OrbitControls } from './src/OrbitControls';
const canvas = document.createElement('canvas');
container = document.getElementById('container');
container.appendChild(canvas);

async function main()
{

    var sphereGeometry = new THREE.BoxGeometry( 10, 10, 10 );
	var cubeGeometry = new THREE.BoxGeometry( 10, 10, 10 );
    //move the cube to the right
    cubeGeometry.translate( 20, 0, 0 );

    var arrow = await new THREE.TextureLoader().load("textures/BlueNoise_RGBA256.png")
    var uvgrid = await new THREE.TextureLoader().load("textures/uvgrid.jpg")
    var arrow_texture = new THREE.TextureLoader().load("textures/arrow.jpg")
    const hdrTexture =  await new THREE.TextureLoader().load('textures/uvgrid.jpg')


    sphereGeometry.translate( 0, 0, 20 );
    const scene = await CreateScene(
        [sphereGeometry,cubeGeometry],
        [
            [uvgrid,arrow_texture], 
            [arrow,arrow_texture]
        ],
        hdrTexture)
    const renderer = await CreateRenderer(canvas,scene);

    //rotate camera
	const controls = new OrbitControls(renderer.worldCamera, canvas,renderer.setMovingCamera);
    
	
	var distance = 40; // desired distance
    var vector = new THREE.Vector3();
    vector.subVectors(renderer.worldCamera.position, controls.target); // vector from target to camera
    vector.setLength(distance); // set vector length to desired distance
    renderer.worldCamera.position.copy(controls.target).add(vector); // set camera position
    controls.zoomSpeed = 2;
	renderer.worldCamera.position.z = 50;


    var R2 = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
    var s2 = new THREE.Scene();
    //mesh1
    var m1 = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({map: uvgrid}));
    s2.add(m1);

    //mesh2
    var m2 = new THREE.Mesh(cubeGeometry, new THREE.MeshBasicMaterial({map: arrow}));
    s2.add(m2);

    //mirror of the renderer.worldCamera
    var c2 = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    c2.add(s2)

    
    var target = "raytrace"
    //mouse middle
    canvas.addEventListener('mousedown', function(e) {
        if (e.button == 2) {
            var ct = target == "regular" ? "raytrace" : "regular"

            if(ct == "regular")
            {
                s2.add(renderer.worldCamera);
            }
            else
            {
                renderer.addCamera()
            }
            target = ct
        }
    });

    animate();
    function animate()
    {
        requestAnimationFrame(animate);
        
        if(target == "regular")
        {
            R2.render(s2, renderer.worldCamera);
        }
        else
        {
            renderer.animate()
        }
    }
}
main();


import "./src/path.js"