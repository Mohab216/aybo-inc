export const LayerKinds = {
  REFERENCE: "reference",
  WALLS: "walls",
  OPENINGS: "openings",
  FURNITURE: "furniture",
  DIMENSIONS: "dimensions",
  ANNOTATIONS: "annotations",
};

export function createDefaultLayers() {
  return [
    {
      id: "layer-reference",
      name: "Reference",
      kind: LayerKinds.REFERENCE,
      visible: true,
      locked: false,
      opacity: 0.45,
      zIndex: 0,
    },
    {
      id: "layer-walls",
      name: "Walls",
      kind: LayerKinds.WALLS,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 10,
    },
    {
      id: "layer-openings",
      name: "Openings",
      kind: LayerKinds.OPENINGS,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 20,
    },
    {
      id: "layer-furniture",
      name: "Furniture",
      kind: LayerKinds.FURNITURE,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 30,
    },
    {
      id: "layer-dimensions",
      name: "Dimensions",
      kind: LayerKinds.DIMENSIONS,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 40,
    },
    {
      id: "layer-annotations",
      name: "Annotations",
      kind: LayerKinds.ANNOTATIONS,
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 50,
    },
  ];
}