const MODEL = "Llama-3.2-3B-Instruct-q4f32_1-MLC";
const statusEl   = document.getElementById("chatStatus");
const messagesEl = document.getElementById("chatMessages");
const formEl     = document.getElementById("chatForm");
const inputEl    = document.getElementById("chatInput");
const sendBtn    = document.getElementById("chatSend");
const stopBtn    = document.getElementById("chatStop");
const panelEl    = document.getElementById("chatPanel");
const closeBtn   = document.getElementById("chatClose");
const reopenRow  = document.getElementById("chatReopen");
const openBtn    = document.getElementById("chatOpen");

function closeChat(){
    panelEl.classList.add("collapsed");
    reopenRow.hidden = false;
}

function openChat(){
    panelEl.classList.remove("collapsed");
    reopenRow.hidden = true;
    inputEl.focus();
}

closeBtn.addEventListener("click", closeChat);
openBtn.addEventListener("click", openChat);
function showStatus(msg){ statusEl.style.display=""; statusEl.textContent = msg; }
function hideStatus(){ statusEl.style.display="none"; }

let ready=false, generating=false, currentAssistantBubble=null, pendingDatasetCoords = null;


//system prompt
const history = [{
    role: "system",
    content:
    "You are a GIS assistant. Use WGS84 (EPSG:4326). " +
    "Keep responses tight and factual: default to 2–4 sentences unless the user asks for more. " +
    "Avoid filler, apologies, and meta-commentary. " +
    "At the end of your reply, add one line exactly: COORDS: <lat>, <lon> " +
    "for the primary location you are describing in decimal degrees. " +
    "If unknown, write: COORDS: Unknown."
}];

//Country centroids (local JSON)
const COUNTRY_INDEX_URL = new URL("./countriesLatLon.json", import.meta.url);
let COUNTRY = {};
try { COUNTRY = await fetch(COUNTRY_INDEX_URL).then(r => r.json()); }
catch {}


const norm = s => s
.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

const COUNTRY_ALIASES = {
    "uk": "United Kingdom", "u k": "United Kingdom", "great britain": "United Kingdom", "britain": "United Kingdom",
    "us": "United States", "u s": "United States", "usa": "United States", "u s a": "United States",
    "united states of america": "United States",
    "czechia": "Czech Republic",
    "holland": "Netherlands",
    "russia": "Russian Federation",
    "moldova": "Moldova, Republic of",
    "macedonia": "Macedonia, the former Yugoslav Republic of",
    "north macedonia": "Macedonia, the former Yugoslav Republic of",
    "vatican": "Holy See (Vatican City State)",
    "vatican city": "Holy See (Vatican City State)",
    "holy see": "Holy See (Vatican City State)",
    "cape verde": "Cape Verde", "cabo verde": "Cape Verde",
    "south korea": "Korea, Republic of",
    "north korea": "Korea, Democratic People's Republic of",
    "uae": "United Arab Emirates",
    "iran": "Iran, Islamic Republic of",
    "syria": "Syrian Arab Republic",
    "laos": "Lao People's Democratic Republic",
    "vietnam": "Viet Nam",
    "brunei": "Brunei Darussalam",
    "burma": "Myanmar",
    "east timor": "Timor-Leste",
    "macau": "Macao",
    "ivory coast": "Côte d'Ivoire",
    "drc": "Congo, the Democratic Republic of the",
    "dr congo": "Congo, the Democratic Republic of the",
    "congo kinshasa": "Congo, the Democratic Republic of the",
    "republic of the congo": "Congo",
    "congo brazzaville": "Congo",
    "eswatini": "Swaziland",
    "tanzania": "Tanzania, United Republic of",
    "venezuela": "Venezuela, Bolivarian Republic of",
    "bolivia": "Bolivia, Plurinational State of",
    "taiwan": "Taiwan, Province of China"
};


const wordRe = (s) =>
    new RegExp(`\\b${norm(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g,'\\s+')}\\b`, 'i');

