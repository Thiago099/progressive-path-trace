import * as THREE from 'three';
import { RGBELoader  } from './RGBELoader.JS'
import { BVH_Build_Iterative } from './BVH_Acc_Structure_Iterative_SAH_Builder';
// scene/demo-specific variables go here
import { init,getGui } from "./path";
// Rendering variables


let triangleDataTexture, aabbDataTexture;

// HDR image variables
let hdrTexture, hdrLoader, hdrExposure = 1.0;

export {initSceneData,updateVariablesAndUniforms}

// Environment variables
let skyLightIntensity = 2.0, sunLightIntensity = 2.0, sunColor = [1.0, 0.98, 0.92];
let sunAngle = Math.PI / 2.5;

// Geometry variables
let meshes = [];
let triangleMaterialMarkers = [];
let pathTracingMaterialList = [];
let uniqueMaterialTextures = [];
let aabb_array;

// Constants
const loadingSpinner = document.querySelector("#loadingSpinner");


// Model/scene variables
let modelScale = 10.0;
let modelRotationY = Math.PI; // in radians
let modelPositionOffset = new THREE.Vector3();
let sunDirection = new THREE.Vector3();


// GUI menu variables
let hdr_ExposureController, hdr_ExposureObject;
let hdrExposureChanged = false;
let skyLight_IntensityController, skyLight_IntensityObject;
let skyLightIntensityChanged = false;
let sun_AngleController, sun_AngleObject;
let sunAngleChanged = false;
let sunLight_IntensityController, sunLight_IntensityObject;
let sunLightIntensityChanged = false;
let sun_ColorController, sun_ColorObject;
let sunColorChanged = false;


function init_GUI() 
{
	const gui = getGui();
	hdr_ExposureObject = {
		hdrExposure: 1.0
	}
	skyLight_IntensityObject = {
		skyLightIntensity: 2.0
	}
	sun_AngleObject = {
		sunAngle: Math.PI / 2.5
	}
	sunLight_IntensityObject = {
		sunLightIntensity: 2.0
	}
	sun_ColorObject = {
		sunColor: [1.0, 0.98, 0.92]
	}

	hdr_ExposureController = gui.add(hdr_ExposureObject, 'hdrExposure', 0, 10).step(10 / 100).onChange(() =>
	{
		hdrExposureChanged = true;
	});
	skyLight_IntensityController = gui.add(skyLight_IntensityObject, 'skyLightIntensity', 0, 5).step(5 / 100).onChange(() =>
	{
		skyLightIntensityChanged = true;
	});
	sun_AngleController = gui.add(sun_AngleObject, 'sunAngle', 0, Math.PI).step(Math.PI / 100).onChange(() =>
	{
		sunAngleChanged = true;
	});
	sunLight_IntensityController = gui.add(sunLight_IntensityObject, 'sunLightIntensity', 0, 5).step(5 / 100).onChange(() =>
	{
		sunLightIntensityChanged = true;
	});
	sun_ColorController = gui.addColor(sun_ColorObject, 'sunColor').onChange(() =>
	{
		sunColorChanged = true;
	});

} // end function init_GUI()


function MaterialObject(material, pathTracingMaterialList)
{
	// a list of material types and their corresponding numbers are found in the 'pathTracingCommon.js' file
	this.type = material.opacity < 1 ? 2 : 1; // default is 1 = diffuse opaque, 2 = glossy transparent, 4 = glossy opaque;
	this.albedoTextureID = 0; // which diffuse map to use for model's color, '-1' = no textures are used
	this.color = material.color ? material.color.copy(material.color) : new THREE.Color(1.0, 1.0, 1.0); // takes on different meanings, depending on 'type' above
	this.roughness = material.roughness || 0.0; // 0.0 to 1.0 range, perfectly smooth to extremely rough
	this.metalness = material.metalness || 0.0; // 0.0 to 1.0 range, usually either 0 or 1, either non-metal or metal
	this.opacity = material.opacity || 1.0; // 0.0 to 1.0 range, fully transparent to fully opaque
	// this seems to be unused
	// this.refractiveIndex = this.type === 4 ? 1.0 : 1.5; // 1.0=air, 1.33=water, 1.4=clearCoat, 1.5=glass, etc.
	pathTracingMaterialList.push(this);
}



function loadModels()
{


	console.time("LoadingGltf");
	// Show the loading spinner
	loadingSpinner.classList.remove("hidden");

		
	prepareGeometryForPT();

	init();

	// Hide loading spinning and show menu
	// loadingSpinner.classList.add("hidden");
	// gui.domElement.classList.remove("hidden");

} // end function loadModels(modelPaths)






