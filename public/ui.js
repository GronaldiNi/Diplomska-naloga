
export const refs = {
    opacitySlider: null,
    fpsSelect:     null,
    catalogBtn:    null,
    ovPanel:       null,
    ovPanelBtn:    null,
    dateBox:       null,
    vidCtrlBox:    null,
    timeline:      null,
};

const $ = (tag, cls) => Object.assign(document.createElement(tag), { className: cls });

export function buildUI(overlays) {
    refs.catalogBtn = $("button", "catalog-btn");
    refs.catalogBtn.textContent = "For more info";
    refs.catalogBtn.style.display = "none";
    refs.catalogBtn.onclick = () => {
        const url = refs.catalogBtn.dataset.url;
        url && window.open(url, "_blank", "noopener");
    };
    document.body.append(refs.catalogBtn);
    
    // opacity slider + fps picker
    refs.opacitySlider = $("input", "opacity-slider");
    Object.assign(refs.opacitySlider, { type:"range", min:"0", max:"1", step:"0.01", value:"1" });
    document.body.append(refs.opacitySlider);
    
    refs.fpsSelect = $("select", "fps-select");
    document.body.append(refs.fpsSelect);
    
    refs.ovPanelBtn = $("button", "ov-btn");
    refs.ovPanelBtn.textContent = "Overlays";
    refs.ovPanel = $("div", "ov-panel");
    refs.ovPanelBtn.onclick = () =>
        refs.ovPanel.style.display = refs.ovPanel.style.display === "none" ? "block" : "none";
    document.body.append(refs.ovPanelBtn, refs.ovPanel);
    
    overlays.forEach(ov => {
        const row = $("label", "ov-row");
        const cb  = $("input", "");
        cb.type = "checkbox";
        cb.onchange = () => { ov.active = cb.checked; window.applyOverlays && window.applyOverlays(); };
        const lbl = $("span", "");
        lbl.textContent = ov.label;
        row.append(cb, lbl);
        refs.ovPanel.append(row);
    });
    
    refs.dateBox = $("div", "date-box");
    document.body.append(refs.dateBox);
}

export function showCatalogButton(url) {
    refs.catalogBtn.dataset.url = url || "";
    refs.catalogBtn.style.display = url ? "block" : "none";
}

export function setOpacityVisible(show) {
    refs.opacitySlider.style.display = show ? "block" : "none";
}

export function setFPSVisible(show) {
    refs.fpsSelect.style.display = show ? "block" : "none";
}

// Dataset selector

export function buildDatasetPanel(datasets, onSelect){
    const tbl = $("table", "ds-table");
    Object.assign(tbl.style,{ borderCollapse:"collapse" });
    
    Object.entries(datasets).forEach(([key, ds]) =>{
        const btn = $("button", "");
        btn.textContent = ds.label;
        btn.onclick = () => onSelect(key);
        
        const td = $("td", "");  td.append(btn);
        const tr = $("tr", "");  tr.append(td);
        tbl.append(tr);
    });
    
    document.getElementById("controls").append(tbl);
}

function mkBtn(txt, handler){
    const b = $("button", "");
    b.textContent = txt;
    b.onclick = handler;
    return b;
}

let vidCtrlBox = null;

export function VideoControls(show){
    if(!vidCtrlBox){
        vidCtrlBox = $("div", "vid-ctrl");
        refs.vidCtrlBox = vidCtrlBox;
        Object.assign(vidCtrlBox.style,{
            position:"absolute", right:"20px", bottom:"20px",
            display:"flex", gap:"6px", zIndex:120
        });
        
        const step = dir => window.mediaStep?.(dir);
        
        vidCtrlBox.append(
            mkBtn("⏮", () => step(-Infinity)),
            mkBtn("⏪", () => step(-1)),
            mkBtn("▶",  () => window.mediaPlayPause?.()),
            mkBtn("⏩", () => step(+1)),
            mkBtn("⏭", () => step(+Infinity))
        );

        const syncIcon = () => {
            vidCtrlBox.children[2].textContent =
            window.mediaIsPlaying?.() ? "⏸" : "▶";
        };
        window.addEventListener("mediaStateChanged", syncIcon);
        syncIcon();
        
        document.body.append(vidCtrlBox);
    }
    
    vidCtrlBox.style.display     = show ? "flex" : "none";
}


refs.timeline = $("input", "timeline-slider");
Object.assign(refs.timeline, { type:"range", min:0, max:0, step:1, value:0 });
refs.timeline.style.display = "none";
document.body.append(refs.timeline);


// PIP
export function showPipWindow(url, imgStyle = {}) {
    let box = document.getElementById("pipWindow");
    if (!box) {
        box = document.createElement("div");
        Object.assign(box, { id: "pipWindow" });
        Object.assign(box.style, {
            position: "absolute",
            top: "500px",
            left: "20px",
            border: "1px solid #999",
            background: "#fff",
            resize: "both",
            overflow: "hidden",
            zIndex: 200,
            display: "flex",
            flexDirection: "column"
        });
        
        const close = document.createElement("span");
        close.textContent = "✕";
        Object.assign(close.style, {
            alignSelf: "flex-end",
            padding: "2px 6px",
            cursor: "pointer",
            userSelect: "none"
        });
        close.onclick = () => (box.style.display = "none");
        box.appendChild(close);
        
        const img = document.createElement("img");
        Object.assign(img.style, {
            flex: "1 1 auto",
            width: "100%",
            height: "100%",
            objectFit: "contain",
            pointerEvents: "none"
        });
        box.appendChild(img);
        document.body.appendChild(box);
        
        // drag 
        let sx, sy, sl, st, dragging = false;
        box.addEventListener("mousedown", (e) => {
            const r = box.getBoundingClientRect();
            const inCorner = e.clientX > r.right - 16 && e.clientY > r.bottom - 16;
            if (inCorner || e.target === close) return;
            dragging = true; sx = e.clientX; sy = e.clientY; sl = box.offsetLeft; st = box.offsetTop;
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", stop, { once: true });
            e.preventDefault();
        });
        const move = ev => { if (dragging) { box.style.left = sl + ev.clientX - sx + "px"; box.style.top = st + ev.clientY - sy + "px"; }};
        const stop = () => { dragging = false; document.removeEventListener("mousemove", move); };
    }
    const img = box.querySelector("img");
    img.src = url;
    const { width: w, height: h, ...rest } = imgStyle;
    if (w) box.style.width = w;
    if (h) box.style.height = h;
    Object.assign(img.style, rest);
    box.style.display = "block";
}

export function hidePipWindow() {
    const el = document.getElementById("pipWindow");
    if (el) el.style.display = "none";
}
