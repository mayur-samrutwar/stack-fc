import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

const BLOCK_HEIGHT = 1;
const BLOCK_SIZE = 4;
const BASE_HEIGHT = BLOCK_HEIGHT; // Base is same height as other blocks
const INITIAL_MOVE_SPEED = 0.04;
const SPEED_INCREMENT = 0.0005; // Much slower, smoother speed increase
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
  const [colorFamily, setColorFamily] = useState(() => Math.floor(Math.random() * 360));

  // Curated palette of only bright, joyful, fresh hues
  const basePalette = [
    48, 52,   // yellow
    24, 30,   // orange/peach
    340, 350, // pink
    320,      // magenta
    200, 210, // sky blue
    170, 160, // mint
    120, 100  // light green
  ];
  // Shuffle palette at game start
  const [palette, setPalette] = useState([]);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function getColor(level) {
    const blocksPerColor = 4;
    if (!palette.length) return 'hsl(48,96%,72%)'; // fallback vivid yellow
    const colorIdx = Math.floor(level / blocksPerColor) % palette.length;
    const hue = palette[colorIdx];
    // Joyful: very high saturation, high lightness
    const sat = 94 + ((level % blocksPerColor) * 1.5); // 94-98%
    const light = 75 - ((level % blocksPerColor) * 2.5); // 75, 72.5, 70, 67.5
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
    let gameOverCameraAnimation = null;

    // --- SETUP ---
    scene = new THREE.Scene();
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#e2e8f0'); // top (light slate)
    gradient.addColorStop(1, '#cbd5e1'); // bottom (slate gray)
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    scene.background = texture;
    
    // Camera: isometric 45deg, close-up
    camera = new THREE.PerspectiveCamera(45, 400 / 600, 0.1, 1000);
    const camDist = 12;
    const camHeight = -3; // much lower camera for base near bottom
    const camAngle = Math.PI / 4; // 45deg
    camera.position.set(
      Math.sin(camAngle) * camDist,
      camHeight,
      Math.cos(camAngle) * camDist
    );
    camera.lookAt(0, camHeight - 15, 0); // Look even lower for initial stack

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 600);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.55)); // slightly dimmer ambient
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.1); // stronger directional
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // --- GAME LOGIC ---
    function addBlock(y, sizeX, sizeZ, color, x = 0, z = 0, customHeight = BLOCK_HEIGHT, direction = 1) {
      // Calculate three shades for 3D effect
      function shade(hsl, percent) {
        const match = hsl.match(/hsl\((\d+), (\d+)%?, (\d+)%?\)/);
        if (!match) return hsl;
        const [h, s, l] = match.slice(1).map(Number);
        const newL = Math.max(0, Math.min(100, l + percent));
        return `hsl(${h}, ${s}%, ${newL}%)`;
      }
      const topColor = color;
      const rightColor = shade(color, -18); // medium
      const frontColor = shade(color, -35); // darkest
      // Order: [right(+X), left(-X), top(+Y), bottom(-Y), front(+Z), back(-Z)]
      let materials = [
        new THREE.MeshPhongMaterial({ color: rightColor }), // right (+X)
        new THREE.MeshPhongMaterial({ color: frontColor }), // left (-X) - darkest
        new THREE.MeshPhongMaterial({ color: topColor }),   // top (+Y)
        new THREE.MeshPhongMaterial({ color: frontColor }), // bottom (-Y) - darkest
        new THREE.MeshPhongMaterial({ color: frontColor }), // front (+Z) - darkest
        new THREE.MeshPhongMaterial({ color: frontColor })  // back (-Z) - darkest
      ];
      // If stacking in Z, rotate the material array so front/right are correct
      if (direction === -1) {
        // Swap right (+X) and front (+Z) materials
        materials = [
          new THREE.MeshPhongMaterial({ color: frontColor }), // right (+X) now gets front shade
          new THREE.MeshPhongMaterial({ color: frontColor }), // left (-X)
          new THREE.MeshPhongMaterial({ color: topColor }),
          new THREE.MeshPhongMaterial({ color: frontColor }),
          new THREE.MeshPhongMaterial({ color: rightColor }), // front (+Z) now gets right shade
          new THREE.MeshPhongMaterial({ color: frontColor })
        ];
      }
      const geometry = new THREE.BoxGeometry(sizeX, customHeight, sizeZ);
      const mesh = new THREE.Mesh(geometry, materials);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      mesh.userData.height = customHeight;
      return mesh;
    }

    function startGame() {
      setPalette(shuffle(basePalette));
      // Remove all blocks
      stack.forEach(b => scene.remove(b));
      stack = [];
      direction = 1;
      moveDir = 1;
      isMoving = true;
      setScore(0);
      setGameOver(false);
      fallingPieces = [];
      setColorFamily(Math.floor(Math.random() * 360)); // New color family each game

      // Add base block (double height), always X direction
      const base = addBlock(BLOCK_HEIGHT, BLOCK_SIZE, BLOCK_SIZE, getColor(0), 0, 0, BLOCK_HEIGHT * 2, 1);
      base.userData = { sizeX: BLOCK_SIZE, sizeZ: BLOCK_SIZE, height: BLOCK_HEIGHT * 2, direction: 1 };
      stack.push(base);

      // Add first playable block
      addNewBlock();
    }

    function addNewBlock() {
      direction = -direction; // Alternate direction
      lastBlock = stack[stack.length - 1];
      // Always place new block exactly on top of the previous block, regardless of height
      const prevY = lastBlock.position.y;
      const prevHeight = lastBlock.userData.height || BLOCK_HEIGHT;
      const y = prevY + (prevHeight / 2) + (BLOCK_HEIGHT / 2);
      const color = getColor(stack.length);
      let prevSizeX = lastBlock.userData.sizeX;
      let prevSizeZ = lastBlock.userData.sizeZ;
      let sizeX = prevSizeX;
      let sizeZ = prevSizeZ;
      let baseX = lastBlock.position.x;
      let baseZ = lastBlock.position.z;
      // Movement range: previous block's size
      const moveRangeX = prevSizeX;
      const moveRangeZ = prevSizeZ;
      let x = baseX;
      let z = baseZ;
      if (direction === 1) x = baseX - moveRangeX;
      if (direction === -1) z = baseZ - moveRangeZ;
      const block = addBlock(y, sizeX, sizeZ, color, x, z, BLOCK_HEIGHT, direction);
      block.userData = { direction, moveDir: 1, speed: moveSpeed, sizeX, sizeZ, moveRangeX, moveRangeZ, baseX, baseZ, height: BLOCK_HEIGHT, direction };
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
        // Remove the old mesh
        scene.remove(curr);
        // Create a new trimmed block with correct size and 3D shading
        const trimmedBlock = addBlock(
          curr.position.y,
          axis === 'x' ? newSize : curr.userData.sizeX,
          axis === 'z' ? newSize : curr.userData.sizeZ,
          getColor(stack.length - 1),
          axis === 'x' ? curr.position.x - delta / 2 : curr.position.x,
          axis === 'z' ? curr.position.z - delta / 2 : curr.position.z,
          BLOCK_HEIGHT,
          curr.userData.direction
        );
        trimmedBlock.userData = { ...curr.userData };
        trimmedBlock.userData[sizeKey] = newSize;
        trimmedBlock.userData.height = BLOCK_HEIGHT;
        trimmedBlock.userData.direction = curr.userData.direction;
        stack[stack.length - 1] = trimmedBlock;
        currentBlock = trimmedBlock;
        setScore(s => s + 1);
        moveSpeed = Math.min(moveSpeed + SPEED_INCREMENT, MAX_MOVE_SPEED);

        // Create falling piece
        if (cutSize > 0.01) {
          const cutPos = trimmedBlock.position[axis] + (delta > 0 ? (newSize / 2 + cutSize / 2) : -(newSize / 2 + cutSize / 2));
          const falling = addBlock(
            trimmedBlock.position.y,
            axis === 'x' ? cutSize : trimmedBlock.userData.sizeX,
            axis === 'z' ? cutSize : trimmedBlock.userData.sizeZ,
            getColor(stack.length - 1),
            axis === 'x' ? cutPos : trimmedBlock.position.x,
            axis === 'z' ? cutPos : trimmedBlock.position.z,
            BLOCK_HEIGHT,
            curr.userData.direction
          );
          falling.userData = {
            velocityY: 0,
            velocityX: axis === 'x' ? (delta > 0 ? 0.08 : -0.08) : 0,
            velocityZ: axis === 'z' ? (delta > 0 ? 0.08 : -0.08) : 0,
            rotation: (Math.random() - 0.5) * 0.1,
            angularVelocity: (Math.random() - 0.5) * 0.08,
            axis,
            alive: true,
            direction: curr.userData.direction
          };
          fallingPieces.push(falling);
        }

        // Add next block
        setTimeout(() => {
          addNewBlock();
        }, 200);
        // Camera up
        cameraTargetY = trimmedBlock.position.y + 9;
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
          last.position.z,
          BLOCK_HEIGHT,
          last.userData.direction
        );
        falling.userData = {
          velocityY: 0,
          velocityX: direction === 1 ? last.userData.speed * last.userData.moveDir : 0,
          velocityZ: direction === -1 ? last.userData.speed * last.userData.moveDir : 0,
          rotation: (Math.random() - 0.5) * 0.1,
          angularVelocity: (Math.random() - 0.5) * 0.08,
          axis,
          alive: true,
          direction: last.userData.direction
        };
        fallingPieces.push(falling);
        scene.remove(last); // Remove the last block from the stack
        setGameOver(true);

        // Start game over camera animation
        const stackHeight = stack.length * BLOCK_HEIGHT;
        const targetDistance = Math.max(30, stackHeight * 2); // Distance based on stack height
        const targetHeight = stackHeight * 0.7; // Keep camera below the top of the stack
        
        // Cancel any existing animation
        if (gameOverCameraAnimation) {
          cancelAnimationFrame(gameOverCameraAnimation);
        }

        // Animate camera to new position
        const startTime = Date.now();
        const duration = 2000; // 2 seconds animation
        const startPos = camera.position.clone();
        const startLook = new THREE.Vector3(0, camera.position.y - 9, 0);
        
        function animateCamera() {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          
          // Calculate new camera position
          const newPos = new THREE.Vector3(
            Math.sin(camAngle) * targetDistance,
            targetHeight,
            Math.cos(camAngle) * targetDistance
          );
          
          camera.position.lerpVectors(startPos, newPos, eased);
          camera.lookAt(0, 0, 0); // Look at the base
          
          if (progress < 1) {
            gameOverCameraAnimation = requestAnimationFrame(animateCamera);
          }
        }
        
        animateCamera();
      }
    }

    function animate() {
      if (isMoving && currentBlock && !gameOver) {
        if (direction === 1) {
          currentBlock.position.x += currentBlock.userData.speed * currentBlock.userData.moveDir;
          const baseX = currentBlock.userData.baseX;
          const maxX = currentBlock.userData.moveRangeX;
          if (currentBlock.position.x > baseX + maxX) currentBlock.userData.moveDir = -1;
          if (currentBlock.position.x < baseX - maxX) currentBlock.userData.moveDir = 1;
        } else {
          currentBlock.position.z += currentBlock.userData.speed * currentBlock.userData.moveDir;
          const baseZ = currentBlock.userData.baseZ;
          const maxZ = currentBlock.userData.moveRangeZ;
          if (currentBlock.position.z > baseZ + maxZ) currentBlock.userData.moveDir = -1;
          if (currentBlock.position.z < baseZ - maxZ) currentBlock.userData.moveDir = 1;
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
    <div className="relative w-[400px] h-[600px]">
      <div ref={mountRef} className="w-full h-full" />
      {/* Score always at the top, over game only */}
      <div className="absolute top-8 left-0 w-full flex flex-col items-center pointer-events-none select-none z-20">
        <div className="text-5xl font-thin text-gray-800 mt-8">{score}</div>
      </div>
      {/* Game Over Overlay, over game only */}
      {gameOver && (
        <div
          className="absolute inset-0 flex flex-col justify-end items-center z-30 cursor-pointer select-none"
          onClick={() => setRestartKey(k => k + 1)}
        >
          <div className="w-full flex flex-col items-center mb-16">
            <span className="text-3xl md:text-4xl font-thin text-black tracking-wide mb-4">TAP TO RESTART</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StackGame3D; 