async function prepareGeometryForPT()
{

	var cubeGeometry = new THREE.BoxGeometry( 1, 1, 1 );
	//add texture

	var tex =  await new THREE.TextureLoader().load("textures/uvgrid.jpg");

	//move up
	cubeGeometry.translate(0, 0.5, 0);
		
	// Merge geometry from all models into one new mesh
	let modelMesh = new THREE.Mesh(cubeGeometry);
	if (modelMesh.geometry.index)
		modelMesh.geometry = modelMesh.geometry.toNonIndexed(); // why do we need NonIndexed geometry?

	// divide by 9 because of nonIndexed geometry (each triangle has 3 floats with each float constisting of 3 components)
	let total_number_of_triangles = modelMesh.geometry.attributes.position.array.length / 9;

	uniqueMaterialTextures = [tex];
	pathTracingMaterialList = [];

	var obj = new MaterialObject({}, pathTracingMaterialList);
	obj.albedoTextureID = 0;
	console.log(obj);

	console.log(pathTracingMaterialList);

	modelMesh.geometry.rotateY(modelRotationY);

	let totalWork = new Uint32Array(total_number_of_triangles);

	// Initialize triangle and aabb arrays where 2048 = width and height of texture and 4 are the r, g, b and a components
	let triangle_array = new Float32Array(2048 * 2048 * 4);
	aabb_array = new Float32Array(2048 * 2048 * 4);

	var triangle_b_box_min = new THREE.Vector3();
	var triangle_b_box_max = new THREE.Vector3();
	var triangle_b_box_centroid = new THREE.Vector3();

	var vpa = new Float32Array(modelMesh.geometry.attributes.position.array);
	if (modelMesh.geometry.attributes.normal === undefined)
		modelMesh.geometry.computeVertexNormals();
	var vna = new Float32Array(modelMesh.geometry.attributes.normal.array);

	var modelHasUVs = false;
	if (modelMesh.geometry.attributes.uv !== undefined)
	{
		var vta = new Float32Array(modelMesh.geometry.attributes.uv.array);
		modelHasUVs = true;
	}

	let materialNumber = 0;
	for (let i = 0; i < total_number_of_triangles; i++)
	{

		triangle_b_box_min.set(Infinity, Infinity, Infinity);
		triangle_b_box_max.set(-Infinity, -Infinity, -Infinity);

		let vt0 = new THREE.Vector3();
		let vt1 = new THREE.Vector3();
		let vt2 = new THREE.Vector3();
		// record vertex texture coordinates (UVs)
		if (modelHasUVs)
		{
			vt0.set(vta[6 * i + 0], vta[6 * i + 1]);
			vt1.set(vta[6 * i + 2], vta[6 * i + 3]);
			vt2.set(vta[6 * i + 4], vta[6 * i + 5]);
		} else
		{
			vt0.set(-1, -1);
			vt1.set(-1, -1);
			vt2.set(-1, -1);
		}

		// record vertex normals
		let vn0 = new THREE.Vector3(vna[9 * i + 0], vna[9 * i + 1], vna[9 * i + 2]).normalize();
		let vn1 = new THREE.Vector3(vna[9 * i + 3], vna[9 * i + 4], vna[9 * i + 5]).normalize();
		let vn2 = new THREE.Vector3(vna[9 * i + 6], vna[9 * i + 7], vna[9 * i + 8]).normalize();

		// record vertex positions
		let vp0 = new THREE.Vector3(vpa[9 * i + 0], vpa[9 * i + 1], vpa[9 * i + 2]);
		let vp1 = new THREE.Vector3(vpa[9 * i + 3], vpa[9 * i + 4], vpa[9 * i + 5]);
		let vp2 = new THREE.Vector3(vpa[9 * i + 6], vpa[9 * i + 7], vpa[9 * i + 8]);

		vp0.multiplyScalar(modelScale);
		vp1.multiplyScalar(modelScale);
		vp2.multiplyScalar(modelScale);

		vp0.add(modelPositionOffset);
		vp1.add(modelPositionOffset);
		vp2.add(modelPositionOffset);

		//slot 0
		triangle_array[32 * i + 0] = vp0.x; // r or x
		triangle_array[32 * i + 1] = vp0.y; // g or y
		triangle_array[32 * i + 2] = vp0.z; // b or z
		triangle_array[32 * i + 3] = vp1.x; // a or w

		//slot 1
		triangle_array[32 * i + 4] = vp1.y; // r or x
		triangle_array[32 * i + 5] = vp1.z; // g or y
		triangle_array[32 * i + 6] = vp2.x; // b or z
		triangle_array[32 * i + 7] = vp2.y; // a or w

		//slot 2
		triangle_array[32 * i + 8] = vp2.z; // r or x
		triangle_array[32 * i + 9] = vn0.x; // g or y
		triangle_array[32 * i + 10] = vn0.y; // b or z
		triangle_array[32 * i + 11] = vn0.z; // a or w

		//slot 3
		triangle_array[32 * i + 12] = vn1.x; // r or x
		triangle_array[32 * i + 13] = vn1.y; // g or y
		triangle_array[32 * i + 14] = vn1.z; // b or z
		triangle_array[32 * i + 15] = vn2.x; // a or w

		//slot 4
		triangle_array[32 * i + 16] = vn2.y; // r or x
		triangle_array[32 * i + 17] = vn2.z; // g or y
		triangle_array[32 * i + 18] = vt0.x; // b or z
		triangle_array[32 * i + 19] = vt0.y; // a or w

		//slot 5
		triangle_array[32 * i + 20] = vt1.x; // r or x
		triangle_array[32 * i + 21] = vt1.y; // g or y
		triangle_array[32 * i + 22] = vt2.x; // b or z
		triangle_array[32 * i + 23] = vt2.y; // a or w

		// the remaining slots are used for PBR material properties

		// if (i >= triangleMaterialMarkers[materialNumber])
		// 	materialNumber++;


		//slot 6
		triangle_array[32 * i + 24] = pathTracingMaterialList[materialNumber].type; // r or x
		triangle_array[32 * i + 25] = pathTracingMaterialList[materialNumber].color.r; // g or y
		triangle_array[32 * i + 26] = pathTracingMaterialList[materialNumber].color.g; // b or z
		triangle_array[32 * i + 27] = pathTracingMaterialList[materialNumber].color.b; // a or w

		//slot 7
		triangle_array[32 * i + 28] = pathTracingMaterialList[materialNumber].albedoTextureID; // r or x
		triangle_array[32 * i + 29] = pathTracingMaterialList[materialNumber].opacity; // g or y
		triangle_array[32 * i + 30] = 0; // b or z
		triangle_array[32 * i + 31] = 0; // a or w

		triangle_b_box_min.copy(triangle_b_box_min.min(vp0));
		triangle_b_box_max.copy(triangle_b_box_max.max(vp0));
		triangle_b_box_min.copy(triangle_b_box_min.min(vp1));
		triangle_b_box_max.copy(triangle_b_box_max.max(vp1));
		triangle_b_box_min.copy(triangle_b_box_min.min(vp2));
		triangle_b_box_max.copy(triangle_b_box_max.max(vp2));

		triangle_b_box_centroid.copy(triangle_b_box_min).add(triangle_b_box_max).multiplyScalar(0.5);
		//triangle_b_box_centroid.copy(vp0).add(vp1).add(vp2).multiplyScalar(0.3333);

		aabb_array[9 * i + 0] = triangle_b_box_min.x;
		aabb_array[9 * i + 1] = triangle_b_box_min.y;
		aabb_array[9 * i + 2] = triangle_b_box_min.z;
		aabb_array[9 * i + 3] = triangle_b_box_max.x;
		aabb_array[9 * i + 4] = triangle_b_box_max.y;
		aabb_array[9 * i + 5] = triangle_b_box_max.z;
		aabb_array[9 * i + 6] = triangle_b_box_centroid.x;
		aabb_array[9 * i + 7] = triangle_b_box_centroid.y;
		aabb_array[9 * i + 8] = triangle_b_box_centroid.z;

		totalWork[i] = i;

	} // end for (let i = 0; i < total_number_of_triangles; i++)

	console.time("BvhGeneration");
	console.log("BvhGeneration...");

	// Build the BVH acceleration structure, which places a bounding box ('root' of the tree) around all of the
	// triangles of the entire mesh, then subdivides each box into 2 smaller boxes.  It continues until it reaches 1 triangle,
	// which it then designates as a 'leaf'
	BVH_Build_Iterative(totalWork, aabb_array);
	//console.log(buildnodes);

	console.timeEnd("BvhGeneration");

	triangleDataTexture = new THREE.DataTexture(triangle_array,
		2048,
		2048,
		THREE.RGBAFormat,
		THREE.FloatType,
		THREE.Texture.DEFAULT_MAPPING,
		THREE.ClampToEdgeWrapping,
		THREE.ClampToEdgeWrapping,
		THREE.NearestFilter,
		THREE.NearestFilter,
		1,
		THREE.LinearEncoding
	);

	triangleDataTexture.flipY = false;
	triangleDataTexture.generateMipmaps = false;
	triangleDataTexture.needsUpdate = true;

	aabbDataTexture = new THREE.DataTexture(aabb_array,
		2048,
		2048,
		THREE.RGBAFormat,
		THREE.FloatType,
		THREE.Texture.DEFAULT_MAPPING,
		THREE.ClampToEdgeWrapping,
		THREE.ClampToEdgeWrapping,
		THREE.NearestFilter,
		THREE.NearestFilter,
		1,
		THREE.LinearEncoding
	);

	aabbDataTexture.flipY = false;
	aabbDataTexture.generateMipmaps = false;
	aabbDataTexture.needsUpdate = true;


} // end function prepareGeometryForPT(meshList, pathTracingMaterialList, triangleMaterialMarkers)




