export class BloodSystem {
    constructor(gameState, uiManager) {
        this.gameState = gameState;
        this.uiManager = uiManager;
        this.bloodSplats = [];
        this.maxBloodSplats = 15;

        this.uiManager.on('initBloodSystem', () => this.init());
        this.uiManager.on('takeDamage', (damage) => this.takeDamage(damage));
        this.uiManager.on('heal', (amount) => this.heal(amount));
    }

    init() {
        const bloodCanvas = document.getElementById('blood-canvas');
        if (bloodCanvas) {
            bloodCanvas.width = window.innerWidth;
            bloodCanvas.height = window.innerHeight;
        }

        this.gameState.setPlayerHealth(100);
        this.clearAllBlood();
    }

    takeDamage(damage) {
        this.gameState.takeDamage(damage);

        const intensity = damage / 10;
        this.createBloodSplat(intensity);
        this.showDamageIndicator();
        this.updateDamageVignette();

        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
    }

    heal(amount) {
        const actualHeal = this.gameState.heal(amount);

        if (actualHeal > 0) {
            this.clearSomeBlood(0.2);
            this.showHealIndicator();
            this.updateDamageVignette();
        }
    }

    createBloodSplat(intensity = 1) {
        const bloodSplatsContainer = document.querySelector('.blood-splats');
        if (!bloodSplatsContainer) return;

        const splatCount = Math.floor(intensity * 6) + 2;

        for (let i = 0; i < splatCount; i++) {
            const splat = this.createSingleBloodSplat(intensity);
            bloodSplatsContainer.appendChild(splat);
            this.bloodSplats.push(splat);
        }

        this.removeOldBloodSplats();
    }

    createSingleBloodSplat(intensity) {
        const splat = document.createElement('div');
        splat.className = 'blood-splat';

        const centerBias = 1 - Math.max(0, this.gameState.playerHealth / 100);
        const x = 50 + (Math.random() - 0.5) * 80 * (1 - centerBias) + (Math.random() - 0.5) * 20 * centerBias;
        const y = 50 + (Math.random() - 0.5) * 80 * (1 - centerBias) + (Math.random() - 0.5) * 20 * centerBias;
        const size = (Math.random() * 60 + 40) * intensity;
        const rotation = Math.random() * 360;

        Object.assign(splat.style, {
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}px`,
            height: `${size}px`,
            opacity: `${0.7 + 0.3 * (1 - this.gameState.playerHealth / 100)}`,
            transform: `rotate(${rotation}deg)`
        });

        return splat;
    }

    removeOldBloodSplats() {
        while (this.bloodSplats.length > this.maxBloodSplats) {
            const oldSplat = this.bloodSplats.shift();
            if (oldSplat && oldSplat.parentNode) {
                oldSplat.style.animation = 'fadeOut 0.5s ease-out forwards';
                setTimeout(() => {
                    if (oldSplat.parentNode) {
                        oldSplat.parentNode.removeChild(oldSplat);
                    }
                }, 500);
            }
        }
    }

    updateDamageVignette() {
        const vignette = document.querySelector('.damage-vignette');
        if (!vignette) return;

        vignette.className = 'damage-vignette';

        if (this.gameState.playerHealth <= 15) {
            vignette.classList.add('critical-health', 'max-blood');
        } else if (this.gameState.playerHealth <= 30) {
            vignette.classList.add('critical-health');
        } else if (this.gameState.playerHealth <= 60) {
            vignette.classList.add('low-health');
        }
    }

    showDamageIndicator() {
        const indicator = document.getElementById('damage-indicator');
        if (!indicator) return;

        const damageText = indicator.querySelector('.damage-text');
        damageText.textContent = '-SHOT';

        indicator.classList.remove('hidden');
        document.body.classList.add('screen-shake');

        setTimeout(() => {
            indicator.classList.add('hidden');
            document.body.classList.remove('screen-shake');
        }, 500);
    }

    showHealIndicator() {
        const indicator = document.getElementById('heal-indicator');
        if (!indicator) return;

        const healText = indicator.querySelector('.heal-text');
        healText.textContent = '+HEALED';

        indicator.classList.remove('hidden');

        setTimeout(() => {
            indicator.classList.add('hidden');
        }, 1000);
    }

    clearSomeBlood(percentage = 0.3) {
        const splatsToRemove = Math.floor(this.bloodSplats.length * percentage);

        for (let i = 0; i < splatsToRemove; i++) {
            if (this.bloodSplats.length > 0) {
                const splat = this.bloodSplats.shift();
                if (splat && splat.parentNode) {
                    splat.style.animation = 'fadeOut 0.8s ease-out forwards';
                    setTimeout(() => {
                        if (splat.parentNode) {
                            splat.parentNode.removeChild(splat);
                        }
                    }, 800);
                }
            }
        }
    }

    clearAllBlood() {
        this.bloodSplats.forEach(splat => {
            if (splat && splat.parentNode) {
                splat.parentNode.removeChild(splat);
            }
        });
        this.bloodSplats = [];

        const vignette = document.querySelector('.damage-vignette');
        if (vignette) {
            vignette.className = 'damage-vignette';
        }
    }
}
  