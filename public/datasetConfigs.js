// datasetConfigs.js
export const datasets = {
  earthOnly: {
    label: "Earth",
    playlistPath: "",
    extractLayerPath() { return "/textures/earth/earth.png"; }
  },
  airTraffic: {
    label: "Air Traffic",
    
    playlistPath: "/atmosphere/air_traffic/playlist.sos",
    
    extractLayerPath(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("data") && ln.includes(".mp4")) {
          return ln.split("=")[1].trim();          
        }
      }
      return null;
    },
    
    extractCatalogUrl(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("catalog_url")) {
          const eq = ln.indexOf("=");
          return ln.slice(eq + 1).trim();
        }
      }
      return null;
    },
  },
  
  carbonFlux: {
    label: "Carbon Flux",
    playlistPath: "/atmosphere/carbonflux/playlist.sos",
    
    extractLayerPath(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("data") && ln.includes(".mp4")) {
          return ln.split("=")[1].trim();      
        }
      }
      return null;
    },
    

    extractCatalogUrl(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("catalog_url")) {
          const eq = ln.indexOf("=");
          return ln.slice(eq + 1).trim();
        }
      }
      return null;
    },
    
    extractFps(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("fps")) {
          return parseFloat(ln.split("=")[1].trim());
        }
      }
      return null;           
    },
    extractLabelsPath(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("label") && ln.includes(".txt")) {
          return ln.split("=")[1].trim();
        }
      }
      return null;
    },
  },
  
  seafloorAge: {
    label: "Seafloor Globe",
    

    playlistPath: "/land/sea_floor_age/topo/playlist.sos",
    

    extractLayerPath(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("layerdata") && ln.includes(".jpg")) {
          return ln.split("=")[1].trim();   
        }
      }
      return null;
    },
    

    extractPip(content) {
      for (const ln of content.split(/\r?\n/)) {
        if (ln.startsWith("pip")) {
          return {
            relPath: ln.split("=")[1].trim(),  
            style:   { width: "512px", height: "auto" }  
          };
        }
      }
      return null;
    },
    extractCatalogUrl(content) {
      for (const ln of content.split(/\r?\n/)){
        if(ln.startsWith("catalog_url")) {
          const eq = ln.indexOf("=");
          return ln.slice(eq + 1).trim();
        }
      }
      return null;
    }
  },
  realTimeFire: {
    label: "Realtime Fires",
    isRealtime: true,            
    

    frameDir: "/textures/rt/4096/",  
    
    prefix:  "fire_",              
    start:   "2024-07-07",           
    end:     "2025-07-25",          
    
    labelFormatter: d =>
      d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
  },
  
  /* add more datasets here the same way */
};
