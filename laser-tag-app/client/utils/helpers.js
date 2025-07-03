export function launchConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    canvas.classList.remove('hidden');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const myConfetti = confetti.create(canvas, { resize: true, useWorker: true });

    myConfetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    myConfetti({ particleCount: 60, spread: 120, startVelocity: 40, origin: { y: 0.7 } });
    myConfetti({ particleCount: 40, spread: 90, startVelocity: 60, origin: { y: 0.8 } });

    setTimeout(() => {
        canvas.classList.add('hidden');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 2000);
}

export function preventDoubleClick() {
    document.addEventListener('dblclick', (e) => {
        e.preventDefault();
    });
}

export function addCustomStyles() {
    const additionalCSS = `
      @keyframes fadeOut {
        0% { opacity: 0.8; }
        100% { opacity: 0; }
      }
  
      @keyframes scanToast {
        0% {
          opacity: 0;
          transform: translateX(-50%) translateY(-20px) scale(0.8);
        }
        20% {
          opacity: 1;
          transform: translateX(-50%) translateY(0) scale(1.1);
        }
        100% {
          opacity: 0;
          transform: translateX(-50%) translateY(-10px) scale(0.9);
        }
      }
    `;

    const style = document.createElement('style');
    style.textContent = additionalCSS;
    document.head.appendChild(style);
}
  