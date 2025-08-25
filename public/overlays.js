export const overlays = [
    { key: "capitals",            label: "Capitals",            path: "/overlays/capitals/4096.png" },
    { key: "city_names",          label: "City Names",          path: "/overlays/city_names/4096.png" },
    { key: "currents",            label: "Currents",            path: "/overlays/currents/combined.png" },
    { key: "general_circulation", label: "General Circulation", path: "/overlays/general_circulation/features_arrows.png" },
    { key: "ocean_names",         label: "Ocean Names",         path: "/overlays/ocean_names/4096.png" },
    { key: "tectonics",  label: "Tectonic plates",  paths: [
        "/overlays/plate_boundary/color/4096.png",
        "/overlays/plate_boundary/color/legend.png",
        "/overlays/plate_names/4096.png"
    ]},
    { key: "railroads",     label: "Railroads",  path: "/overlays/railroad/4096.png" },
    { key: "rivers",        label: "Rivers",     path: "/overlays/rivers/4096.png" },
    { key: "roads",         label: "Roads",      path: "/overlays/roads/white/4096.png" },
    { key: "timezones",     label: "Timezones",  path: "/overlays/timezones/4096.png" },
    { key: "black_borders", label: "Black country borders", path: "/overlays/country_borders/4096_black.png" },
    { key: "white_borders", label: "White country borders", path: "/overlays/country_borders/4096.png" }
]
overlays.forEach(o => { o.active = false; o.meshes = null })

function buildSphere (scene, tex, id) {
    const mat = new BABYLON.StandardMaterial("mat_" + id, scene)
    mat.diffuseTexture  = tex
    mat.opacityTexture  = tex
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND
    mat.disableDepthWrite = true
    mat.backFaceCulling   = true
    mat.emissiveColor     = new BABYLON.Color3(1,1,1)
    mat.specularColor     = new BABYLON.Color3(0,0,0)
    
    const s = BABYLON.MeshBuilder.CreateSphere(
        "ovSphere_" + id, { diameter: 2.0, segments: 64 }, scene)
        s.material         = mat
        s.isPickable       = false
        s.renderingGroupId = 1
        return s
    }
    
    export async function createOverlayMesh (ov, scene) {
        const single = ov.ftpPath ?? ov.path
        const multi  = ov.ftpPaths ?? ov.paths
        
        if (single) {
            const tex = new BABYLON.Texture(`/getLayer?path=${encodeURIComponent(single)}`, scene, true, false)
            tex.uScale = -1;  tex.hasAlpha = true
            ov.meshes  = [ buildSphere(scene, tex, ov.label) ]
            return
        }
        
        if (multi) {
            ov.meshes = multi.map((p, i) => {
                const tex = new BABYLON.Texture(`/getLayer?path=${encodeURIComponent(p)}`, scene, true, false)
                tex.uScale = -1; tex.hasAlpha = true
                return buildSphere(scene, tex, `${ov.label}_${i}`)
            })
            return
        }
    }
    
    export async function applyOverlays (scene) {
        for (const ov of overlays) {
            if (ov.active && (!ov.meshes || ov.meshes.some(m => m._scene !== scene))) {
                await createOverlayMesh(ov, scene)
            }
            (ov.meshes || []).forEach(m => m.setEnabled(ov.active))
        }
    }
    
    export default overlays
