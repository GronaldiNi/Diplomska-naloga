const SKYBOX_SIZE = 1000;
const ZOOM = 2;
const SUBDIVS = 16;

const { CLAMP_ADDRESSMODE, LINEAR_SAMPLINGMODE } = BABYLON.Texture;
const { CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY } = BABYLON.AbstractMesh;

const v3 = (x, y, z) => new BABYLON.Vector3(x, y, z);

window.createSpaceSkybox = function (scene, stem = "/textures/space/space") {
    const envTex = new BABYLON.CubeTexture(stem, scene);
    const skybox = scene.createDefaultSkybox(envTex, true, SKYBOX_SIZE, 0);
    return skybox;
};

window.createCommonCamera = function (scene, canvas) {
    const camera = new BABYLON.ArcRotateCamera("commonCamera", 0, 0, 0, v3(0, 0, 0), scene);
    camera.setPosition(v3(0, 1, -2.5));
    Object.assign(camera, {
        lowerRadiusLimit: 1.05,
        upperRadiusLimit: 3.5,
        radius: 3.2,
        wheelDeltaPercentage: 0.01,
        minZ: 0.01,
        maxZ: 5
    });
    camera.attachControl(canvas, true);
    return camera;
};

function createLights(scene) {
    new BABYLON.DirectionalLight("l0", v3(0, 0, 1), scene);
    new BABYLON.DirectionalLight("l1", v3(0, -1, -1), scene);
}

class TileId {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    get index() { return this.y * (2 ** this.z) + this.x; }
}

const tileVertexCache = {};
function buildTileVertexData(x, y, z) {
    const key = `${x}:${y}:${z}`;
    if (tileVertexCache[key]) return tileVertexCache[key];
    
    const tilesPerAxis = 2 ** z;
    const latStep = Math.PI / tilesPerAxis;
    const lonStep = 2 * Math.PI / tilesPerAxis;
    
    const latMax = Math.PI / 2 - y * latStep;
    const latMin = latMax - latStep;
    
    const lonMin = x * lonStep;
    const lonMax = lonMin + lonStep;
    
    const segments = SUBDIVS;
    const positions = [];
    const indices = [];
    const uvs = [];
    
    for (let yy = 0; yy <= segments; yy++) {
        const v = yy / segments;
        const lat = BABYLON.Scalar.Lerp(latMax, latMin, v);
        const cosLat = Math.cos(lat);
        const sinLat = Math.sin(lat);
        
        for (let xx = 0; xx <= segments; xx++) {
            const u = xx / segments;
            const lon = BABYLON.Scalar.Lerp(lonMin, lonMax, u);
            
            positions.push(cosLat * Math.cos(lon), sinLat, cosLat * Math.sin(lon));
            uvs.push(u, v);
            
            if (xx < segments && yy < segments) {
                const b = yy * (segments + 1) + xx;
                indices.push(b, b + segments + 1, b + 1, b + 1, b + segments + 1, b + segments + 2);
            }
        }
    }
    
    const vd = new BABYLON.VertexData();
    vd.positions = positions;
    vd.indices = indices;
    vd.uvs = uvs;
    vd.normals = positions;
    
    tileVertexCache[key] = vd;
    return vd;
}

function onTextureLoaded(tex, mat, mesh) {
    tex.wrapU = tex.wrapV = CLAMP_ADDRESSMODE;
    tex.anisotropicFilteringLevel = 8;
    mat.diffuseTexture = tex;
    mesh.material = mat;
    mesh.freezeWorldMatrix();
    mesh.freezeNormals();
    mesh.doNotSyncBoundingInfo = true;
    mesh.cullingStrategy = CULLINGSTRATEGY_BOUNDINGSPHERE_ONLY;
    mesh.isVisible = true;
}

function onTextureError(path) {
    console.error(`Failed to load ${path}`);
}

window.createTiledGlobeScene = function (engine, canvas) {
    const scene = new BABYLON.Scene(engine);
    createSpaceSkybox(scene);
    scene.clearColor = new BABYLON.Color4(0, 0, 0, 1);
    scene.ambientColor = new BABYLON.Color3(1, 1, 1);
    
    createLights(scene);
    const camera = createCommonCamera(scene, canvas);
    
    const tilesPerAxis = 2 ** ZOOM;
    
    for (let y = 0; y < tilesPerAxis; y++) {
        for (let x = 0; x < tilesPerAxis; x++) {
            const tile = new TileId(x, y, ZOOM);
            
            const mesh = new BABYLON.Mesh(`tile_${x}_${y}`, scene);
            mesh.isVisible = false;
            buildTileVertexData(x, y, ZOOM).applyToMesh(mesh);
            
            const mat = new BABYLON.StandardMaterial(`mat_${x}_${y}`, scene);
            mat.backFaceCulling = true;
            mat.specularColor = new BABYLON.Color3(0, 0, 0);
            mat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            mat.zOffset = -1;
            
            const path = `/textures/earth/tiles/z1/tile_z1_${tile.index}.jpg`;
            const tex = new BABYLON.Texture(
                path,
                scene,
                false,
                false,
                LINEAR_SAMPLINGMODE,
                () => onTextureLoaded(tex, mat, mesh),
                () => onTextureError(path)
            );
        }
    }
    
    let oldR = -1;
    scene.registerAfterRender(() => {
        if (camera.radius !== oldR) {
            oldR = camera.radius;
            camera.angularSensibilityX = 2000 / Math.log2(camera.radius);
            camera.angularSensibilityY = 2000 / Math.log2(camera.radius);
            const rMin = camera.lowerRadiusLimit ?? 1.05;
            const rMax = camera.upperRadiusLimit ?? 3.5;
            const t = BABYLON.Scalar.Clamp((camera.radius - rMin) / (rMax - rMin), 0, 1);
            camera.inertia = BABYLON.Scalar.Lerp(0.55, 0.90, t);
        }
    });
    
    return scene;
};
