import { useRef } from "react";
import { useEditorStore } from "../store/editorStore";

export default function LayersPanel() {
  const fileInputRef = useRef(null);

  const layers = useEditorStore((s) => [...s.layers].sort((a, b) => b.zIndex - a.zIndex));
  const activeLayerId = useEditorStore((s) => s.activeLayerId);
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer);
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility);
  const toggleLayerLock = useEditorStore((s) => s.toggleLayerLock);
  const setLayerOpacity = useEditorStore((s) => s.setLayerOpacity);
  const moveLayerUp = useEditorStore((s) => s.moveLayerUp);
  const moveLayerDown = useEditorStore((s) => s.moveLayerDown);
  const addReferenceImage = useEditorStore((s) => s.addReferenceImage);

  function onPickReference() {
    fileInputRef.current?.click();
  }

  function onFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      addReferenceImage(reader.result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      style={{
        width: 360,
        background: "#111",
        color: "#fff",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        padding: 16,
        overflow: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
        <strong>Layers</strong>
        <button onClick={onPickReference}>Importer plan</button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {layers.map((layer) => (
        <div
          key={layer.id}
          style={{
            border: activeLayerId === layer.id ? "1px solid #4ade80" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: 12,
            marginBottom: 10,
            background: "#181818",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <button onClick={() => setActiveLayer(layer.id)}>{layer.name}</button>

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => moveLayerUp(layer.id)}>↑</button>
              <button onClick={() => moveLayerDown(layer.id)}>↓</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => toggleLayerVisibility(layer.id)}>
              {layer.visible ? "Masquer" : "Afficher"}
            </button>

            <button onClick={() => toggleLayerLock(layer.id)}>
              {layer.locked ? "Déverrouiller" : "Verrouiller"}
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", marginBottom: 6 }}>
              Opacité: {Math.round(layer.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={layer.opacity}
              onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
            z-index: {layer.zIndex}
          </div>
        </div>
      ))}
    </div>
  );
}