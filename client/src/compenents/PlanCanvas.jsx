import { useMemo } from "react";
import { useEditorStore } from "../store/editorStore";

function layerMapFromArray(layers) {
  return new Map(layers.map((layer) => [layer.id, layer]));
}

function isEntityVisible(entity, layerMap) {
  const layer = layerMap.get(entity.layerId);
  return layer && layer.visible;
}

function getSortedVisibleEntities(entities, layers) {
  const map = layerMapFromArray(layers);

  return [...entities]
    .filter((entity) => isEntityVisible(entity, map))
    .sort((a, b) => {
      const layerA = map.get(a.layerId);
      const layerB = map.get(b.layerId);
      return (layerA?.zIndex ?? 0) - (layerB?.zIndex ?? 0);
    });
}

function Wall({ entity, opacity, selected, onSelect }) {
  return (
    <line
      x1={entity.x1}
      y1={entity.y1}
      x2={entity.x2}
      y2={entity.y2}
      stroke={selected ? "#4ade80" : "#ffffff"}
      strokeWidth={entity.thickness}
      strokeLinecap="square"
      opacity={opacity}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(entity.id);
      }}
    />
  );
}

function TextEntity({ entity, opacity, selected, onSelect }) {
  return (
    <text
      x={entity.x}
      y={entity.y}
      fill={selected ? "#4ade80" : "#ffffff"}
      fontSize="18"
      opacity={opacity}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(entity.id);
      }}
    >
      {entity.text}
    </text>
  );
}

function ImageEntity({ entity, opacity, onSelect }) {
  if (!entity.src) {
    return (
      <rect
        x={entity.x}
        y={entity.y}
        width={entity.width}
        height={entity.height}
        fill="#222"
        stroke="#666"
        strokeDasharray="8 6"
        opacity={opacity}
        onMouseDown={(e) => {
          e.stopPropagation();
          onSelect(entity.id);
        }}
      />
    );
  }

  return (
    <image
      href={entity.src}
      x={entity.x}
      y={entity.y}
      width={entity.width}
      height={entity.height}
      opacity={opacity}
      preserveAspectRatio="none"
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(entity.id);
      }}
    />
  );
}

export default function PlanCanvas() {
  const layers = useEditorStore((s) => s.layers);
  const entities = useEditorStore((s) => s.entities);
  const selectedEntityId = useEditorStore((s) => s.selectedEntityId);
  const selectEntity = useEditorStore((s) => s.selectEntity);

  const visibleEntities = useMemo(
    () => getSortedVisibleEntities(entities, layers),
    [entities, layers]
  );

  const map = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background:
          "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1400 900"
        onMouseDown={() => selectEntity(null)}
      >
        {visibleEntities.map((entity) => {
          const layer = map.get(entity.layerId);
          const opacity = layer?.opacity ?? 1;
          const selected = selectedEntityId === entity.id;

          if (entity.type === "wall") {
            return (
              <Wall
                key={entity.id}
                entity={entity}
                opacity={opacity}
                selected={selected}
                onSelect={selectEntity}
              />
            );
          }

          if (entity.type === "text") {
            return (
              <TextEntity
                key={entity.id}
                entity={entity}
                opacity={opacity}
                selected={selected}
                onSelect={selectEntity}
              />
            );
          }

          if (entity.type === "image") {
            return (
              <ImageEntity
                key={entity.id}
                entity={entity}
                opacity={opacity}
                onSelect={selectEntity}
              />
            );
          }

          return null;
        })}
      </svg>
    </div>
  );
}