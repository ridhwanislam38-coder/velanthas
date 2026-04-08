import Phaser from 'phaser';
import { Player }               from '../entities/Player';
import { GuardEnemy }           from '../entities/enemies/GuardEnemy';
import { JuiceSystem }          from '../systems/JuiceSystem';
import { LightingSystem }       from '../systems/LightingSystem';
import { SkySystem }            from '../systems/SkySystem';
import { CinematicSystem }      from '../systems/CinematicSystem';
import { SpecialAttackSystem }  from '../systems/SpecialAttackSystem';
import { Bus, GameEvent }       from '../systems/EventBus';
import { HealthBar }            from '../ui/HealthBar';
import { APDisplay }            from '../ui/APDisplay';
import {
  W, H, GROUND_Y, TOWN_W, COLOR, FONT,
} from '../config/Constants';

// ── TownScene — Combat test arena ────────────────────────────────────────────
// Systems integration: Sky → Lighting → Cinematic → Specials
// Sky renders first (depth 0-4), Lighting overlays at depth 300.
export default class TownScene extends Phaser.Scene {
  private _player!:   Player;
  private _enemies:   GuardEnemy[] = [];
  private _cursors!:  Phaser.Types.Input.Keyboard.CursorKeys;
  private _keys:      Record<string, Phaser.Input.Keyboard.Key> = {};

  // ── Systems
  private _juice!:    JuiceSystem;
  private _lighting!: LightingSystem;
  private _sky!:      SkySystem;
  private _cin!:      CinematicSystem;
  private _specials!: SpecialAttackSystem;

  // ── Physics
  private _ground!: Phaser.Physics.Arcade.StaticGroup;

  // ── UI
  private _playerHpBar!: HealthBar;
  private _apDisplay!:   APDisplay;
  private _enemyBars:    Map<GuardEnemy, HealthBar> = new Map();

  // ── Routing map: sprite → enemy (for HIT_SPECIAL resolution)
  private _enemyBySprite: Map<Phaser.Physics.Arcade.Image, GuardEnemy> = new Map();

  constructor() { super({ key: 'TownScene' }); }

  create(): void {
    // ── World bounds ───────────────────────────────────────────────────
    this.physics.world.setBounds(0, 0, TOWN_W, H);
    this.cameras.main.setBounds(0, 0, TOWN_W, H);

    // ── Sky (must come first — depth 0-4) ─────────────────────────────
    this._sky = new SkySystem(this);
    Bus.emit(GameEvent.REGION_ENTER, 'ASHFIELDS');

    // ── Ground geometry ────────────────────────────────────────────────
    this._ground = this.physics.add.staticGroup();
    this._buildGround();

    // ── Juice (flash/shake overlays) ───────────────────────────────────
    this._juice = new JuiceSystem(this);

    // ── Player ─────────────────────────────────────────────────────────
    this._player = new Player(this, 60, GROUND_Y - 40, this._juice);
    this.physics.add.collider(this._player.sprite, this._ground);

    // ── Enemies ─────────────────────────────────────────────────────────
    this._spawnEnemy(240, GROUND_Y - 20);
    this._spawnEnemy(480, GROUND_Y - 20);

    // ── Lighting (after entities so shadow casters can be registered) ──
    this._lighting = new LightingSystem(this);
    this._lighting.setDarkness('SURFACE');
    this._lighting.addShadowCaster('player', this._player.sprite);
    for (const enemy of this._enemies) {
      this._lighting.addShadowCaster(`enemy_${enemy.sprite.x}`, enemy.sprite);
    }

    // ── Cinematic + Specials ───────────────────────────────────────────
    this._cin      = new CinematicSystem(this);
    this._specials = new SpecialAttackSystem(this, this._cin, this._player.ap, this._juice);
    this._player.setSpecials(this._specials);

    // ── Route HIT_SPECIAL → enemy.receiveHit ──────────────────────────
    Bus.on(GameEvent.HIT_SPECIAL, (data: unknown) => {
      const d = data as {
        target:    Phaser.Physics.Arcade.Image;
        damage:    number;
        knockback: number;
        hitstun:   number;
      };
      const enemy = this._enemyBySprite.get(d.target);
      if (enemy && !enemy.isDead) {
        enemy.receiveHit({ data: d }, this._player);
      }
    });

    // ── Camera ─────────────────────────────────────────────────────────
    this.cameras.main.startFollow(this._player.sprite, true, 0.08, 0.08);
    this.cameras.main.setDeadzone(60, 20);

    // ── Input ──────────────────────────────────────────────────────────
    this._cursors = this.input.keyboard!.createCursorKeys();
    ['J', 'K', 'L', 'Z', 'U', 'I', 'W', 'A', 'D'].forEach(k => {
      this._keys[k] = this.input.keyboard!.addKey(k);
    });

    // ── Player HP bar ──────────────────────────────────────────────────
    this._playerHpBar = new HealthBar(this, {
      x: 4, y: H - 12,
      width: 80, height: 6,
      style: 'player',
      label: 'HP',
      scrollFactor: 0,
    });
    this._playerHpBar.setPercent(1);

    // ── AP display ─────────────────────────────────────────────────────
    this._apDisplay = new APDisplay(this, this._player.ap, 4, H - 26);

    // ── Controls hint ──────────────────────────────────────────────────
    this.add.text(W / 2, 4,
      'J:light  K:heavy  L:dodge  Z:block  U:special(1AP)  I:finisher(3AP)',
      {
        fontFamily: "'Press Start 2P'", fontSize: FONT.XS, color: '#4a4a6a',
        align: 'center',
      },
    ).setOrigin(0.5, 0).setScrollFactor(0).setDepth(80);

    // ── YOU DIED overlay ───────────────────────────────────────────────
    const deathOverlay = this.add.text(W / 2, H / 2, 'YOU DIED', {
      fontFamily: "'Press Start 2P'",
      fontSize: FONT.LG,
      color: COLOR.DANGER_S,
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(500).setAlpha(0);

    // Cleanup on scene shutdown
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      Bus.clear(GameEvent.HIT_SPECIAL);
      this._sky.destroy();
      this._lighting.destroy();
    });

    this.events.on('player_dead', () => {
      this.tweens.add({
        targets: deathOverlay,
        alpha: 1, duration: 800,
        onComplete: () => {
          this.time.delayedCall(2000, () => {
            this.cameras.main.fadeOut(600, 4, 4, 8);
            this.cameras.main.once('camerafadeoutcomplete', () => {
              this.scene.restart();
            });
          });
        },
      });
    });
  }

