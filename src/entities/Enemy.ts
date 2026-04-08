import Phaser from 'phaser';

export type EnemyState = 'idle' | 'patrol' | 'detect' | 'hurt' | 'dead';

// Step 4: Enemy AI — patrol, detect radius, hurt flash, death
export class Enemy {
  readonly sprite: Phaser.Physics.Arcade.Image;
  private state: EnemyState = 'patrol';

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string) {
    this.sprite = scene.physics.add.image(x, y, textureKey);
    // TODO (Step 4): AI state machine setup
  }

  update(_playerX: number, _playerY: number): void {
    // TODO (Step 4): State transitions
    void this.state;
  }

  hurt(): void {
    // TODO (Step 8): Hurt flash + hit-stop
    this.state = 'hurt';
  }
}
