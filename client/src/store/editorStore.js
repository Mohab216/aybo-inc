import { create } from "zustand";
import { createDefaultLayers } from "../types/editor";

export const useEditorStore = create((set, get) => ({
  zoom: 1,
  offset: { x: 0, y: 0 },

  layers: createDefaultLayers(),

  entities: [
    {
      id: "ref-1",
      type: "image",
      layerId: "layer-reference",
      x: 80,
      y: 60,
      width: 900,
      height: 600,
      rotation: 0,
      src: "",
      locked: false,
    },
    {
      id: "wall-1",
      type: "wall",
      layerId: "layer-walls",
      x1: 180,
      y1: 140,
      x2: 650,
      y2: 140,
      thickness: 18,
      locked: false,
    },
    {
      id: "wall-2",
      type: "wall",
      layerId: "layer-walls",
      x1: 650,
      y1: 140,
      x2: 650,
      y2: 420,
      thickness: 18,
      locked: false,
    },
    {
      id: "note-1",
      type: "text",
      layerId: "layer-annotations",
      x: 220,
      y: 120,
      text: "Entrée principale",
      locked: false,
    },
  ],

  selectedEntityId: null,
  activeLayerId: "layer-walls",

  setActiveLayer(id) {
    set({ activeLayerId: id });
  },

  selectEntity(id) {
    set({ selectedEntityId: id });
  },

  toggleLayerVisibility(layerId) {
    set({
      layers: get().layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      ),
    });
  },

  toggleLayerLock(layerId) {
    set({
      layers: get().layers.map((layer) =>
        layer.id === layerId ? { ...layer, locked: !layer.locked } : layer
      ),
    });
  },

  setLayerOpacity(layerId, opacity) {
    set({
      layers: get().layers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      ),
    });
  },

  moveLayerUp(layerId) {
    const layers = [...get().layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = layers.findIndex((l) => l.id === layerId);
    if (index === -1 || index === layers.length - 1) return;

    const current = layers[index];
    const next = layers[index + 1];

    const updated = layers.map((layer) => {
      if (layer.id === current.id) return { ...layer, zIndex: next.zIndex };
      if (layer.id === next.id) return { ...layer, zIndex: current.zIndex };
      return layer;
    });

    set({ layers: updated });
  },

  moveLayerDown(layerId) {
    const layers = [...get().layers].sort((a, b) => a.zIndex - b.zIndex);
    const index = layers.findIndex((l) => l.id === layerId);
    if (index <= 0) return;

    const current = layers[index];
    const previous = layers[index - 1];

    const updated = layers.map((layer) => {
      if (layer.id === current.id) return { ...layer, zIndex: previous.zIndex };
      if (layer.id === previous.id) return { ...layer, zIndex: current.zIndex };
      return layer;
    });

    set({ layers: updated });
  },

  updateEntity(entityId, patch) {
    set({
      entities: get().entities.map((entity) =>
        entity.id === entityId ? { ...entity, ...patch } : entity
      ),
    });
  },

  addReferenceImage(src) {
    set({
      entities: [
        ...get().entities,
        {
          id: `ref-${Date.now()}`,
          type: "image",
          layerId: "layer-reference",
          x: 100,
          y: 100,
          width: 900,
          height: 600,
          rotation: 0,
          src,
          locked: false,
        },
      ],
    });
  },
}));