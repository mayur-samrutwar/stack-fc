import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const BLOCK_HEIGHT = 1;
const BLOCK_SIZE = 4;
const BASE_HEIGHT = BLOCK_HEIGHT; // Base is same height as other blocks
const INITIAL_MOVE_SPEED = 0.04;
const SPEED_INCREMENT = 0.0001; // Linear increment per block
const MAX_MOVE_SPEED = 0.28;
const FALL_SPEED = 0.2;
const GRAVITY = 0.03; // slower gravity for realism
const FRICTION = 0.96; // friction for rolling
const BOUNCE = 0.3; // bounce factor

const StackGame3D = () => {
  const mountRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [restartKey, setRestartKey] = useState(0); // To force re-mount on restart
  const [baseHue, setBaseHue] = useState(() => Math.floor(Math.random() * 360));

  function getColor(level) {
    // Use a smaller hue step for more subtle color changes
    const hueStep = 8; // Smaller step for more subtle changes
    const hue = (baseHue + level * hueStep) % 360;
    
    // Higher saturation for more vibrant colors
    const sat = 85 + (level * 0.1) % 10; // 85-95% saturation
    
    // Higher lightness for brighter, softer colors
    const light = 75 + (level * 0.2) % 10; // 75-85% lightness
    
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  useEffect(() => {
    let scene, camera, renderer, animationId;
    let stack = [];
    let direction = 1; // 1: x, -1: z
    let moveDir = 1; // 1 or -1
    let currentBlock, lastBlock;
    let isMoving = true;
    let cameraTargetY = 10;
    let cameraLerp = 0.1;
    let fallingPieces = [];
    let moveSpeed = INITIAL_MOVE_SPEED;

    // --- SETUP ---
    scene = new THREE.Scene();
    scene.background = new THREE.Color('#f3f4f6');

    // Camera: isometric 45deg, close-up
    camera = new THREE.PerspectiveCamera(45, 400 / 600, 0.1, 1000);
    const camDist = 12; // a bit further for a wider view
    const camHeight = 4; // much lower for a more side-on look
    const camAngle = Math.PI / 4; // 45deg
    camera.position.set(
      Math.sin(camAngle) * camDist,
      camHeight,
      Math.cos(camAngle) * camDist
    );
    camera.lookAt(0, camHeight - 9, 0); // Look at the base

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
    const groundGeometry = new THREE.PlaneGeometry(40, 40);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: '#e0e7ef' });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -BLOCK_HEIGHT / 2 - 0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // --- GAME LOGIC ---
    function addBlock(y, sizeX, sizeZ, color, x = 0, z = 0, customHeight = BLOCK_HEIGHT) {
      const geometry = new THREE.BoxGeometry(sizeX, customHeight, sizeZ);
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
      fallingPieces = [];
      setBaseHue(Math.floor(Math.random() * 360)); // New color family each game

      // Add base block (tall)
      const base = addBlock(BLOCK_HEIGHT / 2, BLOCK_SIZE, BLOCK_SIZE, getColor(0), 0, 0, BLOCK_HEIGHT);
      base.userData = { sizeX: BLOCK_SIZE, sizeZ: BLOCK_SIZE };
      stack.push(base);

      // Add first playable block
      addNewBlock();
    }

    function addNewBlock() {
      direction = -direction; // Alternate direction
      lastBlock = stack[stack.length - 1];
      const y = BLOCK_HEIGHT / 2 + stack.length * BLOCK_HEIGHT;
      const color = getColor(stack.length);
      let x = lastBlock.position.x;
      let z = lastBlock.position.z;
      let sizeX = lastBlock.userData.sizeX;
      let sizeZ = lastBlock.userData.sizeZ;
      const moveRangeX = sizeX * 1.2;
      const moveRangeZ = sizeZ * 1.2;
      if (direction === 1) x = -moveRangeX; // Start just outside left
      if (direction === -1) z = -moveRangeZ; // Start just outside far
      const block = addBlock(y, sizeX, sizeZ, color, x, z);
      block.userData = { direction, moveDir: 1, speed: moveSpeed, sizeX, sizeZ, moveRangeX, moveRangeZ };
      currentBlock = block;
      stack.push(block);
      isMoving = true;
    }

    function placeBlock() {
      if (!isMoving) return;
      isMoving = false;
      const prev = stack[stack.length - 2];
      const curr = currentBlock;
      let overlap, delta, axis, sizeKey, posKey;
      let prevSize, currSize, prevPos, currPos;

      if (direction === 1) {
        axis = 'x';
        sizeKey = 'sizeX';
        posKey = 'x';
        prevSize = prev.userData.sizeX;
        currSize = curr.userData.sizeX;
        prevPos = prev.position.x;
        currPos = curr.position.x;
      } else {
        axis = 'z';
        sizeKey = 'sizeZ';
        posKey = 'z';
        prevSize = prev.userData.sizeZ;
        currSize = curr.userData.sizeZ;
        prevPos = prev.position.z;
        currPos = curr.position.z;
      }

      delta = currPos - prevPos;
      overlap = prevSize - Math.abs(delta);

      if (overlap > 0) {
        // Trim block
        const newSize = overlap;
        const cutSize = currSize - overlap;
        curr.scale[axis] = newSize / currSize;
        curr.position[axis] -= delta / 2;
        curr.userData[sizeKey] = newSize;
        setScore(s => s + 1);
        moveSpeed = Math.min(moveSpeed + SPEED_INCREMENT, MAX_MOVE_SPEED);

        // Create falling piece
        if (cutSize > 0.01) {
          const cutPos = curr.position[axis] + (delta > 0 ? (newSize / 2 + cutSize / 2) : -(newSize / 2 + cutSize / 2));
          const falling = addBlock(
            curr.position.y,
            axis === 'x' ? cutSize : curr.userData.sizeX,
            axis === 'z' ? cutSize : curr.userData.sizeZ,
            getColor(stack.length - 1),
            axis === 'x' ? cutPos : curr.position.x,
            axis === 'z' ? cutPos : curr.position.z
          );
          // Give the falling piece a push and spin
          falling.userData = {
            velocityY: 0,
            velocityX: axis === 'x' ? (delta > 0 ? 0.08 : -0.08) : 0,
            velocityZ: axis === 'z' ? (delta > 0 ? 0.08 : -0.08) : 0,
            rotation: (Math.random() - 0.5) * 0.1,
            angularVelocity: (Math.random() - 0.5) * 0.08,
            axis,
            alive: true
          };
          fallingPieces.push(falling);
        }

        // Add next block
        setTimeout(() => {
          addNewBlock();
        }, 200);
        // Camera up
        cameraTargetY = curr.position.y + 9;
      } else {
        // Game over
        // Make the last block fall as a falling piece
        const axis = direction === 1 ? 'x' : 'z';
        const sizeKey = direction === 1 ? 'sizeX' : 'sizeZ';
        const last = currentBlock;
        const falling = addBlock(
          last.position.y,
          last.userData.sizeX,
          last.userData.sizeZ,
          getColor(stack.length - 1),
          last.position.x,
          last.position.z
        );
        falling.userData = {
          velocityY: 0,
          velocityX: direction === 1 ? last.userData.speed * last.userData.moveDir : 0,
          velocityZ: direction === -1 ? last.userData.speed * last.userData.moveDir : 0,
          rotation: (Math.random() - 0.5) * 0.1,
          angularVelocity: (Math.random() - 0.5) * 0.08,
          axis,
          alive: true
        };
        fallingPieces.push(falling);
        scene.remove(last); // Remove the last block from the stack
        setGameOver(true);
      }
    }

    function animate() {
      if (isMoving && currentBlock && !gameOver) {
        if (direction === 1) {
          currentBlock.position.x += currentBlock.userData.speed * currentBlock.userData.moveDir;
          const maxX = currentBlock.userData.moveRangeX;
          if (currentBlock.position.x > maxX) currentBlock.userData.moveDir = -1;
          if (currentBlock.position.x < -maxX) currentBlock.userData.moveDir = 1;
        } else {
          currentBlock.position.z += currentBlock.userData.speed * currentBlock.userData.moveDir;
          const maxZ = currentBlock.userData.moveRangeZ;
          if (currentBlock.position.z > maxZ) currentBlock.userData.moveDir = -1;
          if (currentBlock.position.z < -maxZ) currentBlock.userData.moveDir = 1;
        }
      }
      // Animate falling pieces
      for (let i = fallingPieces.length - 1; i >= 0; i--) {
        const piece = fallingPieces[i];
        if (!piece.userData.alive) continue;
        // Physics
        piece.position.y += piece.userData.velocityY;
        piece.userData.velocityY -= GRAVITY;
        piece.position.x += piece.userData.velocityX || 0;
        piece.position.z += piece.userData.velocityZ || 0;
        // Rotation
        if (piece.userData.axis === 'x') {
          piece.rotation.z += piece.userData.rotation;
        } else {
          piece.rotation.x += piece.userData.rotation;
        }
        piece.rotation.y += piece.userData.angularVelocity;
        // Ground collision and rolling
        if (piece.position.y <= BLOCK_HEIGHT / 2) {
          piece.position.y = BLOCK_HEIGHT / 2;
          if (Math.abs(piece.userData.velocityY) > 0.05) {
            piece.userData.velocityY = -piece.userData.velocityY * BOUNCE;
          } else {
            piece.userData.velocityY = 0;
            // Friction slows down rolling
            piece.userData.velocityX *= FRICTION;
            piece.userData.velocityZ *= FRICTION;
            piece.userData.angularVelocity *= FRICTION;
            if (
              Math.abs(piece.userData.velocityX) < 0.001 &&
              Math.abs(piece.userData.velocityZ) < 0.001 &&
              Math.abs(piece.userData.angularVelocity) < 0.001
            ) {
              piece.userData.alive = false;
              setTimeout(() => scene.remove(piece), 1000);
            }
          }
        }
        if (piece.position.y < -20) {
          scene.remove(piece);
          piece.userData.alive = false;
          fallingPieces.splice(i, 1);
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