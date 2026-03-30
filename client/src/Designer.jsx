import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const GRID_SIZE = 20;
const CELL_SIZE = 28;
const WALL_HEIGHT = 3;
const WALL_THICKNESS = 0.18;
const MINIMAP_SIZE = 220;
const STORAGE_KEY = "aybo-designer-state-v5";

const COLORS = [
  "#ffffff",
  "#000000",
  "#ef4444",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#6b7280",
  "#7c2d12",
  "#a16207",
  "#0f766e",
  "#1d4ed8"
];

const ROOM_TYPES = [
  { id: "living", label: "Living Room", color: "#dbeafe" },
  { id: "kitchen", label: "Kitchen", color: "#fef3c7" },
  { id: "bedroom", label: "Bedroom", color: "#ede9fe" },
  { id: "bathroom", label: "Bathroom", color: "#cffafe" },
  { id: "office", label: "Office", color: "#dcfce7" }
];

const FURNITURE_TYPES = [
  { id: "door", label: "Door", defaultColor: "#7c2d12", category: "openings" },
  { id: "window", label: "Window", defaultColor: "#93c5fd", category: "openings" },
  { id: "chair", label: "Chair", defaultColor: "#6b7280", category: "seating" },
  { id: "table", label: "Table", defaultColor: "#a16207", category: "tables" },
  { id: "sofa", label: "Sofa", defaultColor: "#14b8a6", category: "seating" },
  { id: "bed", label: "Bed", defaultColor: "#8b5cf6", category: "bedroom" },
  { id: "desk", label: "Desk", defaultColor: "#92400e", category: "office" },
  { id: "lamp", label: "Lamp", defaultColor: "#facc15", category: "decor" },
  { id: "plant", label: "Plant", defaultColor: "#22c55e", category: "decor" },
  { id: "kitchenUnit", label: "Kitchen Unit", defaultColor: "#475569", category: "kitchen" },
  { id: "wardrobe", label: "Wardrobe", defaultColor: "#78716c", category: "bedroom" },
  { id: "tv", label: "TV", defaultColor: "#111827", category: "living" },
  { id: "coffeeTable", label: "Coffee Table", defaultColor: "#92400e", category: "tables" },
  { id: "nightstand", label: "Nightstand", defaultColor: "#78716c", category: "bedroom" },
  { id: "bookshelf", label: "Bookshelf", defaultColor: "#a16207", category: "office" }
];

function makeEmptyGrid() {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({
      type: "empty",
      color: null,
      room: null
    }))
  );
}

function getFurnitureConfig(type) {
  switch (type) {
    case "door":
      return { size2D: "D", box: [0.8, 2.2, 0.12], y: 1.1 };
    case "window":
      return { size2D: "W", box: [1, 1, 0.08], y: 1.6 };
    case "chair":
      return { size2D: "C", box: [0.5, 0.8, 0.5], y: 0.4 };
    case "table":
      return { size2D: "T", box: [1, 0.6, 1], y: 0.3 };
    case "sofa":
      return { size2D: "S", box: [1.4, 0.7, 0.8], y: 0.35 };
    case "bed":
      return { size2D: "B", box: [1.7, 0.5, 2.2], y: 0.25 };
    case "desk":
      return { size2D: "DK", box: [1.2, 0.75, 0.6], y: 0.375 };
    case "lamp":
      return { size2D: "L", box: [0.25, 1.6, 0.25], y: 0.8 };
    case "plant":
      return { size2D: "P", box: [0.5, 0.8, 0.5], y: 0.4 };
    case "kitchenUnit":
      return { size2D: "K", box: [1.8, 0.9, 0.7], y: 0.45 };
    case "wardrobe":
      return { size2D: "WR", box: [1.2, 2.2, 0.7], y: 1.1 };
    case "tv":
      return { size2D: "TV", box: [1.2, 0.8, 0.12], y: 0.4 };
    case "coffeeTable":
      return { size2D: "CT", box: [1.1, 0.4, 0.7], y: 0.2 };
    case "nightstand":
      return { size2D: "N", box: [0.55, 0.55, 0.45], y: 0.275 };
    case "bookshelf":
      return { size2D: "BS", box: [1, 1.8, 0.35], y: 0.9 };
    default:
      return { size2D: "?", box: [1, 1, 1], y: 0.5 };
  }
}