// called automatically from within initTHREEjs() function (located in InitCommon.js file)
function initSceneData(pathTracingUniforms) {

	init_GUI();

	// scene/demo-specific uniforms go here
	pathTracingUniforms.tTriangleTexture = { value: triangleDataTexture };
	pathTracingUniforms.tAABBTexture = { value: aabbDataTexture };
	pathTracingUniforms.tHDRTexture = { value: hdrTexture };
	pathTracingUniforms.tAlbedoTextures = { value: uniqueMaterialTextures };
	pathTracingUniforms.uSkyLightIntensity = { value: skyLightIntensity };
	pathTracingUniforms.uSunLightIntensity = { value: sunLightIntensity };
	pathTracingUniforms.uSunColor = { value: new THREE.Color().fromArray(sunColor.map(x => x)) };
	pathTracingUniforms.uSunDirection = { value: new THREE.Vector3() };

	// jumpstart the gui variables so that when the demo starts, all the uniforms are up to date
	hdrExposureChanged = skyLightIntensityChanged = sunAngleChanged =
		sunLightIntensityChanged = sunColorChanged = true;


} // end function initSceneData()




// called automatically from within the animate() function (located in InitCommon.js file)
function updateVariablesAndUniforms(renderer,pathTracingUniforms)
{
	var cameraIsMoving = false;
	if (hdrExposureChanged)
	{
		renderer.toneMappingExposure = hdr_ExposureController.getValue();
		cameraIsMoving = true;
		hdrExposureChanged = false;
	}

	if (skyLightIntensityChanged)
	{
		pathTracingUniforms.uSkyLightIntensity.value = skyLight_IntensityController.getValue();
		cameraIsMoving = true;
		skyLightIntensityChanged = false;
	}

	if (sunAngleChanged)
	{
		sunAngle = sun_AngleController.getValue();
		sunDirection.set(Math.cos(sunAngle) * 1.2, Math.sin(sunAngle), -Math.cos(sunAngle) * 3.0);
		sunDirection.normalize();
		pathTracingUniforms.uSunDirection.value.copy(sunDirection);
		cameraIsMoving = true;
		sunAngleChanged = false;
	}

	if (sunLightIntensityChanged)
	{
		pathTracingUniforms.uSunLightIntensity.value = sunLight_IntensityController.getValue();
		cameraIsMoving = true;
		sunLightIntensityChanged = false;
	}

	if (sunColorChanged)
	{
		sunColor = sun_ColorController.getValue();
		pathTracingUniforms.uSunColor.value.setRGB(sunColor[0], sunColor[1], sunColor[2]);

		cameraIsMoving = true;
		sunColorChanged = false;
	}

	// INFO
	// cameraInfoElement.innerHTML = "FOV: " + worldCamera.fov + " / Aperture: " + apertureSize.toFixed(2) + " / FocusDistance: " + focusDistance + "<br>" + "Samples: " + sampleCounter;
	return cameraIsMoving

} // end function updateVariablesAndUniforms()


hdrLoader = new RGBELoader();
hdrLoader.type = THREE.FloatType; // override THREE's default of HalfFloatType

hdrTexture = hdrLoader.load(
	'textures/daytime.hdr',
	function (texture)
	{
		texture.encoding = THREE.LinearEncoding;
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;
		texture.flipY = true;

		// now that the HDR image has loaded, we can load the models
		loadModels(); // load models, init app, and start animating
	}
);
