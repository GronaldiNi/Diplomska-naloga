import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = e => handler.onmessage(e);
