import type maplibregl from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import { TRAIL_MAX_POINTS, TRAIL_SAMPLE_MS } from "../config";
import { isTrailsEnabled } from "../state/filterState";
import type { Vehicle } from "../types/vehicle";
import { TRAIL_SOURCE_ID, VEHICLE_SOURCE_ID } from "./vehicleLayer";

interface AnimatedVehicle {
  vehicle: Vehicle;
  /** Displayed position when the latest report arrived (animation start) */
  from: [number, number];
  /** Latest reported position (animation target) */
  to: [number, number];
  /** Degrees per ms, derived from the two most recent reports */
  velocity: [number, number];
  ingestedAt: number;
  lastSeen: number;
  /** Recent displayed positions, oldest first (the motion trail) */
  trail: [number, number][];
  lastTrailSample: number;
}

// Teleport instead of gliding when a report jumps further than this (~500 m);
// glides across town look worse than a snap when estimates get corrected
const SNAP_DISTANCE_DEG = 0.005;
// After reaching the target, keep drifting along the velocity vector for at
// most this fraction of the poll interval while waiting for the next report
const MAX_EXTRAPOLATION_FACTOR = 0.75;
// Drop vehicles that haven't appeared in a response for this many intervals
const STALE_INTERVALS = 3;

export class VehicleAnimator {
  private vehicles = new Map<string, AnimatedVehicle>();
  private frame: number | null = null;

  constructor(
    private map: maplibregl.Map,
    private intervalMs: number,
  ) {}

  ingest(list: Vehicle[]): void {
    const now = performance.now();
    for (const v of list) {
      const reported: [number, number] = [v.lon, v.lat];
      const existing = this.vehicles.get(v.id);
      if (!existing) {
        this.vehicles.set(v.id, {
          vehicle: v,
          from: reported,
          to: reported,
          velocity: [0, 0],
          ingestedAt: now,
          lastSeen: now,
          trail: [],
          lastTrailSample: now,
        });
        continue;
      }
      const displayed = this.displayedPosition(existing, now);
      const dt = now - existing.ingestedAt;
      const jumped =
        Math.abs(reported[0] - displayed[0]) > SNAP_DISTANCE_DEG ||
        Math.abs(reported[1] - displayed[1]) > SNAP_DISTANCE_DEG;
      existing.vehicle = v;
      existing.velocity =
        dt > 0 && !jumped
          ? [
              (reported[0] - existing.to[0]) / dt,
              (reported[1] - existing.to[1]) / dt,
            ]
          : [0, 0];
      existing.from = jumped ? reported : displayed;
      existing.to = reported;
      existing.ingestedAt = now;
      existing.lastSeen = now;
      // A teleport would otherwise leave a streak across the map
      if (jumped) existing.trail = [];
    }

    const staleBefore = now - this.intervalMs * STALE_INTERVALS;
    for (const [id, av] of this.vehicles) {
      if (av.lastSeen < staleBefore) this.vehicles.delete(id);
    }
  }

  /** Immediately drop vehicles matching the predicate (zoom-outs, filter changes) */
  removeWhere(pred: (v: Vehicle) => boolean): void {
    for (const [id, av] of this.vehicles) {
      if (pred(av.vehicle)) this.vehicles.delete(id);
    }
  }

  start(): void {
    if (this.frame !== null) return;
    const tick = () => {
      this.render();
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  stop(): void {
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame);
      this.frame = null;
    }
  }

  private displayedPosition(
    av: AnimatedVehicle,
    now: number,
  ): [number, number] {
    const t = (now - av.ingestedAt) / this.intervalMs;
    if (t <= 1) {
      return [
        av.from[0] + (av.to[0] - av.from[0]) * t,
        av.from[1] + (av.to[1] - av.from[1]) * t,
      ];
    }
    const extraMs = Math.min(t - 1, MAX_EXTRAPOLATION_FACTOR) * this.intervalMs;
    return [
      av.to[0] + av.velocity[0] * extraMs,
      av.to[1] + av.velocity[1] * extraMs,
    ];
  }

  private render(): void {
    const source = this.map.getSource<GeoJSONSource>(VEHICLE_SOURCE_ID);
    const trailSource = this.map.getSource<GeoJSONSource>(TRAIL_SOURCE_ID);
    if (!source) return;
    const now = performance.now();
    const features: GeoJSON.Feature[] = [];
    const trailFeatures: GeoJSON.Feature[] = [];
    for (const av of this.vehicles.values()) {
      const v = av.vehicle;
      const position = this.displayedPosition(av, now);
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: position },
        properties: {
          id: v.id,
          line: v.line,
          mode: v.mode,
          destination: v.destination,
          bg_color: v.bg_color,
          fg_color: v.fg_color,
        },
      });

      if (!isTrailsEnabled()) {
        if (av.trail.length) av.trail = [];
      } else if (now - av.lastTrailSample >= TRAIL_SAMPLE_MS) {
        av.trail.push(position);
        av.lastTrailSample = now;
        if (av.trail.length > TRAIL_MAX_POINTS) av.trail.shift();
      }
      if (av.trail.length >= 2) {
        // The current position closes the trail so it hugs the moving dot
        trailFeatures.push({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [...av.trail, position],
          },
          properties: { bg_color: v.bg_color },
        });
      }
    }
    source.setData({ type: "FeatureCollection", features });
    trailSource?.setData({ type: "FeatureCollection", features: trailFeatures });
  }
}