  override update(_time: number, delta: number): void {
    if (this._player.isDead) return;

    const nowMs      = _time;
    const cam        = this.cameras.main;
    const liveEnemies = this._enemies.filter(e => !e.isDead);

    // ── Sky parallax (before physics tick) ────────────────────────────
    this._sky.update(delta, cam.scrollX, false); // daytime — no stars

    // ── Combat ────────────────────────────────────────────────────────
    this._juice.updateHitStop();
    this._player.update(this._cursors, this._keys, delta, nowMs, liveEnemies);

    for (const enemy of liveEnemies) {
      enemy.update(delta, this._player);
    }

    // ── Lighting ───────────────────────────────────────────────────────
    this._lighting.setPlayerPosition(this._player.x, this._player.y);
    this._lighting.update(delta);

    // ── HP bars ───────────────────────────────────────────────────────
    this._playerHpBar.setPercent(this._player.hpPct);
    this._playerHpBar.update(delta);

    for (const [enemy, bar] of this._enemyBars) {
      if (enemy.isDead) { bar.setVisible(false); continue; }
      bar.setPercent(enemy.hpPct);
      bar.update(delta);
    }

    // ── Death check ────────────────────────────────────────────────────
    if (this._player.isDead) {
      this.events.emit('player_dead');
    }

    // ── Enemy respawn ─────────────────────────────────────────────────
    if (liveEnemies.length === 0 && this._enemies.every(e => e.isDead)) {
      this.time.delayedCall(2000, () => {
        this._enemies = [];
        this._enemyBars.forEach(b => b.destroy());
        this._enemyBars.clear();
        this._enemyBySprite.clear();
        this._spawnEnemy(240, GROUND_Y - 20);
        this._spawnEnemy(480, GROUND_Y - 20);
      });
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────
  private _spawnEnemy(x: number, y: number): void {
    const enemy = new GuardEnemy(this, x, y, this._juice);
    this.physics.add.collider(enemy.sprite, this._ground);
    this._enemies.push(enemy);
    this._enemyBySprite.set(enemy.sprite, enemy);

    const bar = new HealthBar(this, {
      x: x - 20, y: y - 22,
      width: 40, height: 4,
      style: 'enemy',
    });
    bar.attachTo(enemy.sprite, -22);
    this._enemyBars.set(enemy, bar);
  }

  private _buildGround(): void {
    const g = this.add.rectangle(TOWN_W / 2, GROUND_Y + 8, TOWN_W, 16, 0x1a1a2e);
    this.physics.add.existing(g, true);
    this._ground.add(g);

    const plats: Array<[number, number, number]> = [
      [120, GROUND_Y - 35,  60],
      [240, GROUND_Y - 60,  50],
      [380, GROUND_Y - 45,  70],
      [540, GROUND_Y - 70,  55],
      [680, GROUND_Y - 50,  60],
      [820, GROUND_Y - 80,  50],
    ];
    for (const [px, py, pw] of plats) {
      const p = this.add.rectangle(px, py, pw, 8, 0x2a2a4e);
      this.physics.add.existing(p, true);
      this._ground.add(p);
    }
  }
}
