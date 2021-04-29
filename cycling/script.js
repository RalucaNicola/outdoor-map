import { gpx } from "https://unpkg.com/@tmcw/togeojson?module";

import EsriMap from "esri/Map.js";
import SceneView from "esri/views/SceneView.js";
import ElevationProfile from "esri/widgets/ElevationProfile.js";
import LayerList from "esri/widgets/LayerList.js";
import FeatureLayer from "esri/layers/FeatureLayer.js";
import { LineSymbol3D, LineSymbol3DLayer, PointSymbol3D, IconSymbol3DLayer } from "esri/symbols.js";
import { Polyline, Point } from "esri/geometry.js";
import ElevationProfileLineInput from "esri/widgets/ElevationProfile/ElevationProfileLineInput.js";
import Graphic from "esri/Graphic.js";
import GraphicsLayer from "esri/layers/GraphicsLayer.js";

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
      8.61963097,
      47.45510108,
      8096.99619
    ],
    heading: 194.07,
    tilt: 69.62
  },
  environment: {
    atmosphere: { quality: "high" },
  },
  ui: {
    components: ["attribution"],
  },
  popup: {
    defaultPopupTemplateEnabled: true
  }
});

const elevationProfile = new ElevationProfile({
  view,
  profiles: [
    new ElevationProfileLineInput({ color: [245, 203, 66], title: "Bicycle track" }),
  ],
  visibleElements: {
    selectButton: false,
    sketchButton: false,
    settingsButton: false,
  },
});

view.ui.add(elevationProfile, "top-right");

(async () => {
  // read the gpx file and convert it to geojson
  const response = await fetch("./cycling.gpx");
  const gpxcontent = await response.text();
  const geojson = gpx(new DOMParser().parseFromString(gpxcontent, "text/xml"));
  const heartRates = geojson.features[0].properties.coordinateProperties.heart;
  const coordinates = geojson.features[0].geometry.coordinates;

  // add the track as an input for the ElevationProfile widget
  const geometry = new Polyline({
    paths: [coordinates],
    hasZ: true
  });
  elevationProfile.input = new Graphic({ geometry: geometry });

  // add the bike track layer
  const bikeTrackLayer = new GraphicsLayer({
    elevationInfo: {
      mode: "relative-to-ground",
      featureExpressionInfo: {
        expression: "5"
      }
    },
    listMode: "hide",
    copyright: "Bicycle track provided by Hugo Campos"
  });

  const bikeTrack = new Graphic({
    geometry: geometry,
    symbol: new LineSymbol3D({
      symbolLayers: [new LineSymbol3DLayer({
        material: { color: [245, 203, 66] },
        size: 3
      })]
    })
  });
  bikeTrackLayer.add(bikeTrack);

  // create a second layer of the bike track
  // displaying the heart rate on each segment
  const source = [];
  // here we sample every second point to get better performance
  for (let i = 0; i < coordinates.length - 2; i+=2) {
    const point1 = coordinates[i];
    const point2 = coordinates[i+2];
    const heart1 = heartRates[i];
    const heart2 = heartRates[i+2];
    const id = i;
    source.push(getPolyline({
      point1,
      point2,
      heart1,
      heart2,
      id
    }));
  }

  const heartRateLayer = new FeatureLayer({
    source: source,
    objectIdField: "ObjectID",
    title: "Bicycle track visualized by heart rate",
    copyright: "Bicycle track provided by Hugo Campos",
    fields: [{
      name: "ObjectID",
      alias: "ObjectID",
      type: "oid"
    }, {
      name: "heartRate",
      alias: "heartRate",
      type: "double"
    }],
    elevationInfo: {
      mode: "relative-to-ground",
      featureExpressionInfo: {
        expression: "5"
      }
    },
    visible: false,
    renderer: {
      type: "simple",
      symbol: new LineSymbol3D({
        symbolLayers: [new LineSymbol3DLayer({
          material: { color: "white" },
          size: 3,
          join: "round",
          cap: "round"
        })]
      }),
      visualVariables: [{
        type: "color",
        field: "heartRate",
        legendOptions: {
          title: "Heart rate in bpm"
        },
        stops: [
          { value: 130, color:  [255, 208, 0] , label: "<= 130bpm" },
          { value: 190, color:  [255, 60, 0] , label: ">= 190bpm" }
        ]
      }]
    }
  });

  // create a point layer showing the start and the end points of the track
  const start = coordinates[0];
  const startPoint = {
    geometry: new Point({
      x: start[0],
      y: start[1],
      z: start[2]
    }),
    attributes: {
      ObjectID: 1,
      type: "start"
    }

  };
  const end = coordinates[coordinates.length - 1];
  const endPoint = {
    geometry: new Point({
      x: end[0],
      y: end[1],
      z: end[2]
    }),
    attributes: {
      ObjectID: 2,
      type: "end"
    }
  };

  const pointsLayer = new FeatureLayer({
    source: [startPoint, endPoint],
    objectIdField: "ObjectID",
    title: "Start & arrival points",
    fields: [{
      name: "ObjectID",
      alias: "ObjectID",
      type: "oid"
    }, {
      name: "type",
      alias: "type",
      type: "string"
    }],
    renderer: {
      type: "unique-value",
      field: "type",
      uniqueValueInfos: [{
        value: "start",
        symbol: getPointSymbol([108, 235, 184]),
        label: "Start point"
      }, {
        value: "end",
        symbol: getPointSymbol([168, 8, 8]),
        label: "Arrival point"
      }],
      legendOptions: {
        title: " "
      }
    }
  });

  map.addMany([bikeTrackLayer, pointsLayer, heartRateLayer]);

  const layerList = new LayerList({
    view: view,
    // display the legend of the layers in the layer list
    listItemCreatedFunction: function(event){
      const item = event.item;
      if (item.layer.title === "Bicycle track visualized by heart rate") {
        item.watch("visible", function(value) {
          bikeTrackLayer.visible = !value;
        });
      }
      item.panel = {
        content: "legend"
      };
    }
  });

  view.ui.add(layerList, "top-right");

})();

function getPolyline(values) {
  const {point1, point2, heart1, heart2, id} = values;
  const avgHeartRate = (heart1 + heart2)/2;
  return {
    geometry: new Polyline({
      paths: [[point1, point2]],
      hasZ: true
    }),
    attributes: {
      ObjectId: id,
      heartRate: avgHeartRate
    }
  };
}

function getPointSymbol(color) {
  return new PointSymbol3D({
    symbolLayers: [new IconSymbol3DLayer({
      resource: { primitive: "circle"},
      material: { color: color },
      outline: {
        color: [255, 255, 255, 1],
        size: 1.5
      },
      size: 10
    })],
    verticalOffset: {
      screenLength: 40,
      maxWorldLength: 200,
      minWorldLength: 20
    },
    callout: {
      type: "line",
      size: 1.5,
      color: [255, 255, 255, 1],
      border: {
        color: [0, 0, 0, 0]
      }
    }
  });
}
