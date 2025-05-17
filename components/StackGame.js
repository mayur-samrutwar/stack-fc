import { useEffect, useRef, useState } from 'react';

const StackGame = () => {
  const canvasRef = useRef(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const animationFrameRef = useRef(null);

  // Move game state to refs so we can reset them
  const gameStateRef = useRef({
    blocks: [],
    currentBlock: null,
    movingRight: true,
    speed: 2,
    lastBlockWidth: 0,
    lastBlockX: 0,
    perfectPlacement: false,
    canPlaceBlock: true,
    isMoving: true,
    fallingPieces: [],
    stackOffset: 0,
    targetOffset: 0,
    isHammering: false,
    zoomLevel: 1,
    targetZoom: 1,
    isZooming: false,
    isZoomingOut: false
  });

  useEffect(() => {
    if (!gameStarted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const HAMMER_THRESHOLD = 7; // Changed to 7 blocks
    const HAMMER_DISTANCE = 50;
    const ZOOM_DURATION = 1000; // 1 second for zoom animation
    const ZOOM_FACTOR = 0.5; // Zoom out to 50% of original size

    // Initialize game state
    gameStateRef.current = {
      blocks: [],
      currentBlock: null,
      movingRight: true,
      speed: 2,
      lastBlockWidth: width * 0.3,
      lastBlockX: width / 2 - (width * 0.3) / 2,
      perfectPlacement: false,
      canPlaceBlock: true,
      isMoving: true,
      fallingPieces: [],
      stackOffset: 0,
      targetOffset: 0,
      isHammering: false,
      zoomLevel: 1,
      targetZoom: 1,
      isZooming: false,
      isZoomingOut: false
    };

    // Initialize first block
    gameStateRef.current.blocks.push({
      x: width / 2 - gameStateRef.current.lastBlockWidth / 2,
      y: height - 50,
      width: gameStateRef.current.lastBlockWidth,
      height: 50,
    });

    // Create new block
    const createNewBlock = () => {
      const { blocks, lastBlockWidth } = gameStateRef.current;
      const newWidth = Math.min(lastBlockWidth, blocks[blocks.length - 1].width);
      
      gameStateRef.current.movingRight = !gameStateRef.current.movingRight;
      const startX = gameStateRef.current.movingRight ? 0 : width - newWidth;
      
      gameStateRef.current.currentBlock = {
        x: startX,
        y: height - (blocks.length + 1) * 50,
        width: newWidth,
        height: 50,
      };

      if (blocks.length >= HAMMER_THRESHOLD) {
        gameStateRef.current.isHammering = true;
        gameStateRef.current.targetOffset += HAMMER_DISTANCE;
      }
    };

    // Handle game over
    const handleGameOver = () => {
      gameStateRef.current.isZooming = true;
      gameStateRef.current.targetZoom = ZOOM_FACTOR;
      gameStateRef.current.isZoomingOut = true;
      setTimeout(() => {
        setGameOver(true);
        gameStateRef.current.isZoomingOut = false;
      }, ZOOM_DURATION);
    };

    // Handle click
    const handleClick = () => {
      // Only allow restart if gameOver is true and not zooming out
      if (gameOver && !gameStateRef.current.isZoomingOut) {
        startGame();
        return;
      }

      const { currentBlock, blocks, canPlaceBlock, isMoving } = gameStateRef.current;
      if (!currentBlock || !canPlaceBlock || !isMoving) return;

      gameStateRef.current.isMoving = false;

      const previousBlock = blocks[blocks.length - 1];
      const overlap = Math.min(
        currentBlock.x + currentBlock.width,
        previousBlock.x + previousBlock.width
      ) - Math.max(currentBlock.x, previousBlock.x);

      if (overlap <= 0) {
        handleGameOver();
        return;
      }

      const newWidth = overlap;
      const newX = Math.max(currentBlock.x, previousBlock.x);

      if (currentBlock.x < previousBlock.x) {
        gameStateRef.current.fallingPieces.push({
          x: currentBlock.x,
          y: currentBlock.y,
          width: previousBlock.x - currentBlock.x,
          height: 50,
          velocityY: 0,
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 0.2
        });
      }
      if (currentBlock.x + currentBlock.width > previousBlock.x + previousBlock.width) {
        gameStateRef.current.fallingPieces.push({
          x: previousBlock.x + previousBlock.width,
          y: currentBlock.y,
          width: (currentBlock.x + currentBlock.width) - (previousBlock.x + previousBlock.width),
          height: 50,
          velocityY: 0,
          rotation: 0,
          rotationSpeed: (Math.random() - 0.5) * 0.2
        });
      }

      gameStateRef.current.perfectPlacement = Math.abs(currentBlock.x - previousBlock.x) < 5;

      blocks.push({
        x: newX,
        y: currentBlock.y,
        width: newWidth,
        height: 50,
      });

      gameStateRef.current.lastBlockWidth = newWidth;
      gameStateRef.current.lastBlockX = newX;

      setScore(prev => prev + 1);

      gameStateRef.current.isMoving = true;
      createNewBlock();
    };

    // Game loop
    const gameLoop = () => {
      ctx.clearRect(0, 0, width, height);

      // Update zoom level
      if (gameStateRef.current.isZooming) {
        const zoomDiff = gameStateRef.current.targetZoom - gameStateRef.current.zoomLevel;
        if (Math.abs(zoomDiff) > 0.001) {
          gameStateRef.current.zoomLevel += zoomDiff * 0.1;
        } else {
          gameStateRef.current.zoomLevel = gameStateRef.current.targetZoom;
          gameStateRef.current.isZooming = false;
        }
      }

      // Update stack offset
      if (gameStateRef.current.isHammering) {
        const offsetDiff = gameStateRef.current.targetOffset - gameStateRef.current.stackOffset;
        if (Math.abs(offsetDiff) > 0.5) {
          gameStateRef.current.stackOffset += offsetDiff * 0.2;
        } else {
          gameStateRef.current.stackOffset = gameStateRef.current.targetOffset;
          gameStateRef.current.isHammering = false;
        }
      }

      // Apply zoom transformation
      ctx.save();
      const zoom = gameStateRef.current.zoomLevel;
      const centerX = width / 2;
      const centerY = height / 2;
      ctx.translate(centerX, centerY);
      ctx.scale(zoom, zoom);
      ctx.translate(-centerX, -centerY);

      // Draw all blocks
      gameStateRef.current.blocks.forEach(block => {
        ctx.fillStyle = '#4F46E5';
        ctx.fillRect(
          block.x,
          block.y + gameStateRef.current.stackOffset,
          block.width,
          block.height
        );
      });

      // Draw falling pieces
      const gravity = 0.5;
      gameStateRef.current.fallingPieces = gameStateRef.current.fallingPieces.filter(piece => {
        piece.velocityY += gravity;
        piece.y += piece.velocityY;
        piece.rotation += piece.rotationSpeed;

        ctx.save();
        ctx.translate(
          piece.x + piece.width / 2,
          piece.y + piece.height / 2 + gameStateRef.current.stackOffset
        );
        ctx.rotate(piece.rotation);
        ctx.fillStyle = '#818CF8';
        ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        ctx.restore();

        return piece.y < height + 100;
      });

      // Draw current block
      const { currentBlock, speed, movingRight, isMoving } = gameStateRef.current;
      if (currentBlock && !gameOver) {
        if (isMoving) {
          if (movingRight) {
            currentBlock.x += speed;
            if (currentBlock.x + currentBlock.width > width) {
              currentBlock.x = width - currentBlock.width;
              gameStateRef.current.movingRight = false;
            }
          } else {
            currentBlock.x -= speed;
            if (currentBlock.x < 0) {
              currentBlock.x = 0;
              gameStateRef.current.movingRight = true;
            }
          }
        }

        ctx.fillStyle = '#818CF8';
        ctx.fillRect(
          currentBlock.x,
          currentBlock.y + gameStateRef.current.stackOffset,
          currentBlock.width,
          currentBlock.height
        );
      }

      ctx.restore();

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    // Start game
    createNewBlock();
    gameLoop();

    // Add click listener
    canvas.addEventListener('click', handleClick);

    // Cleanup function
    return () => {
      canvas.removeEventListener('click', handleClick);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [gameStarted]);

  const startGame = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setGameOver(false);
    setScore(0);
    setGameStarted(false);
    setTimeout(() => {
      setGameStarted(true);
    }, 0);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={400}
          height={600}
          className="border-2 border-gray-300 rounded-lg shadow-lg bg-white"
        />
        
        {!gameStarted && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
            <button
              onClick={startGame}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Start Game
            </button>
          </div>
        )}
        
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-between bg-transparent rounded-lg py-8">
            
               <p className="text-black mt-20">{score}</p>
              <button
                onClick={startGame}
                className="px-6 py-3 text-black font-extralight text-xl"
              >
                TAP TO RESTART
              </button>
        
          </div>
        )}
      </div>
    </div>
  );
};

export default StackGame; 