function buildFurnitureMesh(item) {
  const color = item.color || "#ffffff";
  const mat = new THREE.MeshLambertMaterial({ color });

  switch (item.type) {
    case "lamp": {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.08, 16), mat);
      base.position.y = 0.04;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1, 12), mat);
      pole.position.y = 0.63;
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 0.35, 16), mat);
      shade.position.y = 1.35;
      group.add(base, pole, shade);
      return { mesh: group, y: 0 };
    }

    case "plant": {
      const group = new THREE.Group();
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.24, 0.28, 16),
        new THREE.MeshLambertMaterial({ color: "#92400e" })
      );
      pot.position.y = 0.14;

      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 16, 16),
        new THREE.MeshLambertMaterial({ color })
      );
      leaves.position.y = 0.52;
      group.add(pot, leaves);
      return { mesh: group, y: 0 };
    }

    default: {
      const config = getFurnitureConfig(item.type);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...config.box), mat);
      return { mesh, y: config.y };
    }
  }
}

function roomColor(roomId) {
  return ROOM_TYPES.find((r) => r.id === roomId)?.color || null;
}

function roomLabel(roomId) {
  return ROOM_TYPES.find((r) => r.id === roomId)?.label || "";
}

function isWallCell(grid, row, col) {
  if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return false;
  return grid[row][col].type === "wall";
}

function nearestWallRotation(grid, row, col) {
  if (isWallCell(grid, row, col - 1) || isWallCell(grid, row, col + 1)) return Math.PI / 2;
  if (isWallCell(grid, row - 1, col) || isWallCell(grid, row + 1, col)) return 0;
  return 0;
}

function computeRoomCenters(grid) {
  const centers = {};
  const counts = {};

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const room = grid[r][c].room;
      if (!room) continue;
      if (!centers[room]) {
        centers[room] = { row: 0, col: 0 };
        counts[room] = 0;
      }
      centers[room].row += r;
      centers[room].col += c;
      counts[room] += 1;
    }
  }

  const result = {};
  Object.keys(centers).forEach((room) => {
    result[room] = {
      row: centers[room].row / counts[room],
      col: centers[room].col / counts[room]
    };
  });

  return result;
}

function buildWallSegments(grid) {
  const segments = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = grid[r][c];
      if (cell.type !== "wall") continue;

      const hasLeft = isWallCell(grid, r, c - 1);
      const hasRight = isWallCell(grid, r, c + 1);
      const hasTop = isWallCell(grid, r - 1, c);
      const hasBottom = isWallCell(grid, r + 1, c);

      const horizontal = hasLeft || hasRight;
      const vertical = hasTop || hasBottom;

      if (horizontal && !vertical) {
        segments.push({
          x: c + 0.5,
          y: WALL_HEIGHT / 2,
          z: r + 0.5,
          w: 1,
          h: WALL_HEIGHT,
          d: WALL_THICKNESS,
          color: cell.color || "#ffffff"
        });
      } else if (vertical && !horizontal) {
        segments.push({
          x: c + 0.5,
          y: WALL_HEIGHT / 2,
          z: r + 0.5,
          w: WALL_THICKNESS,
          h: WALL_HEIGHT,
          d: 1,
          color: cell.color || "#ffffff"
        });
      } else {
        segments.push({
          x: c + 0.5,
          y: WALL_HEIGHT / 2,
          z: r + 0.5,
          w: 1,
          h: WALL_HEIGHT,
          d: 1,
          color: cell.color || "#ffffff"
        });
      }
    }
  }

  return segments;
}

