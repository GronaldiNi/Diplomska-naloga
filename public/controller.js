import { datasets }      from "./datasetConfigs.js";
import overlays, {applyOverlays} from "./overlays.js";
import { buildUI, refs, showCatalogButton, setOpacityVisible, setFPSVisible, VideoControls, buildDatasetPanel, showPipWindow, hidePipWindow } from "./ui.js";


window.createDatasetScene = function (engine, canvas, layerUrl, { fps } = {}) {
  const scene = window.createTiledGlobeScene(engine, canvas);
  const sphere = BABYLON.MeshBuilder.CreateSphere(
    "datasetSphere", { diameter: 2.002, segments: 64 }, scene);
    
    const mat = new BABYLON.StandardMaterial("datasetMat", scene);
    mat.backFaceCulling = true;
    mat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    mat.specularColor = new BABYLON.Color3(0, 0, 0);
    mat.alpha = 1;                      
    sphere.material = mat;
    sphere.renderingGroupId = 1;                  
    
    /*Naloži podatkovni niz*/
    let tex;
    if (layerUrl.toLowerCase().endsWith(".mp4")) {
      tex = new BABYLON.VideoTexture("vidTex", layerUrl, scene, true, true, BABYLON.Texture.TRILINEAR_SAMPLINGMODE,{autoUpdateTexture: true, loop: true});
      window.currentVideo = tex.video;
      window.dispatchEvent(new Event("newVideoTexture"));
      window.currentFps   = fps || 30;
      if (fps) tex.video.playbackRate = fps / 30;
    } else {
      tex = new BABYLON.Texture(layerUrl, scene, true, false);
    }
    tex.uScale   = -1;
    tex.hasAlpha = true;
    mat.diffuseTexture  = tex;
    mat.opacityTexture  = tex;     
    window.dataMat = mat;     
    return scene;
  };
  
  
  (function () {
    /*UI startup*/
    buildUI(overlays);
    buildDatasetPanel(datasets, loadDataset)
    setOpacityVisible(false);
    setFPSVisible(false);
    const {opacitySlider, fpsSelect, dateBox } = refs;
    
    opacitySlider.oninput = () => {
      if (window.dataMat) window.dataMat.alpha = +opacitySlider.value;
    };
    
    
    
    const canvas   = document.getElementById("renderCanvas");
    let engine, currentScene;
    const boot = async () => {
      // tiledGlobe
      currentScene = window.createTiledGlobeScene(engine, canvas);
      window.applyOverlays = () => applyOverlays(currentScene);
      await applyOverlays(currentScene);
      engine.runRenderLoop(() => currentScene?.render());
      window.addEventListener("resize", () => engine.resize());
    };
    
    // Date-label helpers
    let cancelLabelLoop;
    function teardownDateLabels() {
      cancelLabelLoop?.();
      dateBox.style.display = "none";
      cancelLabelLoop = null;
    }
    function setupDateLabels(labels) {
      teardownDateLabels();
      if (!labels.length || !window.currentVideo) return;
      const vid = window.currentVideo;
      dateBox.style.display = "block";
      
      const startLoop = () => {
        const step = vid.duration / labels.length;
        const update = () => {
          const i = Math.min(labels.length - 1,
            Math.floor(vid.currentTime / step));
            dateBox.textContent = labels[i] || "";
          };
          let handle = null;
          const loop = () => {
            update();
            handle = vid.requestVideoFrameCallback
            ? vid.requestVideoFrameCallback(loop)
            : requestAnimationFrame(loop);
          };
          loop();
          cancelLabelLoop = () => {
            if (vid.requestVideoFrameCallback)
              vid.cancelVideoFrameCallback(handle);
            else
              cancelAnimationFrame(handle);
            dateBox.style.display = "none";
          };
        };
        
        vid.readyState >= 1
        ? startLoop()
        : vid.addEventListener("loadedmetadata", startLoop, { once: true });
      }
      
      function buildSequence({frameDir, prefix, start, end}) {
        const seq = [];
        const d0  = new Date(start), d1 = new Date(end);
        for(let d=d0; d<=d1; d.setUTCDate(d.getUTCDate()+1)){
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth()+1).padStart(2,"0");
          const day=String(d.getUTCDate()).padStart(2,"0");
          seq.push(`${frameDir}${prefix}${y}${m}${day}.png`);
        }
        return seq;
      }
      
      
      //Cevovod za podatkovne nize
      async function loadDataset(key) {
        teardownDateLabels();
        if (window.rtTimer){ 
          clearInterval(window.rtTimer);
          window.rtTimer = null;
        }
        refs.dateBox.style.display   = "none";
        refs.timeline.style.display  = "none"; 
        const ds = datasets[key];
        //real-time image sequence
        if (ds.isRealtime) {
          hidePipWindow();
          showCatalogButton(null);
          setOpacityVisible(true);
          VideoControls(false);
          
          const frames = buildSequence(ds);
          const scene  = window.createTiledGlobeScene(engine, canvas);
          currentScene = scene;
          
          // overlay sphere, initially first frame
          const mat = new BABYLON.StandardMaterial("rtMat", scene);
          mat.backFaceCulling = true;
          mat.emissiveColor = new BABYLON.Color3(1,1,1);
          mat.specularColor = new BABYLON.Color3(0,0,0);
          mat.alpha = 1;
          mat.useAlphaFromDiffuseTexture = true;
          const sphere = BABYLON.MeshBuilder.CreateSphere(
            "rtSphere",{diameter:2.002,segments:64},scene);
            sphere.material = mat;  sphere.renderingGroupId = 1;
            window.dataMat = mat;
            
            //date labels
            const lbls = frames.map(p => {
              const m = p.match(/(\d{8})\.png$/);
              if (!m) return "";
              const d = new Date(`${m[1].slice(0,4)}-${m[1].slice(4,6)}-${m[1].slice(6)}`);
              return d.toLocaleDateString("en-GB",
                { day:"2-digit", month:"short", year:"numeric" });
              });
              refs.dateBox.style.display = "block";
              
              // non-blinking frames
              let loading    = false;
              let pendingIdx = null;
              let currentTex = null;
              
              const t0 = new BABYLON.Texture(
                frames[0],
                scene,
                true,
                false
              );
              t0.uScale   = -1;
              t0.hasAlpha = true;
              t0.onLoadObservable.addOnce(() => {
                mat.opacityTexture = null;
                mat.diffuseTexture = t0;
                currentTex = t0;
                
                refs.timeline.value      = 0;
                window.currentRTIdx      = 0;
                refs.dateBox.textContent = lbls[0] || "";
              });
              
              const setFrame = (idx) => {
                const url = frames[idx];
                
                if (loading) { pendingIdx = idx; return; }
                loading = true;
                
                const tex = new BABYLON.Texture(url, scene, true, false);
                tex.uScale   = -1;
                tex.hasAlpha = true;
                
                tex.onLoadObservable.addOnce(() => {
                  const prev = currentTex;
                  mat.diffuseTexture = tex;
                  currentTex = tex;
                  
                  refs.timeline.value      = idx;
                  window.currentRTIdx      = idx;
                  refs.dateBox.textContent = lbls[idx] || "";
                  if (prev && prev !== tex) prev.dispose();
                  
                  loading = false;
                  if (pendingIdx !== null && pendingIdx !== idx) {
                    const next = pendingIdx; pendingIdx = null;
                    setFrame(next);
                  } else {
                    pendingIdx = null;
                  }
                });
              };
              
              
              
              // UI wire-up
              refs.timeline.min   = 0;
              refs.timeline.max   = frames.length - 1;
              refs.timeline.value = 0;
              refs.timeline.oninput = e => { pause(); setFrame(+e.target.value); };
              refs.timeline.style.display = "block";
              window.isRealtimeContext = true;             // <-- moved up
              window.setRTFps = v => { playFps = v; if (timer) { pause(); play(); } };
              VideoControls(true);
              
              // videoplay
              let timer   = null;
              let playFps = 2;
              const play  = () => {
                timer ||= setInterval(() => step(+1), 1000 / playFps);
                window.rtTimer = timer; 
                syncBtn();
              };
              function pause(){ clearInterval(timer); timer = window.rtTimer = null; syncBtn(); }
              
              window.setRTFps = v => { playFps = v; if (timer) { pause(); play(); } };
              
              // FPS za RT
              setFPSVisible(true);
              fpsSelect.innerHTML = "";
              [1, 2, 5].forEach(v => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.textContent = `${v} fps`;
                if (v === 2) opt.selected = true;
                fpsSelect.appendChild(opt);
              });
              
              fpsSelect.onchange = () => window.setRTFps?.(+fpsSelect.value);
              window.setRTFps?.(+fpsSelect.value);
              
              
              const syncBtn = () => {
                if (!refs.vidCtrlBox) return;
                refs.vidCtrlBox.children[2].textContent = timer ? "⏸" : "▶";
              };
              
              const step = dir => {
                let i = window.currentRTIdx ?? 0;
                if (dir === -Infinity)        i = 0;
                else if (dir === +Infinity)   i = frames.length - 1;
                else                          i = (i + dir + frames.length) % frames.length;
                setFrame(i);
              };
              
              window.mediaStep       = step;
              window.mediaPlayPause  = () => (timer ? pause() : play());
              window.mediaIsPlaying  = () => !!timer;
              
              
              
              
              // overlays
              window.applyOverlays = () => applyOverlays(scene);
              await applyOverlays(scene);
              
              return;
            }
            
            
            if (!ds.playlistPath) {
              hidePipWindow();
              teardownDateLabels();
              showCatalogButton(null);
              setOpacityVisible(false);
              setFPSVisible(false);
              currentScene = window.createTiledGlobeScene(engine, canvas);
              refs.opacitySlider.value = "1";
              refs.timeline.style.display = "none";
              VideoControls(false);
              refs.dateBox.style.display = "none";
              
              return;
            }
            try {
              // fetch playlist, parse paths, grab optional extras
              const plistURL = `/getPlaylist?path=${encodeURIComponent(ds.playlistPath)}`;
              const { content } = await (await fetch(plistURL)).json();
              const dir = ds.playlistPath.slice(0, ds.playlistPath.lastIndexOf("/") + 1);
              
              let texPath   = ds.extractLayerPath(content);
              if (!texPath) throw new Error("No layer found");
              if (!texPath.startsWith("/")) texPath = dir + texPath;
              const texURL = `/getLayer?path=${encodeURIComponent(texPath)}`;
              
              // optional extras
              const fps    = ds.extractFps?.(content);
              const pip    = ds.extractPip?.(content);
              const cUrl   = ds.extractCatalogUrl?.(content);
              const lblPth = ds.extractLabelsPath?.(content);
              
              // UI
              showCatalogButton(cUrl);
              setOpacityVisible(true);
              
              hidePipWindow();
              if (pip) {
                let rel = pip.relPath;
                if (!rel.startsWith("/")) rel = dir + rel;
                showPipWindow(`/getLayer?path=${encodeURIComponent(rel)}`, pip.style);
              }
              
              // create dataset scene
              const isVideo = texPath.toLowerCase().endsWith(".mp4");
              currentScene = window.createDatasetScene(engine, canvas, texURL, { fps });
              window.applyOverlays = () => applyOverlays(currentScene);
              refs.opacitySlider.value = "1";
              await applyOverlays(currentScene);
              if (isVideo && window.currentVideo) {
                window.basePlaybackRate = window.currentVideo.playbackRate;
                // connect video element to control bar
                window.mediaStep = dir => {
                  const stepSec = dir === Infinity || dir === -Infinity
                  ? (dir > 0 ? window.currentVideo.duration : -window.currentVideo.currentTime)
                  : 1 / (window.currentFps || 30);
                  window.currentVideo.currentTime = Math.max(
                    0,
                    Math.min(window.currentVideo.duration,
                      window.currentVideo.currentTime + (dir === Infinity || dir === -Infinity ? stepSec : dir * stepSec))
                    );
                  };
                  window.mediaPlayPause = () =>
                    window.currentVideo.paused ? window.currentVideo.play()
                  : window.currentVideo.pause();
                  window.mediaIsPlaying = () =>
                    window.currentVideo && !window.currentVideo.paused;
                  
                  window.isRealtimeContext = false;
                  window.dispatchEvent(new Event("mediaStateChanged"));
                  
                }
                VideoControls(isVideo);
                if (isVideo && window.currentFps) {
                  
                  fpsSelect.innerHTML = "";
                  
                  const base = window.currentFps;
                  const choices = [
                    base / 4,
                    base / 2,
                    base,
                    base * 2,
                    base * 4
                  ].filter(f => (f / base) > 0.25)
                  .map(f => +f.toFixed(2));
                  
                  choices.forEach(f => {
                    const opt = document.createElement("option");
                    opt.value      = f;
                    opt.textContent = (f === base ? `${f} fps (default)` : `${f} fps`);
                    if (f === base) opt.selected = true;
                    fpsSelect.appendChild(opt);
                  });
                  
                  fpsSelect.onchange = () => {
                    if (!window.currentVideo || !window.currentFps || !window.basePlaybackRate) return;
                    const desired = +fpsSelect.value;
                    window.currentVideo.playbackRate =
                    window.basePlaybackRate * (desired / window.currentFps);
                  };
                  
                  setFPSVisible(isVideo);
                } else {
                  setFPSVisible(isVideo);
                }
                
                
                if (lblPth) {
                  let lp = lblPth.startsWith("/") ? lblPth : dir + lblPth;
                  const resp  = await fetch(`/getLayer?path=${encodeURIComponent(lp)}`);
                  const lines = (await resp.text()).trim().split(/\r?\n/);
                  setupDateLabels(lines);
                } else teardownDateLabels();
              }
              catch (e) {
                teardownDateLabels();
                showCatalogButton(null);
                setOpacityVisible(false);
                VideoControls(false);
                setFPSVisible(false);
                alert("Failed to load dataset: " + e.message);
                console.error(e);
              }
            }
            
            
            // start
            (async () => {
              if (BABYLON.WebGPUEngine?.IsSupportedAsync &&
                await BABYLON.WebGPUEngine.IsSupportedAsync) {
                  engine = new BABYLON.WebGPUEngine(canvas); await engine.initAsync();
                  console.log("WebGPU");
                } else {
                  engine = new BABYLON.Engine(canvas, true);
                  console.log("WebGL2");
                }
                await boot();
              })();
            })();
