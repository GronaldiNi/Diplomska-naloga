import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm@0.2.79";

let engine = null;
let currentController = null;

self.onmessage = async (ev) => {
    const msg = ev.data;
    try {
        if (msg.type === "init") {
            engine = await CreateMLCEngine(msg.model, {
                initProgressCallback: (p) => self.postMessage({ type: "progress", progress: p }),
            });
            self.postMessage({ type: "ready" });
            return;
        }
        
        if (msg.type === "chat") {
            if (!engine) throw new Error("Engine not initialized");
            currentController = new AbortController();
            
            const stream = await engine.chat.completions.create({
                messages: msg.messages,
                stream: true,
                temperature: msg.params?.temperature ?? 0.7,
                top_p: msg.params?.top_p ?? 0.95,
                signal: currentController.signal,
            });
            
            let acc = "";
            for await (const chunk of stream) {
                const delta = chunk?.choices?.[0]?.delta?.content || "";
                if (delta) {
                    acc += delta;
                    self.postMessage({ type: "chunk", delta });
                }
            }
            currentController = null;
            self.postMessage({ type: "done", text: acc });
            return;
        }
        
        if (msg.type === "stop") {
            if (currentController) currentController.abort();
            if (engine?.interruptGenerate) engine.interruptGenerate();
            return;
        }
    } catch (err) {
        currentController = null;
        self.postMessage({ type: "error", message: (err && err.message) || String(err) });
    }
};
