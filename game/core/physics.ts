import type { Collider, KinematicCharacterController, Ray, World } from "@dimforge/rapier3d-compat";
import { PLATFORMS, SOLIDS } from "./arena";
import type { Actor } from "./types";

type RapierModule = typeof import("@dimforge/rapier3d-compat");

/*
 * Collision groups (Rapier packs membership in the high 16 bits and the filter in the low 16).
 * Static world geometry only talks to movement queries; actors never collide with each other
 * (crowding is handled by a cheap separation force in the sim instead).
 */
const WORLD = 0x0001;
const ACTOR = 0x0002;
const STATIC_GROUPS = (WORLD << 16) | ACTOR;
const ACTOR_GROUPS = ACTOR << 16; // filter 0: nothing hits the actor colliders themselves
const QUERY_GROUPS = (ACTOR << 16) | WORLD;

/** How an actor treats one-way platforms: land on them from above, or ignore them completely. */
export type PlatformMode = "oneway" | "none";

export interface MoveResult {
  grounded: boolean;
  /** True when upward movement was blocked (head bump). */
  hitCeiling: boolean;
}

/**
 * Thin wrapper around a Rapier world. The simulation owns it; nothing here touches the DOM.
 * `@dimforge/rapier3d-compat` inlines its WebAssembly, so `create()` never downloads anything.
 */
export class Physics {
  private world: World;
  private kcc: KinematicCharacterController;
  private ray: Ray;
  private actors = new Map<number, Collider>();
  /** Collider handle → platform top height, for the one-way test. */
  private platformTops = new Map<number, number>();
  private result: MoveResult = { grounded: false, hitCeiling: false };

  // State read by the filter predicate during a single move query.
  private queryFeetY = 0;
  private queryMode: PlatformMode = "oneway";
  private readonly predicate = (c: Collider) => {
    const top = this.platformTops.get(c.handle);
    if (top === undefined) return true;
    // Only solid from above: collide when the feet started at (or just below) the platform top.
    return this.queryMode === "oneway" && this.queryFeetY >= top - 0.05;
  };

  private readonly notPlatform = (c: Collider) => !this.platformTops.has(c.handle);

  static async create(): Promise<Physics> {
    const R = await import("@dimforge/rapier3d-compat");
    await R.init();
    return new Physics(R);
  }

  private constructor(private R: RapierModule) {
    this.world = new R.World({ x: 0, y: 0, z: 0 }); // gravity is applied by the sim, not Rapier

    const addStatic = (x: number, y: number, z: number, hx: number, hy: number, hz: number) =>
      this.world.createCollider(R.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setCollisionGroups(STATIC_GROUPS));

    addStatic(0, -0.5, 0, 200, 0.5, 200); // the street
    for (const b of SOLIDS) addStatic(b.x, b.y + b.h / 2, b.z, b.w / 2, b.h / 2, b.d / 2);
    for (const b of PLATFORMS) {
      const c = addStatic(b.x, b.y + b.h / 2, b.z, b.w / 2, b.h / 2, b.d / 2);
      this.platformTops.set(c.handle, b.y + b.h);
    }

    this.kcc = this.world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.setMaxSlopeClimbAngle((50 * Math.PI) / 180);
    this.kcc.enableSnapToGround(0.25);
    this.kcc.setApplyImpulsesToDynamicBodies(false);

    this.ray = new R.Ray({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 });
    // One step builds the broad phase so scene queries can see the static colliders.
    this.world.step();
  }

  /** Create a capsule collider for an actor and return its handle (store it in `actor.body`). */
  createActor(radius: number, height: number): number {
    const halfHeight = Math.max(0.01, height / 2 - radius);
    const c = this.world.createCollider(this.R.ColliderDesc.capsule(halfHeight, radius).setCollisionGroups(ACTOR_GROUPS));
    this.actors.set(c.handle, c);
    return c.handle;
  }

  resizeActor(handle: number, radius: number, height: number) {
    const c = this.actors.get(handle);
    if (!c) return;
    c.setRadius(radius);
    c.setHalfHeight(Math.max(0.01, height / 2 - radius));
  }

  removeActor(handle: number) {
    const c = this.actors.get(handle);
    if (!c) return;
    this.world.removeCollider(c, false);
    this.actors.delete(handle);
  }

  /**
   * Move an actor by (dx, dy, dz) with collision against the street, cover and platforms.
   * Writes the resolved position back into the actor. The returned object is reused — don't keep it.
   */
  moveActor(a: Actor, dx: number, dy: number, dz: number, mode: PlatformMode): MoveResult {
    const c = this.actors.get(a.body);
    const res = this.result;
    if (!c) {
      a.x += dx;
      a.y += dy;
      a.z += dz;
      res.grounded = false;
      res.hitCeiling = false;
      return res;
    }
    // Sync first: the sim may have teleported the actor (clamping, knock-outs, spawning).
    c.setTranslation({ x: a.x, y: a.y + a.height / 2, z: a.z });
    this.queryFeetY = a.y;
    this.queryMode = mode;
    this.kcc.computeColliderMovement(c, { x: dx, y: dy, z: dz }, undefined, QUERY_GROUPS, this.predicate);
    const m = this.kcc.computedMovement();
    a.x += m.x;
    a.y += m.y;
    a.z += m.z;
    c.setTranslation({ x: a.x, y: a.y + a.height / 2, z: a.z });
    res.grounded = this.kcc.computedGrounded();
    res.hitCeiling = dy > 0 && m.y < dy * 0.5;
    return res;
  }

  /** Distance along a unit direction to the first piece of static geometry, or null within `maxDist`. */
  raycastStatic(x: number, y: number, z: number, dx: number, dy: number, dz: number, maxDist: number): number | null {
    const ray = this.ray;
    ray.origin = { x, y, z };
    ray.dir = { x: dx, y: dy, z: dz };
    // One-way scaffolds are thin: shots pass through them (only cars, crates and the street block).
    const hit = this.world.castRay(ray, maxDist, true, undefined, QUERY_GROUPS, undefined, undefined, this.notPlatform);
    return hit ? hit.timeOfImpact : null;
  }

  dispose() {
    this.world.free();
  }
}
