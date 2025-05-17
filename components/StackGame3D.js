import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const BLOCK_HEIGHT = 2;
const BLOCK_SIZE = 4;
const MOVE_SPEED = 0.15;

function getColor(level) {
  // Simple gradient: blue to green to yellow
  const colors = ['#6366f1', '#06b6d4', '#22d3ee', '#a3e635', '#fde047', '#fbbf24', '#f87171'];
  return colors[level % colors.length];
}

const StackGame3D = () => {
  const mountRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [restartKey, setRestartKey] = useState(0); // To force re-mount on restart

  useEffect(() => {
    let scene, camera, renderer, animationId;
    let stack = [];
    let direction = 1; // 1: x, -1: z
    let moveDir = 1; // 1 or -1
    let currentBlock, lastBlock;
    let isMoving = true;
    let cameraTargetY = 10;
    let cameraLerp = 0.1;

    // --- SETUP ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3f4f6');

    camera = new THREE.PerspectiveCamera(45, 400 / 600, 0.1, 1000);
    camera.position.set(0, 10, 20);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 600);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Ground
    const groundGeometry = new THREE.PlaneGeometry(20, 20);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: '#e0e7ef' });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -BLOCK_HEIGHT;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- GAME LOGIC ---
    function addBlock(y, size, color, x = 0, z = 0) {
      const geometry = new THREE.BoxGeometry(size, BLOCK_HEIGHT, size);
      const material = new THREE.MeshPhongMaterial({ color });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }

    function startGame() {
      // Remove all blocks
      stack.forEach(b => scene.remove(b));
      stack = [];
      direction = 1;
      moveDir = 1;
      isMoving = true;
      setScore(0);
      setGameOver(false);

      // Add first block
      const base = addBlock(BLOCK_HEIGHT / 2, BLOCK_SIZE, getColor(0));
      stack.push(base);

      // Add second block
      addNewBlock();
    }

    function addNewBlock() {
      direction = -direction; // Alternate direction
      lastBlock = stack[stack.length - 1];
      const y = BLOCK_HEIGHT / 2 + stack.length * BLOCK_HEIGHT;
      const color = getColor(stack.length);
      let x = lastBlock.position.x;
      let z = lastBlock.position.z;
      if (direction === 1) x = -8; // Start from left
      if (direction === -1) z = -8; // Start from far
      const block = addBlock(y, lastBlock.scale.x * BLOCK_SIZE, color, x, z);
      block.userData = { direction, moveDir: 1, speed: MOVE_SPEED };
      currentBlock = block;
      stack.push(block);
      isMoving = true;
    }

    function placeBlock() {
      if (!isMoving) return;
      isMoving = false;
      const prev = stack[stack.length - 2];
      const curr = currentBlock;
      let overlap, delta, axis;

      if (direction === 1) {
        axis = 'x';
        delta = curr.position.x - prev.position.x;
        overlap = prev.scale.x * BLOCK_SIZE - Math.abs(delta);
      } else {
        axis = 'z';
        delta = curr.position.z - prev.position.z;
        overlap = prev.scale.z * BLOCK_SIZE - Math.abs(delta);
      }

      if (overlap > 0) {
        // Trim block
        const newSize = overlap / BLOCK_SIZE;
        curr.scale[axis] = newSize;
        curr.position[axis] -= delta / 2;
        setScore(s => s + 1);
        // Add next block
        setTimeout(() => {
          addNewBlock();
        }, 200);
        // Camera up
        cameraTargetY = curr.position.y + 9;
      } else {
        // Game over
        setGameOver(true);
      }
    }

    function animate() {
      if (isMoving && currentBlock && !gameOver) {
        if (direction === 1) {
          currentBlock.position.x += currentBlock.userData.speed * currentBlock.userData.moveDir;
          if (currentBlock.position.x > 8) currentBlock.userData.moveDir = -1;
          if (currentBlock.position.x < -8) currentBlock.userData.moveDir = 1;
        } else {
          currentBlock.position.z += currentBlock.userData.speed * currentBlock.userData.moveDir;
          if (currentBlock.position.z > 8) currentBlock.userData.moveDir = -1;
          if (currentBlock.position.z < -8) currentBlock.userData.moveDir = 1;
        }
      }
      // Camera follows stack
      camera.position.y += (cameraTargetY - camera.position.y) * cameraLerp;
      camera.lookAt(0, camera.position.y - 9, 0);

      renderer.render(scene, camera);
      animationId = requestAnimationFrame(animate);
    }

    // --- EVENT HANDLING ---
    function handleClick() {
      if (gameOver) {
        setRestartKey(k => k + 1);
      } else {
        placeBlock();
      }
    }
    renderer.domElement.addEventListener('pointerdown', handleClick);

    // --- START GAME ---
    startGame();
    animate();

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointerdown', handleClick);
      mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line
  }, [restartKey]);

  // Overlay UI
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div ref={mountRef} className="rounded-lg shadow-lg" />
      <div className="absolute top-10 left-0 w-full flex flex-col items-center pointer-events-none select-none">
        <div className="text-5xl font-light text-gray-800 drop-shadow-lg">{score}</div>
        {gameOver && (
          <div className="mt-8 text-2xl text-gray-700 font-light pointer-events-auto">
            <button
              className="bg-white/80 px-8 py-3 rounded-xl shadow text-gray-800 font-light text-2xl"
              onClick={() => setRestartKey(k => k + 1)}
            >
              TAP TO RESTART
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default StackGame3D; 