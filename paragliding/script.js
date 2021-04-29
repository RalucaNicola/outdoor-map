import { gpx } from "https://unpkg.com/@tmcw/togeojson?module";

import EsriMap from "esri/Map.js";
import SceneView from "esri/views/SceneView.js";
import GeoJSONLayer from "esri/layers/GeoJSONLayer.js";
import ElevationProfile from "esri/widgets/ElevationProfile.js";
import ElevationProfileLineGround from "esri/widgets/ElevationProfile/ElevationProfileLineGround.js";
import { SimpleRenderer } from "esri/renderers.js";
import { LineSymbol3D, LineSymbol3DLayer, PathSymbol3DLayer } from "esri/symbols.js";
import ElevationProfileLineInput from "esri/widgets/ElevationProfile/ElevationProfileLineInput.js";
import Graphic from "esri/Graphic.js";

const map = new EsriMap({
  basemap: "satellite",
  ground: "world-elevation",
});

const view = new SceneView({
  map: map,
  container: "viewDiv",
  qualityProfile: "high",
  camera: {
  position: [
    9.79080423,
    46.31514431,
    15841.79689
  ],
  heading: 318.62,
  tilt: 68.94
},
  environment: {
    atmosphere: { quality: "high" },
  },
  ui: {
    components: ["attribution"],
  },
});

view.ui.add("sideMenu", "top-right");

const epw = new ElevationProfile({
  view,
  container: "elevationProfileContainer",
  profiles: [
    new ElevationProfileLineGround({
      color: [159, 207, 130],
      visible: false
    }),
    new ElevationProfileLineInput({ color: [245, 203, 66], title: "Paragliding track" }),
  ],
  visibleElements: {
    selectButton: false,
    sketchButton: false,
    settingsButton: false,
  },
});

view.when(async () => {
  const response = await fetch("./paragliding.gpx");
  const gpxcontent = await response.text();
  const geojson = [JSON.stringify(gpx(new DOMParser().parseFromString(gpxcontent, "text/xml")))];
  const geojsonurl = URL.createObjectURL(
    new Blob(geojson, {
      type: "text/plain",
    })
  );

  const geojsonLayer = new GeoJSONLayer({
    url: geojsonurl,
    copyright: "Paragliding track provided by Remo Hosig",
    renderer: getRenderer({wallProjection: false}),
    elevationInfo: {
      mode: "absolute-height",
    },
  });

  map.add(geojsonLayer);

  await geojsonLayer.load();

  document.getElementById("enableWallProjection").addEventListener("click", (event) => {
    geojsonLayer.renderer = getRenderer({wallProjection: event.target.checked});
  });

  addToElevationProfile(geojsonLayer);
});

function getRenderer(options) {
  if (options.wallProjection) {
    return new SimpleRenderer({
      symbol: new LineSymbol3D({
        symbolLayers: [
          new LineSymbol3DLayer({
            material: { color: [245, 203, 66] },
            size: "3px",
          }),
          new PathSymbol3DLayer({
            profile: "quad",
            material: { color: [245, 203, 66, 0.3] },
            width: 0,
            height: 2000,
            join: "miter",
            cap: "butt",
            anchor: "top",
            profileRotation: "heading",
          })
        ]
      })
    })
  } else {
    return new SimpleRenderer({
      symbol: new LineSymbol3D({
        symbolLayers: [
          new LineSymbol3DLayer({
            material: { color: [245, 203, 66] },
            size: "3px",
          })
        ]
      }),
    })
  }
}

async function addToElevationProfile(layer) {

  const { features } = await layer.queryFeatures();

  if (features.length) {
    epw.input = new Graphic({ geometry: features[0].geometry });
  } else {
    epw.input = null;
  }
}
