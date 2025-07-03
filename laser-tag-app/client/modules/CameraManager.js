export class CameraManager {
    constructor(gameState, socketManager, uiManager) {
        this.gameState = gameState;
        this.socketManager = socketManager;
        this.uiManager = uiManager;
        this.canvasElement = document.getElementById('overlay');
        this.ctx = this.canvasElement.getContext('2d', { willReadFrequently: true });
        this.videoElement = document.getElementById('webcam');

        this.uiManager.on('startWebcam', () => this.startWebcam());
    }

    startWebcam() {
        const constraints = {
            video: { facingMode: { exact: "environment" } }
        };

        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => this.handleWebcamSuccess(stream))
            .catch(() => this.fallbackToDefaultCamera());
    }

    handleWebcamSuccess(stream) {
        this.videoElement.srcObject = stream;
        this.videoElement.play();

        this.canvasElement.width = this.videoElement.videoWidth || 640;
        this.canvasElement.height = this.videoElement.videoHeight || 480;

        this.uiManager.emit('initBloodSystem');
    }

    fallbackToDefaultCamera() {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => this.handleWebcamSuccess(stream))
            .catch(() => alert('Camera access denied or not available'));
    }

    detectColor() {
        this.ctx.drawImage(this.videoElement, 0, 0, this.canvasElement.width, this.canvasElement.height);
        const frame = this.ctx.getImageData(0, 0, this.canvasElement.width, this.canvasElement.height);
        const detectedColor = this.detectDominantColor(frame.data);

        if (detectedColor) {
            this.handleColorDetected(detectedColor);
        }
    }

    detectDominantColor(data) {
        const colorCounts = { red: 0, blue: 0, purple: 0, yellow: 0 };
        const threshold = 2000;

        for (let i = 0; i < data.length; i += 4) {
            const [r, g, b] = [data[i], data[i + 1], data[i + 2]];

            if (r > 180 && g < 100 && b < 100) colorCounts.red++;
            else if (b > 150 && r < 100 && g < 100) colorCounts.blue++;
            else if (r > 100 && b > 100 && g < 80) colorCounts.purple++;
            else if (r > 200 && g > 200 && b < 100) colorCounts.yellow++;
        }

        return Object.entries(colorCounts)
            .find(([, count]) => count > threshold)?.[0] || null;
    }

    handleColorDetected(color) {
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }

        this.socketManager.emitTeamHit(
            this.gameState.playerTeam,
            this.gameState.playerTeam === 'red' ? 'blue' : 'red',
            color
        );

        this.showScanToast(color);
    }

    showScanToast(color) {
        const toast = document.createElement('div');
        toast.textContent = `🎯 Scanned: ${color.toUpperCase()}`;
        toast.className = 'scan-toast';
        toast.style.cssText = this.getScanToastStyles();

        document.body.appendChild(toast);
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 2000);
    }

    getScanToastStyles() {
        return `
        position: fixed;
        top: 70px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.9);
        color: var(--neon-yellow);
        padding: 8px 16px;
        border-radius: 20px;
        border: 1px solid var(--neon-yellow);
        z-index: 9999;
        font-family: 'Orbitron', monospace;
        font-weight: 700;
        font-size: 0.9rem;
        text-shadow: 0 0 10px currentColor;
        animation: scanToast 2s ease-out forwards;
      `;
    }
}
  