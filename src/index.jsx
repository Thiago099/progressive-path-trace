
import './style.css'
import * as THREE from 'three'
import { CreateRaytraceRenderer } from './src/RaytraceRenderer.js';
import { CreateRaytraceScene } from './src/RaytraceScene';
import { OrbitControls } from './src/OrbitControls';
const canvas = document.createElement('canvas');
container = document.getElementById('container');
container.appendChild(canvas);

async function main()
{

    var sphereGeometry = new THREE.BoxGeometry( 10, 10, 10 );
    var sphereGeometry = new THREE.BoxGeometry( 10, 10, 10 );
	var cubeGeometry = new THREE.BoxGeometry( 10, 10, 10 );
    //move the cube to the right
    cubeGeometry.translate( 20, 0, 0 );

    var uvgrid = await new THREE.TextureLoader().load("textures/uvgrid.jpg")
    var arrow = await new THREE.TextureLoader().load("textures/arrow.jpg")
    const hdrTexture =  await new THREE.TextureLoader().load('textures/background.jpg')


    const scene = await CreateRaytraceScene(hdrTexture)

    const renderer = await CreateRaytraceRenderer(canvas,scene);


    scene.Update({
        geometry: sphereGeometry,
        albedo: uvgrid,
        emissive: arrow,
    })


	renderer.worldCamera.position.set( 20, 20, 20 );
	const controls = new OrbitControls(renderer.worldCamera, canvas, renderer.setMovingCamera);
	var distance = 40; // desired distance
    var vector = new THREE.Vector3();
    vector.subVectors(renderer.worldCamera.position, controls.target); // vector from target to camera
    vector.setLength(distance); // set vector length to desired distance
    renderer.worldCamera.position.copy(controls.target).add(vector); // set camera position
    controls.zoomSpeed = 2;



    var regular_renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
    var regular_scene = new THREE.Scene();
    //mesh1
    var sphereMesh = new THREE.Mesh(sphereGeometry, new THREE.MeshBasicMaterial({map: uvgrid}));
    regular_scene.add(sphereMesh);

    //mesh2
    // var cubeMesh = new THREE.Mesh(cubeGeometry, new THREE.MeshBasicMaterial({map: arrow}));
    // regular_scene.add(cubeMesh);

    var target = "raytrace"
    //mouse middle
    canvas.addEventListener('mousedown', function(e) {
        if (e.button == 2) {
            var ct = target == "regular" ? "raytrace" : "regular"
            if(ct == "regular")
            {

                regular_scene.add(renderer.worldCamera);
            }
            else
            {
                //clear all camera related from regular_scene
                regular_scene.remove(renderer.worldCamera);
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
            regular_renderer.render(regular_scene, renderer.worldCamera);
        }
        else
        {
            renderer.render()
        }
    }
}
main();


import "./src/RaytraceRenderer.js"