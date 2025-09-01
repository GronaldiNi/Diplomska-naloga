// datasetConfigs.js
export const datasets = {
  earthOnly: {
    label: "Earth",
    playlistPath: "",
    extractLayerPath() { return "/textures/earth/earth.png"; }
  },
  airTraffic: {
    label: "Air Traffic",
    chatDescription: "The visualization shows the movement of commercial flights around the globe. On any given day, more than 87,000 flights are in the skies in the United States. Only one-third are commercial carriers, like American, United or Southwest. On an average day, air traffic controllers handle 28,537 commercial flights (major and regional airlines), 27,178 general aviation flights (private planes), 24,548 air taxi flights (planes for hire), 5,260 military flights and 2,148 air cargo flights (Federal Express, UPS, etc.). At any given moment, roughly 5,000 planes are in the skies above the United States. In one year, controllers handle an average of 64 million takeoffs and landings.From the National Air Traffic Controllers Association webpage. This dataset tracks commercial flights from the approximately 9000 civil airports worldwide. The day/night terminator is included as a time reference. Flight traffic picks up noticeably during daylight hours and drops off through the night. Each yellow tail is one plane in this visualization.",
    chatCoords:{ lat: 40, lon: -73 }, //New York
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
    chatDescription: "The Global Monitoring Division at NOAA diligently monitors carbon dioxide and other trace gases in the atmosphere. One of the methods they use to sample trace gases is collecting flasks of air from around the world that can be tested. They have several other means for collecting samples as well. In this data set, the NOAA GMD sampling network as of 2005 is portrayed. Circles are flask sampling locations, stars are aircraft sites (12 flasks per flight are filled) and ships, which are only visible as they race from Australia and New Zealand to the US west coast or Japan, or from Cape Town to the US east coast. The coloration in the dataset represents the fluxes constructed by the ocean, biosphere, and fossil fuel modules of the NOAA ESRL data assimilation system for CO2 and related trace gases. The data set shows daily average fluxes constructed from 3-hour model output. Seasonally, the CO2 fluxes go through a cycle where respiration by the biosphere dominates over photosynthesis (winter, red colors), to one where photosynthesis is stronger than respiration (summer, green colors). The passage of fronts usually leads to red colors in the movie, as reduced sunlight reduces photosynthesis leading to net emissions. In late fall, high temperatures in the southern US combined with droughts leads to 'stressed' vegetation (red colors), reducing photosynthesis and thus also net emissions of CO2. The ocean fluxes mostly show a coarse pattern of CO2 concentrations in sea water, which is determined by large scale ocean circulation. Cold, CO2 rich water is brought to the surface in the Eastern Tropical Pacific, while the downward transport of warm, CO2 poor water occurs in the extra-tropics in the North Atlantic. In this dataset, the pattern and magnitude of fossil fuel CO2 fluxes is prescribed based on EPA estimates. They show up as red spots in locations of major cities.",
    chatCoords:{ lat: 42, lon: -93 }, //Iowa
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
    chatDescription: "The surface of the Earth is composed of a mosaic of tectonic plates with edges that create fault lines. The Earth's crust is made of seven major plates and several smaller plates. As the plates move, new sea floor can be created. The plates form three different kinds of boundaries: convergent, divergent, and transform. Convergent boundaries are also called collision boundaries because they are areas where two plates collide. At transform boundaries, the plates slide and grind past one another. The divergent boundaries are the areas where plates are moving apart from one another. Where plates move apart, new crustal material is formed from molten magma from below the Earth's surface. Because of this, the youngest sea floor can be found along divergent boundaries, such as the Mid-Atlantic Ocean Ridge. The spreading, however, is generally not uniform causing linear features perpendicular to the divergent boundaries, shown in this dataset as contour lines. This dataset shows the age of the ocean floor with the lines or contours of 5 million years as shown in the colorbar. Plate names and plate boundaries are available as layers but must be turned on to appear. The data is from four companion digital models of the age, age uncertainty, spreading rates and spreading asymmetries of the world's ocean basins. Scientists use the magnetic polarity of the sea floor to determine the age. Very little of the sea floor is older than 150 million years. This is because the oldest sea floor is subducted under other plates and replaces by new surfaces. The tectonic plates are constantly in motion and new surfaces are always being created. This continual motion is evidenced by the occurrence of earthquakes and volcanoes.",
    chatCoords:{ lat: 35, lon: 24 }, //Crete
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
    chatDescription: "Fires, both natural and manmade, are plotted in this daily imagery as a function of how many fires occurred within each 500 m pixel area over the selected time period. Satellites are sensitive to infrared (heat) energy and are able to detect the thermal signature of fires. This data is not only useful for detecting wildfires in otherwise remote areas, but also for understanding how large fires spread over time. This imagery uses satellite data from NASA MODIS Terra along with Suomi NPP VIIRS for global coverage of fire activity. Some of the global patterns that appear in the fire maps over time are the result of natural cycles of rainfall, dryness, and lightning. For example, naturally occurring fires are common in the boreal forests of Canada and grasslands in Australia in the summer. These are seen in opposite times of the year due to seasonal differences between the northern and southern hemispheres. In other parts of the world, the patterns are the result of human activity. For example, the intense burning in the heart of South America from August-October is a result of human-triggered fires, both intentional and accidental. Across Africa, a band of widespread agricultural burning sweeps north to south over the continent as the dry season progresses each year. Agricultural burning occurs in late winter and early spring each year across Southeast Asia as well.",
    chatCoords:{ lat: -13, lon: 28 }, //Zambia
    frameDir: "/textures/rt/4096/",  
    
    prefix:  "fire_",              
    start:   "2024-07-07",           
    end:     "2025-07-25",          
    
    labelFormatter: d =>
      d.toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})
  },
  
};
