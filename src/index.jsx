
import './style.css'
import * as THREE from 'three'
import { CreateRenderer } from './src/path.js';
import { CreateScene } from './src/scene';

const canvas = document.createElement('canvas');
container = document.getElementById('container');
container.appendChild(canvas);

async function main()
{

    var sphereGeometry = new THREE.BoxGeometry( 10, 10, 10 );
	var cubeGeometry = new THREE.BoxGeometry( 10, 10, 10 );

    var arrow = await new THREE.TextureLoader().load("textures/BlueNoise_RGBA256.png")
    var uvgrid = await new THREE.TextureLoader().load("textures/uvgrid.jpg")

    //move the sphere back in Z so we can see it.
    sphereGeometry.translate( 0, 0, 20 );
    const scene = await CreateScene([sphereGeometry,cubeGeometry],[uvgrid, arrow])
    const renderer = await CreateRenderer(canvas,scene);

    animate();
    function animate()
    {
        requestAnimationFrame(animate);
        renderer.animate()
    }
}
main();


import "./src/path.js"