function lookupCountryInText(text){
    const L = norm(text);
    for (const name of Object.keys(COUNTRY)){
        if (wordRe(name).test(L)) {
            const v = COUNTRY[name]; return { lat: v.lat, lon: v.lon, label: name };
        }
    }
    for (const alias in COUNTRY_ALIASES){
        if (wordRe(alias).test(L)) {
            const target = COUNTRY_ALIASES[alias];
            const v = COUNTRY[target];
            if (v) return { lat: v.lat, lon: v.lon, label: target };
        }
    }
    return null;
}


if (!("gpu" in navigator)) {
    showStatus("WebGPU not available.");
    disableInput(true);
}

const worker = new Worker(new URL("./llm.worker.js", import.meta.url), { type: "module" });

let autoScroll = true;
messagesEl.addEventListener("scroll", () => {
    const nearBottom = messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight < 24;
    autoScroll = nearBottom;
});

let streamBuffer = "", rafId = null;
function scheduleFlush(){
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
        if (streamBuffer && currentAssistantBubble){
            currentAssistantBubble.textContent += streamBuffer;
            streamBuffer = "";
            if (autoScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        rafId = null;
    });
}

worker.onmessage = (ev) => {
    const msg = ev.data;
    switch (msg.type) {
        case "progress": {
            const frac = typeof msg.progress === "number" ? msg.progress : (msg.progress?.progress ?? 0);
            const note = msg.progress?.text ? ` – ${msg.progress.text}` : "";
            showStatus(`Nalaganje modela: ${Math.round(frac * 100)}%${note}`);
            break;
        }
        case "ready": {
            ready = true;
            showStatus(`Model "${MODEL}" pripravljen.`);
            setTimeout(hideStatus, 1200);
            break;
        }
        case "chunk": {
            streamBuffer += msg.delta || "";
            scheduleFlush();
            break;
        }
        case "done": {
            if (streamBuffer) { currentAssistantBubble.textContent += streamBuffer; streamBuffer = ""; }
            generating = false; disableInput(false);
            showStatus("Končano."); setTimeout(hideStatus, 600);
            
            let finalText = currentAssistantBubble.textContent;
            history.push({ role: "assistant", content: finalText });
            
            if (pendingDatasetCoords && /COORDS:\s*Unknown/i.test(finalText)) {
                finalText = finalText.replace(
                    /COORDS:\s*Unknown/i,
                    `COORDS: ${pendingDatasetCoords.lat.toFixed(4)}, ${pendingDatasetCoords.lon.toFixed(4)} (dataset)`
                );
                currentAssistantBubble.textContent = finalText;
            }
            
            let coords = extractCoordsFromText(finalText);
            
            if (!coords && pendingDatasetCoords) {
                const { lat, lon } = pendingDatasetCoords;
                currentAssistantBubble.textContent = `${finalText}\nCOORDS: ${lat.toFixed(4)}, ${lon.toFixed(4)} (dataset)`;
                coords = { lat, lon, label: "Dataset center" };
            }
            
            if (coords && typeof window.flyToLatLon === "function") {
                const btn = document.createElement("button");
                const label = coords.label || `${coords.lat.toFixed(3)}, ${coords.lon.toFixed(3)}`;
                btn.textContent = `Fly to ${label}`;
                btn.style.marginTop = "6px";
                btn.onclick = () => window.flyToLatLon(coords.lat, coords.lon, 2.0, 1200);
                currentAssistantBubble.appendChild(document.createElement("br"));
                currentAssistantBubble.appendChild(btn);
                if (autoScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
            }
            
            pendingDatasetCoords = null;
            break;
        }
        
        case "error": {
            generating = false; disableInput(false);
            pendingDatasetCoords = null;
            showStatus(`Napaka: ${msg.message}`);
            break;
        }
        case "info": {
            showStatus(msg.message);
            break;
        }
    }
};

worker.postMessage({ type: "init", model: MODEL });

formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ready || generating) return;
    
    const q = inputEl.value.trim();
    if (!q) return;
    
    append("user", q);
    history.push({ role: "user", content: q });
    
    currentAssistantBubble = append("assistant", "");
    generating = true; disableInput(true); showStatus("Generiram odgovor…");
    
    worker.postMessage({
        type: "chat",
        messages: history,
        params: { temperature: 0.25, top_p: 0.9 }
    });
    
    inputEl.value = "";
});