export default function Designer() {
  const mountRef = useRef(null);
  const minimapCanvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const keysRef = useRef({});
  const isLockedRef = useRef(false);
  const animIdRef = useRef(null);
  const cameraRef = useRef(null);

  const [mode, setMode] = useState("2d");
  const [cameraMode, setCameraMode] = useState("orbit");
  const [tool, setTool] = useState("wall");
  const [activeColor, setActiveColor] = useState("#ffffff");
  const [activeRoom, setActiveRoom] = useState("living");
  const [grid, setGrid] = useState(makeEmptyGrid());
  const [furniture, setFurniture] = useState([]);
  const [drawing, setDrawing] = useState(false);
  const [startCell, setStartCell] = useState(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [draggingFurnitureId, setDraggingFurnitureId] = useState(null);
  const [status, setStatus] = useState("Choose a tool, then build your space.");
  const [projectName, setProjectName] = useState("Untitled Project");

  const selectedFurniture = useMemo(
    () => furniture.find((item) => item.id === selectedFurnitureId) || null,
    [furniture, selectedFurnitureId]
  );

  const groupedFurniture = useMemo(() => {
    const groups = {};
    for (const item of FURNITURE_TYPES) {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    }
    return groups;
  }, []);

  const roomCenters = useMemo(() => computeRoomCenters(grid), [grid]);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (parsed.grid) setGrid(parsed.grid);
      if (parsed.furniture) setFurniture(parsed.furniture);
      if (parsed.projectName) setProjectName(parsed.projectName);
      setStatus("Saved project loaded.");
    } catch {
      setStatus("Could not load saved project.");
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!selectedFurnitureId) return;
      if (e.key.toLowerCase() === "r") rotateSelectedFurniture();
      if (e.key === "Delete" || e.key === "Backspace") deleteSelectedFurniture();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFurnitureId, selectedFurniture]);

  useEffect(() => {
    if (mode !== "3d" || !mountRef.current) return;

    const mount = mountRef.current;
    mount.innerHTML = "";

    const width = mount.clientWidth || window.innerWidth;
    const height = mount.clientHeight || window.innerHeight - 140;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090909);

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(12, 12, 12);
    camera.lookAt(GRID_SIZE / 2, 0, GRID_SIZE / 2);
    camera.rotation.order = "YXZ";
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.72);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(15, 22, 12);
    sun.castShadow = true;
    scene.add(sun);

    const baseFloor = new THREE.Mesh(
      new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE),
      new THREE.MeshLambertMaterial({ color: 0xd6d0c4 })
    );
    baseFloor.rotation.x = -Math.PI / 2;
    baseFloor.position.set(GRID_SIZE / 2, 0, GRID_SIZE / 2);
    baseFloor.receiveShadow = true;
    scene.add(baseFloor);

    const roomTiles = [];
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const cell = grid[row][col];
        if (cell.room) {
          const tile = new THREE.Mesh(
            new THREE.PlaneGeometry(1, 1),
            new THREE.MeshLambertMaterial({
              color: roomColor(cell.room) || "#ffffff",
              transparent: true,
              opacity: 0.65
            })
          );
          tile.rotation.x = -Math.PI / 2;
          tile.position.set(col + 0.5, 0.02, row + 0.5);
          scene.add(tile);
          roomTiles.push(tile);
        }
      }
    }

    const gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x353535, 0x707070);
    gridHelper.position.set(GRID_SIZE / 2, 0.01, GRID_SIZE / 2);
    scene.add(gridHelper);

    const createdMeshes = [];

    const wallSegments = buildWallSegments(grid);
    wallSegments.forEach((segment) => {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(segment.w, segment.h, segment.d),
        new THREE.MeshLambertMaterial({ color: segment.color })
      );
      wall.position.set(segment.x, segment.y, segment.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      scene.add(wall);
      createdMeshes.push(wall);
    });

    furniture.forEach((item) => {
      const built = buildFurnitureMesh(item);
      built.mesh.position.set(item.col + 0.5, built.y, item.row + 0.5);
      built.mesh.rotation.y = item.rotation || 0;

      built.mesh.traverse?.((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      if (built.mesh.isMesh) {
        built.mesh.castShadow = true;
        built.mesh.receiveShadow = true;
      }

      scene.add(built.mesh);
      createdMeshes.push(built.mesh);
    });

    let orbitYaw = Math.PI / 4;
    let orbitPitch = 0.8;
    let orbitRadius = 18;
    let draggingOrbit = false;
    let fpsYaw = 0;
    let fpsPitch = 0;

    const updateOrbitCamera = () => {
      const target = new THREE.Vector3(GRID_SIZE / 2, 0, GRID_SIZE / 2);
      const x = target.x + orbitRadius * Math.cos(orbitPitch) * Math.sin(orbitYaw);
      const y = target.y + orbitRadius * Math.sin(orbitPitch);
      const z = target.z + orbitRadius * Math.cos(orbitPitch) * Math.cos(orbitYaw);
      camera.position.set(x, y, z);
      camera.lookAt(target);
    };

    updateOrbitCamera();

    const onCanvasClick = () => {
      if (cameraMode === "fps") {
        renderer.domElement.requestPointerLock();
      }
    };

    const onPointerLockChange = () => {
      isLockedRef.current = document.pointerLockElement === renderer.domElement;
      if (cameraMode === "fps") {
        setStatus(
          isLockedRef.current
            ? "FPS active — WASD move, E/Space up, Q/Shift down, ESC exit."
            : "Click inside the 3D view to activate FPS."
        );
      }
    };

    const onMouseMove = (e) => {
      if (cameraMode === "fps" && isLockedRef.current) {
        fpsYaw -= e.movementX * 0.002;
        fpsPitch -= e.movementY * 0.002;
        fpsPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, fpsPitch));
        camera.rotation.y = fpsYaw;
        camera.rotation.x = fpsPitch;
        return;
      }

      if (cameraMode === "orbit" && draggingOrbit) {
        orbitYaw -= e.movementX * 0.004;
        orbitPitch -= e.movementY * 0.004;
        orbitPitch = Math.max(0.15, Math.min(1.4, orbitPitch));
        updateOrbitCamera();
      }
    };

    const onMouseDown = () => {
      if (cameraMode === "orbit") draggingOrbit = true;
    };

    const onMouseUp = () => {
      draggingOrbit = false;
    };

    const onWheel = (e) => {
      if (cameraMode !== "orbit") return;
      orbitRadius += e.deltaY * 0.01;
      orbitRadius = Math.max(6, Math.min(36, orbitRadius));
      updateOrbitCamera();
    };

    const onKeyDown = (e) => {
      keysRef.current[e.code] = true;
    };

    const onKeyUp = (e) => {
      keysRef.current[e.code] = false;
    };

    const onResize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight - 140;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    renderer.domElement.addEventListener("click", onCanvasClick);
    renderer.domElement.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });
    document.addEventListener("pointerlockchange", onPointerLockChange);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();

    const drawMinimap = () => {
      const canvas = minimapCanvasRef.current;
      if (!canvas || !cameraRef.current) return;

      const ctx = canvas.getContext("2d");
      const scale = MINIMAP_SIZE / GRID_SIZE;

      ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
      ctx.fillStyle = "#0f0f0f";
      ctx.fillRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          const cell = grid[r][c];

          if (cell.room) {
            ctx.fillStyle = roomColor(cell.room) || "#222";
            ctx.fillRect(c * scale, r * scale, scale, scale);
          }

          ctx.strokeStyle = "#252525";
          ctx.strokeRect(c * scale, r * scale, scale, scale);

          if (cell.type === "wall") {
            ctx.fillStyle = cell.color || "#ffffff";
            ctx.fillRect(c * scale, r * scale, scale, scale);
          }
        }
      }

      furniture.forEach((item) => {
        ctx.fillStyle = item.color || "#5E8B4A";
        ctx.fillRect(
          item.col * scale + scale * 0.2,
          item.row * scale + scale * 0.2,
          scale * 0.6,
          scale * 0.6
        );

        if (item.id === selectedFurnitureId) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            item.col * scale + scale * 0.15,
            item.row * scale + scale * 0.15,
            scale * 0.7,
            scale * 0.7
          );
        }
      });

      const camX = cameraRef.current.position.x * scale;
      const camZ = cameraRef.current.position.z * scale;

      ctx.fillStyle = "#5E8B4A";
      ctx.beginPath();
      ctx.arc(camX, camZ, 5, 0, Math.PI * 2);
      ctx.fill();

      const angle =
        cameraMode === "fps" ? camera.rotation.y : Math.atan2(
          GRID_SIZE / 2 - camera.position.x,
          GRID_SIZE / 2 - camera.position.z
        );

      const dirLength = 18;
      const endX = camX - Math.sin(angle) * dirLength;
      const endY = camZ - Math.cos(angle) * dirLength;

      ctx.strokeStyle = "#7A5230";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(camX, camZ);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    };

    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);

      if (cameraMode === "fps" && isLockedRef.current) {
        const delta = clock.getDelta();
        const speed = 4;
        const verticalSpeed = 4;
        const move = new THREE.Vector3();

        if (keysRef.current["KeyW"]) move.z -= 1;
        if (keysRef.current["KeyS"]) move.z += 1;
        if (keysRef.current["KeyA"]) move.x -= 1;
        if (keysRef.current["KeyD"]) move.x += 1;

        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(speed * delta);
          move.applyAxisAngle(new THREE.Vector3(0, 1, 0), camera.rotation.y);
          camera.position.add(move);
        }

        if (keysRef.current["KeyE"] || keysRef.current["Space"]) {
          camera.position.y += verticalSpeed * delta;
        }

        if (keysRef.current["KeyQ"] || keysRef.current["ShiftLeft"]) {
          camera.position.y -= verticalSpeed * delta;
        }

        if (camera.position.y < 0.5) camera.position.y = 0.5;
      }

      renderer.render(scene, camera);
      drawMinimap();
    };

    setStatus(
      cameraMode === "fps"
        ? "Click inside the 3D view to activate FPS."
        : "Orbit mode active — drag to rotate, wheel to zoom."
    );
    animate();

    return () => {
      cancelAnimationFrame(animIdRef.current);
      renderer.domElement.removeEventListener("click", onCanvasClick);
      renderer.domElement.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      document.removeEventListener("pointerlockchange", onPointerLockChange);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);

      if (document.pointerLockElement === renderer.domElement) {
        document.exitPointerLock();
      }

      createdMeshes.forEach((mesh) => {
        mesh.traverse?.((child) => {
          if (child.isMesh) {
            child.geometry.dispose?.();
            child.material.dispose?.();
          }
        });

        if (mesh.isMesh) {
          mesh.geometry.dispose?.();
          mesh.material.dispose?.();
        }

        scene.remove(mesh);
      });

      roomTiles.forEach((tile) => {
        tile.geometry.dispose();
        tile.material.dispose();
        scene.remove(tile);
      });

      baseFloor.geometry.dispose();
      baseFloor.material.dispose();
      renderer.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [mode, grid, furniture, selectedFurnitureId, cameraMode]);

  const getCellFromMouse = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const row = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    return { row, col };
  };

  const drawLine = (currentGrid, start, end) => {
    const newGrid = currentGrid.map((r) => [...r]);

    let x0 = start.col;
    let y0 = start.row;
    const x1 = end.col;
    const y1 = end.row;

    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      if (y0 >= 0 && y0 < GRID_SIZE && x0 >= 0 && x0 < GRID_SIZE) {
        if (tool === "eraser") {
          newGrid[y0][x0] = { ...newGrid[y0][x0], type: "empty", color: null, room: null };
        } else if (tool === "wall") {
          newGrid[y0][x0] = {
            ...newGrid[y0][x0],
            type: "wall",
            color: activeColor
          };
        } else if (tool === "paintRoom") {
          newGrid[y0][x0] = {
            ...newGrid[y0][x0],
            room: activeRoom
          };
        }
      }

      if (x0 === x1 && y0 === y1) break;

      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }

    return newGrid;
  };

  const placeFurniture = (row, col, type) => {
    const existing = furniture.find((item) => item.row === row && item.col === col);
    const defaultColor =
      FURNITURE_TYPES.find((f) => f.id === type)?.defaultColor || activeColor;

    const computedRotation =
      type === "door" || type === "window"
        ? nearestWallRotation(grid, row, col)
        : existing?.rotation || 0;

    const nextItem = {
      id: existing?.id || `${type}-${Date.now()}-${Math.random()}`,
      row,
      col,
      type,
      color: activeColor || defaultColor,
      rotation: computedRotation
    };

    setFurniture((prev) => {
      const filtered = prev.filter((item) => !(item.row === row && item.col === col));
      return [...filtered, nextItem];
    });

    setSelectedFurnitureId(nextItem.id);
  };

  const eraseAt = (row, col) => {
    setGrid((prev) => {
      const next = prev.map((r) => [...r]);
      next[row][col] = { ...next[row][col], type: "empty", color: null, room: null };
      return next;
    });

    setFurniture((prev) => prev.filter((item) => !(item.row === row && item.col === col)));
  };

  const handleMouseDown = (e) => {
    const cell = getCellFromMouse(e);
    const existing = furniture.find((item) => item.row === cell.row && item.col === cell.col);

    if (existing && tool === "select") {
      setSelectedFurnitureId(existing.id);
      setDraggingFurnitureId(existing.id);
      setStatus(`${existing.type} selected for dragging.`);
      return;
    }

    if (tool === "wall" || tool === "eraser" || tool === "paintRoom") {
      setDrawing(true);
      setStartCell(cell);
      return;
    }

    if (FURNITURE_TYPES.some((f) => f.id === tool)) {
      placeFurniture(cell.row, cell.col, tool);
      setStatus(`${tool} placed.`);
      return;
    }

    if (existing) {
      setSelectedFurnitureId(existing.id);
      setStatus(`${existing.type} selected.`);
    }
  };

  const handleMouseEnterCell = (row, col) => {
    if (!draggingFurnitureId) return;

    setFurniture((prev) =>
      prev.map((item) =>
        item.id === draggingFurnitureId ? { ...item, row, col } : item
      )
    );
  };

  const handleMouseUp = (e) => {
    if (draggingFurnitureId) {
      setDraggingFurnitureId(null);
      setStatus("Furniture moved.");
      return;
    }

    if (!drawing || !startCell) return;

    const endCell = getCellFromMouse(e);

    if (tool === "eraser" || tool === "wall" || tool === "paintRoom") {
      setGrid((prev) => drawLine(prev, startCell, endCell));
    }

    if (tool === "eraser") {
      const minRow = Math.min(startCell.row, endCell.row);
      const maxRow = Math.max(startCell.row, endCell.row);
      const minCol = Math.min(startCell.col, endCell.col);
      const maxCol = Math.max(startCell.col, endCell.col);

      setFurniture((prev) =>
        prev.filter(
          (item) =>
            !(
              item.row >= minRow &&
              item.row <= maxRow &&
              item.col >= minCol &&
              item.col <= maxCol
            )
        )
      );
    }

    setDrawing(false);
    setStartCell(null);
  };

  const clearAll = () => {
    setGrid(makeEmptyGrid());
    setFurniture([]);
    setSelectedFurnitureId(null);
    setStatus("Project cleared.");
  };

  const saveProject = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectName,
        grid,
        furniture
      })
    );
    setStatus("Project saved locally.");
  };

  const loadProject = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setStatus("No saved project found.");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.grid) setGrid(parsed.grid);
      if (parsed.furniture) setFurniture(parsed.furniture);
      if (parsed.projectName) setProjectName(parsed.projectName);
      setStatus("Project loaded.");
    } catch {
      setStatus("Load failed.");
    }
  };

  const exportProject = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            projectName,
            grid,
            furniture
          },
          null,
          2
        )
      ],
      { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "aybo-project"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Project exported.");
  };

  const importProject = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.grid) setGrid(parsed.grid);
      if (parsed.furniture) setFurniture(parsed.furniture);
      if (parsed.projectName) setProjectName(parsed.projectName);
      setStatus("Project imported.");
    } catch {
      setStatus("Import failed.");
    }

    event.target.value = "";
  };

  const moveSelectedFurniture = (dRow, dCol) => {
    if (!selectedFurniture) return;

    const nextRow = selectedFurniture.row + dRow;
    const nextCol = selectedFurniture.col + dCol;

    if (
      nextRow < 0 ||
      nextRow >= GRID_SIZE ||
      nextCol < 0 ||
      nextCol >= GRID_SIZE
    ) {
      return;
    }

    setFurniture((prev) =>
      prev.map((item) =>
        item.id === selectedFurniture.id
          ? { ...item, row: nextRow, col: nextCol }
          : item
      )
    );
  };

  function rotateSelectedFurniture() {
    if (!selectedFurniture) return;
    setFurniture((prev) =>
      prev.map((item) =>
        item.id === selectedFurniture.id
          ? { ...item, rotation: (item.rotation || 0) + Math.PI / 2 }
          : item
      )
    );
  }

  const recolorSelectedFurniture = () => {
    if (!selectedFurniture) return;
    setFurniture((prev) =>
      prev.map((item) =>
        item.id === selectedFurniture.id
          ? { ...item, color: activeColor }
          : item
      )
    );
  };

  function deleteSelectedFurniture() {
    if (!selectedFurniture) return;
    setFurniture((prev) => prev.filter((item) => item.id !== selectedFurniture.id));
    setSelectedFurnitureId(null);
  }

  const wallCount = grid.flat().filter((cell) => cell.type === "wall").length;
  const furnitureCount = furniture.length;
  const roomCount = new Set(grid.flat().map((c) => c.room).filter(Boolean)).size;

  return (
    <div
      style={{
        minHeight: "calc(100vh - 80px)",
        background: "linear-gradient(180deg, #050505 0%, #0d0d0d 100%)",
        color: "white",
        padding: 20
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={importProject}
      />

      <div
        style={{
          maxWidth: 1600,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "320px 1fr 300px",
          gap: 18
        }}
      >
        <aside style={panelStyle}>
          <SectionTitle>PROJECT</SectionTitle>
          <div style={{ marginBottom: 20 }}>
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name"
              style={inputStyle}
            />
          </div>

          <SectionTitle>VIEW</SectionTitle>
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <button onClick={() => setMode("2d")} style={sideButton(mode === "2d")}>
              2D Plan
            </button>
            <button onClick={() => setMode("3d")} style={sideButton(mode === "3d")}>
              3D View
            </button>
            {mode === "3d" && (
              <>
                <button
                  onClick={() => setCameraMode("orbit")}
                  style={sideButton(cameraMode === "orbit")}
                >
                  Orbit Camera
                </button>
                <button
                  onClick={() => setCameraMode("fps")}
                  style={sideButton(cameraMode === "fps")}
                >
                  FPS Camera
                </button>
              </>
            )}
          </div>

          <SectionTitle>TOOLS</SectionTitle>
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <button onClick={() => setTool("select")} style={sideButton(tool === "select")}>
              Select / Drag
            </button>
            <button onClick={() => setTool("wall")} style={sideButton(tool === "wall")}>
              Draw Walls
            </button>
            <button
              onClick={() => setTool("paintRoom")}
              style={sideButton(tool === "paintRoom")}
            >
              Paint Room
            </button>
            <button onClick={() => setTool("eraser")} style={sideButton(tool === "eraser")}>
              Eraser
            </button>
          </div>

          <SectionTitle>ROOM TYPES</SectionTitle>
          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            {ROOM_TYPES.map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  setActiveRoom(room.id);
                  setStatus(`${room.label} selected.`);
                }}
                style={{
                  ...sideButton(activeRoom === room.id),
                  display: "flex",
                  alignItems: "center",
                  gap: 10
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: room.color,
                    border: "1px solid rgba(0,0,0,0.2)"
                  }}
                />
                {room.label}
              </button>
            ))}
          </div>

          <SectionTitle>FURNITURE</SectionTitle>
          <div style={{ display: "grid", gap: 14, marginBottom: 20 }}>
            {Object.entries(groupedFurniture).map(([category, items]) => (
              <div key={category}>
                <div
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.45)",
                    marginBottom: 8,
                    textTransform: "uppercase",
                    letterSpacing: "0.1em"
                  }}
                >
                  {category}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8
                  }}
                >
                  {items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setTool(item.id)}
                      style={smallButton(tool === item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <SectionTitle>COLORS</SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 20
            }}
          >
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => {
                  setActiveColor(color);
                  setStatus(`Color selected: ${color}`);
                }}
                title={color}
                style={{
                  width: "100%",
                  aspectRatio: "1 / 1",
                  borderRadius: 12,
                  border:
                    activeColor === color
                      ? "3px solid #5E8B4A"
                      : "1px solid rgba(255,255,255,0.12)",
                  background: color,
                  cursor: "pointer"
                }}
              />
            ))}
          </div>

          <SectionTitle>PROJECT ACTIONS</SectionTitle>
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={saveProject} style={sideButton(false)}>
              Save Local
            </button>
            <button onClick={loadProject} style={sideButton(false)}>
              Load Local
            </button>
            <button onClick={exportProject} style={sideButton(false)}>
              Export JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={sideButton(false)}
            >
              Import JSON
            </button>
            <button onClick={clearAll} style={sideButton(false)}>
              Clear All
            </button>
          </div>
        </aside>

        <main style={{ display: "grid", gap: 18 }}>
          <div style={panelStyle}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
                alignItems: "center"
              }}
            >
              <div>
                <h1 style={{ margin: 0, fontSize: "2rem" }}>{projectName}</h1>
                <p style={{ margin: "8px 0 0 0", color: "rgba(255,255,255,0.65)" }}>
                  {status}
                </p>
              </div>

              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 13,
                  fontWeight: 700
                }}
              >
                {mode === "3d"
                  ? cameraMode === "fps"
                    ? "FPS active"
                    : "Orbit active"
                  : "Plan editing"}
              </div>
            </div>
          </div>

          {mode === "2d" && (
            <div style={{ ...panelStyle, minHeight: 760, overflow: "auto" }}>
              <div
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                style={{
                  display: "inline-grid",
                  gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
                  border: "2px solid rgba(255,255,255,0.08)",
                  userSelect: "none",
                  cursor: "crosshair",
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#111",
                  position: "relative"
                }}
              >
                {grid.map((row, r) =>
                  row.map((cell, c) => {
                    const furnitureItem = furniture.find(
                      (item) => item.row === r && item.col === c
                    );

                    let label = null;
                    if (furnitureItem) label = getFurnitureConfig(furnitureItem.type).size2D;

                    const isSelected = furnitureItem?.id === selectedFurnitureId;
                    const cellBackground =
                      cell.type === "wall"
                        ? cell.color || "#ffffff"
                        : cell.room
                        ? roomColor(cell.room)
                        : "#1b1b1b";

                    const centerMatch = Object.entries(roomCenters).find(
                      ([roomId, center]) =>
                        roomId === cell.room &&
                        Math.round(center.row) === r &&
                        Math.round(center.col) === c
                    );

                    return (
                      <div
                        key={`${r}-${c}`}
                        onClick={() => {
                          if (furnitureItem) {
                            setSelectedFurnitureId(furnitureItem.id);
                            setStatus(`${furnitureItem.type} selected.`);
                          } else if (
                            tool !== "wall" &&
                            tool !== "eraser" &&
                            tool !== "paintRoom" &&
                            tool !== "select"
                          ) {
                            placeFurniture(r, c, tool);
                          }
                        }}
                        onMouseEnter={() => handleMouseEnterCell(r, c)}
                        onDoubleClick={() => {
                          if (tool === "eraser") eraseAt(r, c);
                        }}
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          background: cellBackground,
                          border: isSelected
                            ? "2px solid #5E8B4A"
                            : "1px solid #2c2c2c",
                          boxSizing: "border-box",
                          transition: "0.12s ease",
                          display: "grid",
                          placeItems: "center",
                          color: furnitureItem ? furnitureItem.color || "#fff" : "#fff",
                          fontWeight: 800,
                          fontSize: 10,
                          position: "relative",
                          overflow: "hidden"
                        }}
                      >
                        {centerMatch && !furnitureItem && cell.room && (
                          <span
                            style={{
                              position: "absolute",
                              inset: 2,
                              display: "grid",
                              placeItems: "center",
                              fontSize: 8,
                              color: "#111",
                              fontWeight: 800,
                              textAlign: "center",
                              lineHeight: 1
                            }}
                          >
                            {roomLabel(cell.room)}
                          </span>
                        )}
                        {label}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {mode === "3d" && (
            <div style={{ ...panelStyle, minHeight: 760 }}>
              <div
                ref={mountRef}
                style={{
                  width: "100%",
                  height: "calc(100vh - 220px)",
                  minHeight: 680,
                  borderRadius: 18,
                  overflow: "hidden",
                  background: "#0b0b0b"
                }}
              />
            </div>
          )}
        </main>

        <aside style={panelStyle}>
          <SectionTitle>OVERVIEW</SectionTitle>
          <div style={infoGridStyle}>
            <InfoRow label="Mode" value={mode.toUpperCase()} />
            <InfoRow label="Camera" value={mode === "3d" ? cameraMode.toUpperCase() : "-"} />
            <InfoRow label="Tool" value={tool.toUpperCase()} />
            <InfoRow label="Walls" value={String(wallCount)} />
            <InfoRow label="Furniture" value={String(furnitureCount)} />
            <InfoRow label="Rooms" value={String(roomCount)} />
            <InfoRow label="Color" value={activeColor} />
          </div>

          <div style={{ height: 18 }} />

          <SectionTitle>MINI MAP</SectionTitle>
          <canvas
            ref={minimapCanvasRef}
            width={MINIMAP_SIZE}
            height={MINIMAP_SIZE}
            style={{
              width: "100%",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "#111"
            }}
          />

          <p
            style={{
              margin: "12px 0 18px 0",
              color: "rgba(255,255,255,0.62)",
              fontSize: 13,
              lineHeight: 1.6
            }}
          >
            Green point = camera position. Brown line = direction.
          </p>

          <SectionTitle>SELECTED ITEM</SectionTitle>
          <div style={infoGridStyle}>
            <InfoRow label="Type" value={selectedFurniture?.type || "None"} />
            <InfoRow
              label="Position"
              value={
                selectedFurniture
                  ? `${selectedFurniture.row}, ${selectedFurniture.col}`
                  : "-"
              }
            />
            <InfoRow
              label="Rotation"
              value={
                selectedFurniture
                  ? `${Math.round(((selectedFurniture.rotation || 0) * 180) / Math.PI)}°`
                  : "-"
              }
            />
          </div>

          <div style={{ height: 14 }} />

          <div style={{ display: "grid", gap: 10 }}>
            <button
              onClick={() => moveSelectedFurniture(-1, 0)}
              style={sideButton(false)}
              disabled={!selectedFurniture}
            >
              Move Up
            </button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                onClick={() => moveSelectedFurniture(0, -1)}
                style={sideButton(false)}
                disabled={!selectedFurniture}
              >
                Move Left
              </button>
              <button
                onClick={() => moveSelectedFurniture(0, 1)}
                style={sideButton(false)}
                disabled={!selectedFurniture}
              >
                Move Right
              </button>
            </div>
            <button
              onClick={() => moveSelectedFurniture(1, 0)}
              style={sideButton(false)}
              disabled={!selectedFurniture}
            >
              Move Down
            </button>
            <button
              onClick={rotateSelectedFurniture}
              style={sideButton(false)}
              disabled={!selectedFurniture}
            >
              Rotate 90°
            </button>
            <button
              onClick={recolorSelectedFurniture}
              style={sideButton(false)}
              disabled={!selectedFurniture}
            >
              Apply Active Color
            </button>
            <button
              onClick={deleteSelectedFurniture}
              style={sideButton(false)}
              disabled={!selectedFurniture}
            >
              Delete Selected
            </button>
          </div>

          <div style={{ height: 18 }} />

          <SectionTitle>SHORTCUTS</SectionTitle>
          <div style={infoGridStyle}>
            <InfoRow label="Rotate item" value="R" />
            <InfoRow label="Delete item" value="Del" />
            <InfoRow label="FPS Move" value="W A S D" />
            <InfoRow label="FPS Up" value="E / Space" />
            <InfoRow label="FPS Down" value="Q / Shift" />
            <InfoRow label="Orbit" value="Drag + Wheel" />
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: "0.12em",
        color: "rgba(255,255,255,0.45)",
        marginBottom: 10,
        marginTop: 4
      }}
    >
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 14 }}>{label}</span>
      <span
        style={{
          color: "#fff",
          fontWeight: 700,
          fontSize: 14,
          maxWidth: 120,
          textAlign: "right",
          wordBreak: "break-word"
        }}
      >
        {value}
      </span>
    </div>
  );
}

const panelStyle = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: 18,
  boxShadow: "0 16px 50px rgba(0,0,0,0.28)"
};

const infoGridStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 18,
  padding: 14,
  display: "grid",
  gap: 12
};

const inputStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
  color: "#fff",
  outline: "none"
};

function sideButton(active) {
  return {
    padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 14,
    cursor: "pointer",
    background: active ? "#ffffff" : "rgba(255,255,255,0.04)",
    color: active ? "#000" : "#fff",
    fontWeight: 700,
    textAlign: "left",
    transition: "0.2s ease",
    opacity: 1
  };
}

function smallButton(active) {
  return {
    padding: "10px 12px",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 12,
    cursor: "pointer",
    background: active ? "#ffffff" : "rgba(255,255,255,0.04)",
    color: active ? "#000" : "#fff",
    fontWeight: 700,
    transition: "0.2s ease"
  };
}