
import './style.css'
import * as THREE from 'three'
import { CreateRenderer } from './src/path.js';
import { CreateScene } from './src/scene';

const canvas = document.createElement('canvas');
container = document.getElementById('container');
container.appendChild(canvas);

async function main()
{

	var cubeGeometry = new THREE.BoxGeometry( 10, 10, 10 );
    const scene = await CreateScene(cubeGeometry)
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