stopBtn.addEventListener("click", () => {
    if (!generating) return;
    worker.postMessage({ type: "stop" });
    generating = false; disableInput(false);
    pendingDatasetCoords = null;
    showStatus("Ustavljeno."); setTimeout(hideStatus, 600);
});

function append(role, text){
    const el = document.createElement("div");
    el.className = `chat-msg ${role}`;
    el.textContent = text;
    messagesEl.appendChild(el);
    if (autoScroll) messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
}
function disableInput(locked){
    sendBtn.disabled = locked;
    stopBtn.disabled = !locked;
    inputEl.disabled = locked;
}

function extractCoordsFromText(text){
    let m = text.match(/coords?\s*:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i);
    if (m){
        const lat = +m[1], lon = +m[2];
        if (isFinite(lat) && isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180)
            return { lat, lon };
    }
    m = text.match(/lat(?:itude)?\s*[:=]\s*(-?\d+(?:\.\d+)?).{0,20}?lon(?:gitude)?\s*[:=]\s*(-?\d+(?:\.\d+)?)/i);
    if (m){
        const lat = +m[1], lon = +m[2];
        if (isFinite(lat) && isFinite(lon) && Math.abs(lat)<=90 && Math.abs(lon)<=180)
            return { lat, lon };
    }
    const c = lookupCountryInText(text);
    if (c) return c;
    return null;
}

window.chatbotSummarizeDataset = (key, ds) => {
    try {
        if (!ds) return;
        const lbl = (ds.label || "").toLowerCase();
        if (key === "earthOnly" || lbl === "earth") return;
        if (!ready || generating) return;
        
        const title  = ds.label || key;
        const source = ds.chatDescription || "";
        const rawCenter = ds.chatCoords || ds.center || ds.defaultCenter || null;
        const parsed = rawCenter ? { lat: +rawCenter.lat, lon: +rawCenter.lon } : null;
        pendingDatasetCoords =
        (parsed && isFinite(parsed.lat) && isFinite(parsed.lon)) ? parsed : null;
        
        try { openChat?.(); } catch {}
        
        append("user", `Show dataset: ${title}`);
        
        const tail = pendingDatasetCoords
        ? `After the sentences, add exactly one final line: COORDS: ${pendingDatasetCoords.lat}, ${pendingDatasetCoords.lon}`
        : `After the sentences, add exactly one final line: COORDS: Unknown`;
        
        const prompt = source
        ? `Write 2–3 concise sentences summarizing this dataset for a globe visualization app.
Do not include any preface, headings, labels, or phrases like "Here is a summary"—output only the sentences.
Be concrete about what the visualization shows and key temporal/spatial patterns. Keep it brief and factual.
        
Dataset: ${title}
Official description:
"""${source}"""
        ${tail}`
        : `Write 1–2 concise sentences summarizing the dataset "${title}" for a globe visualization app.
No preface or headings—output only the sentences.
        ${tail}`;
        
        history.push({ role: "user", content: prompt.trim() });
        
        currentAssistantBubble = append("assistant", "");
        generating = true;
        disableInput(true);
        showStatus("Generiram odgovor…");
        
        worker.postMessage({
            type: "chat",
            messages: history,
            params: { temperature: 0.15, top_p: 0.9 }
        });
    } catch (e) {
        console.error("chatbotSummarizeDataset error:", e);
    }
};
