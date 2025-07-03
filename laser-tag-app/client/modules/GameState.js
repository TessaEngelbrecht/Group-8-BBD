export class GameState {
    constructor() {
        this.username = '';
        this.sessionId = '';
        this.isHost = false;
        this.allPlayers = [];
        this.playerTeam = null;
        this.teamPoints = { red: 100, blue: 100 };
        this.playerHealth = 100;
    }

    setUsername(username) {
        this.username = username;
    }

    setSessionId(sessionId) {
        this.sessionId = sessionId;
    }

    setHost(isHost) {
        this.isHost = isHost;
    }

    setPlayers(players) {
        this.allPlayers = players;
    }

    setPlayerTeam(team) {
        this.playerTeam = team;
    }

    updateTeamPoints(points) {
        this.teamPoints = { ...points };
    }

    setPlayerHealth(health) {
        this.playerHealth = Math.max(0, Math.min(100, health));
    }

    takeDamage(damage) {
        this.playerHealth = Math.max(0, this.playerHealth - damage);
        return this.playerHealth;
    }

    heal(amount) {
        const oldHealth = this.playerHealth;
        this.playerHealth = Math.min(100, this.playerHealth + amount);
        return this.playerHealth - oldHealth;
    }
}
