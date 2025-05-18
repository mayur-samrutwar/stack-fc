import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import styles from './StackGame3D.module.css';

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
  const [gameStarted, setGameStarted] = useState(false);
  const [restartKey, setRestartKey] = useState(0); // To force re-mount on restart
  const [baseHue, setBaseHue] = useState(() => Math.floor(Math.random() * 360));
  const [colorFamily, setColorFamily] = useState(() => Math.floor(Math.random() * 360));

  // Direct palette of cheerful, bright colors
  const cheerfulColors = [
    '#fff44f', // Lemon Yellow
    '#ffad05', // Bright Orange
    '#ff6363', // Bright Coral
    '#ff5ec6', // Hot Pink
    '#ff7eb9', // Pink
    '#f08ed3', // Cheerful Pink
    '#a685e2', // Soft Purple
    '#8cff1f', // Fresh Green
    '#7cfc00', // Neon Green
    '#54ff9f', // Mint
    '#36dbca', // Bright Turquoise
    '#00fff7', // Aqua
    '#00c6cc', // Bright Aqua
    '#5eda9e', // Soft Green
    '#bdfcc9', // Light Mint
    '#aee9fc', // Sky Blue
    '#82fff4', // Light Cyan
    '#a0e7e5', // Pastel Blue
    '#b4f8c8', // Pastel Mint
    '#e9ff39', // Bright Lime Yellow
    '#f9f871', // Bright Lemon
    '#f6f7d7', // Light Cream
    '#ffd6e0', // Soft Pink
    '#fbe7c6', // Light Peach
    '#f9c846', // Bright Gold
    '#f7b32b', // Bright Mustard
    '#f6abb6', // Light Rose
    '#f9a1bc', // Light Pink
    '#f08fc0', // Light Magenta
    '#ab8ee5', // Playful Purple
  ];

  // Helper to convert hex to HSL
  function hexToHSL(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
      r = '0x' + hex[1] + hex[1];
      g = '0x' + hex[2] + hex[2];
      b = '0x' + hex[3] + hex[3];
    } else if (hex.length === 7) {
      r = '0x' + hex[1] + hex[2];
      g = '0x' + hex[3] + hex[4];
      b = '0x' + hex[5] + hex[6];
    }
    r = +r; g = +g; b = +b;
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  function getColor(level) {
    const blocksPerColor = 4;
    const colorIdx = Math.floor(level / blocksPerColor) % cheerfulColors.length;
    const baseHex = cheerfulColors[colorIdx];
    const shadeIdx = level % blocksPerColor;
    const baseHSL = hexToHSL(baseHex);
    // Make 4 shades: from lighter to normal
    const lightness = baseHSL.l + 10 - shadeIdx * 5; // e.g. 4 blocks: 10, 5, 0, -5
    return `hsl(${baseHSL.h}, ${baseHSL.s}%, ${Math.max(40, Math.min(90, lightness))}%)`;
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
      const topColor = shade(color, +0);      // top is lighter
      const rightColor = shade(color, -5);     // right is just a bit darker
      const frontColor = shade(color, -15);    // front is a bit more, but still light
      // Order: [right(+X), left(-X), top(+Y), bottom(-Y), front(+Z), back(-Z)]
      let materials = [
        new THREE.MeshPhongMaterial({ color: rightColor }), // right (+X)
        new THREE.MeshPhongMaterial({ color: frontColor }), // left (-X) - darkest
        new THREE.MeshPhongMaterial({ color: topColor }),   // top (+Y)
        new THREE.MeshPhongMaterial({ color: frontColor }), // bottom (-Y) - darkest
        new THREE.MeshPhongMaterial({ color: frontColor }), // front (+Z) - darkest
        new THREE.MeshPhongMaterial({ color: frontColor })  // back (-Z) - darkest
      ];
      // Removed direction-based swapping for consistent shading
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
      const base = addBlock(0, BLOCK_SIZE, BLOCK_SIZE, getColor(0), 0, 0, BLOCK_HEIGHT * 2, 1);
      base.userData = { sizeX: BLOCK_SIZE, sizeZ: BLOCK_SIZE, height: BLOCK_HEIGHT * 2, direction: 1 };
      stack.push(base);

      // Add first playable block directly above base, not from the side
      addNewBlock(true);
    }

    function addNewBlock(isFirst = false) {
      if (!isFirst) direction = -direction; // Alternate direction except for first
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
      if (!isFirst) {
        if (direction === 1) x = baseX - moveRangeX;
        if (direction === -1) z = baseZ - moveRangeZ;
      }
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
      if (!gameStarted) {
        setGameStarted(true);
        startGame();
        return;
      }
      if (gameOver) {
        setRestartKey(k => k + 1);
        setGameStarted(false);
      } else {
        placeBlock();
      }
    }
    renderer.domElement.addEventListener('pointerdown', handleClick);

    // --- START GAME ---
    if (gameStarted) {
      startGame();
    }
    animate();

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationId);
      renderer.domElement.removeEventListener('pointerdown', handleClick);
      mountRef.current.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line
  }, [restartKey, gameStarted]);

  // Overlay UI
  return (
    <div className={styles.stackGameContainer}>
      <div ref={mountRef} className={styles.gameCanvas} />
      {/* Score always at the top, over game only */}
      {gameStarted && (
        <div className={styles.scoreDisplay}>
          <div className={styles.scoreText}>{score}</div>
        </div>
      )}
      {/* Start Overlay */}
      {!gameStarted && (
        <div
          className={styles.startOverlay}
          onClick={() => setGameStarted(true)}
        >
          <div className={styles.startContent}>
            <span className={styles.startText}>TAP TO START</span>
          </div>
        </div>
      )}
      {/* Game Over Overlay */}
      {gameOver && (
        <div
          className={styles.gameOverOverlay}
          onClick={() => setRestartKey(k => k + 1)}
        >
          <div className={styles.gameOverContent}>
            <span className={styles.gameOverText}>TAP TO RESTART</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StackGame3D; 