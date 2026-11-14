"use client";

import {
  animate,
  motionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
  type MotionValue,
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  SPRINGS,
  physicsOf,
  springOver,
  type PhysicalSpringOptions,
  type SpringName,
  type SpringOptions,
} from "@/lib/tokens/motion";

/**
 * A number that springs to each new target, on `layout` unless another spring is named or
 * given, as one the tokens derive (`gentleOver`), for a value that redraws a whole drawing,
 * such as the end of the chart's frame. It starts at `from`, as a frame taken over from
 * another day does, and springs from there to its first target. With reduced motion it is
 * the target.
 */
export function useSprung(
  target: number,
  from: number = target,
  spring: SpringName | SpringOptions = "layout",
): number {
  const isReducedMotion = useReducedMotion() ?? false;
  const [value, setValue] = useState(from);
  const current = useRef(from);
  const { visualDuration, bounce } = typeof spring === "string" ? SPRINGS[spring] : spring;

  useEffect(() => {
    if (isReducedMotion) return undefined;
    const controls = animate(current.current, target, {
      type: "spring",
      visualDuration,
      bounce,
      onUpdate: (next) => {
        current.current = next;
        setValue(next);
      },
    });
    return () => controls.stop();
    // By its numbers, so a spring worked out again each render goes on without restarting.
  }, [target, isReducedMotion, visualDuration, bounce]);

  return isReducedMotion ? target : value;
}

/** One number of a set, and where it was last sent. */
interface Spring {
  value: MotionValue<number>;
  target: number;
  controls: AnimationPlaybackControls | null;
}

/**
 * Each spring from SPRINGS as stiffness and damping, by name (`physicsOf`): Motion starts a
 * spring set by its duration from rest whatever its value was doing, and one set by its
 * physics at the speed the value has, so only this one carries a number on when it is sent
 * somewhere new.
 */
const PHYSICS = {
  snappy: physicsOf(SPRINGS.snappy),
  layout: physicsOf(SPRINGS.layout),
  gentle: physicsOf(SPRINGS.gentle),
  brisk: physicsOf(SPRINGS.brisk),
} as const satisfies Record<SpringName, PhysicalSpringOptions>;

/** No spring named, one array for every set that moves on `layout` alone. */
const ALL_LAYOUT: readonly SpringName[] = [];

function springAt(target: number): Spring {
  return { value: motionValue(target), target, controls: null };
}

/**
 * Numbers that spring to each new set of targets, for values drawn together, such as the
 * rows' wires and words when a row above them grows: numbers sent alike at the same moment
 * move as one. Each moves on the spring `kinds` names for it, `layout` where none is named,
 * and keeps its own, so a number sent somewhere new on its way carries on at the speed it had
 * rather than setting off again from rest, and one whose target is unchanged keeps going as
 * it was. A number new to the set starts at its target rather than springing in from
 * elsewhere. While `isImmediate`, as when a whole set is first placed and measured, every
 * number is its target and nothing springs. With reduced motion they are the targets.
 *
 * Each number is known by its key, its place in the set unless `keys` names it, so a number
 * that moves to another place in the set, as a row does when the one above it gives way,
 * keeps its own spring there, and a new number in a place another left starts at its target
 * rather than taking over the spring of the one it replaced. With `reachPx`, a number sent
 * further than that goes there no faster than its spring carries it over that far. With
 * `together`, every number sent somewhere new goes on that one spring instead, whatever its
 * kind and however far it goes, so numbers set off at one moment move as one and come to rest
 * together.
 */
export function useSprungAll(
  targets: readonly number[],
  isImmediate: boolean = false,
  kinds: readonly SpringName[] = ALL_LAYOUT,
  keys?: readonly string[],
  reachPx?: number,
  together?: SpringOptions & { restDelta?: number },
): readonly number[] {
  const isReducedMotion = useReducedMotion() ?? false;
  const isAtOnce = isReducedMotion || isImmediate;
  const names = keys ?? targets.map((_, index) => String(index));
  // Tenths of a pixel are below what a screen draws, and keep the key steady.
  const key = JSON.stringify([targets.map((target) => Math.round(target * 10) / 10), names]);
  const [values, setValues] = useState<ReadonlyMap<string, number>>(NO_VALUES);
  const springs = useRef(new Map<string, Spring>());
  // The springs as last named, for the numbers sent somewhere new.
  const latestKinds = useRef(kinds);
  const latestReach = useRef(reachPx);
  const latestTogether = useRef(together);
  useLayoutEffect(() => {
    latestKinds.current = kinds;
    latestReach.current = reachPx;
    latestTogether.current = together;
  });
  const show = useCallback(
    () =>
      setValues(
        new Map([...springs.current].map(([name, spring]) => [name, spring.value.get()] as const)),
      ),
    [],
  );

  useEffect(() => {
    const [to, toNames] = JSON.parse(key) as [number[], string[]];
    const all = springs.current;
    // Numbers that leave the set stop with it, so a set that shrinks and grows again starts
    // its new numbers at their targets.
    let isPlacedAtOnce = false;
    for (const [name, spring] of all) {
      if (toNames.includes(name)) continue;
      spring.controls?.stop();
      all.delete(name);
      isPlacedAtOnce = true;
    }
    to.forEach((target, index) => {
      const name = toNames[index] ?? String(index);
      const spring = all.get(name);
      if (!spring || isAtOnce) {
        spring?.controls?.stop();
        all.set(name, springAt(target));
        isPlacedAtOnce = true;
      } else if (spring.target !== target) {
        // A value already on its way sets off from the speed it has there, read before the
        // new spring starts: starting it stops the one under way, and the speed with it.
        const velocity = spring.value.getVelocity();
        const kind = latestKinds.current[index] ?? "layout";
        const reach = latestReach.current;
        const distance = target - spring.value.get();
        const shared = latestTogether.current;
        const physics =
          shared !== undefined
            ? physicsOf(shared)
            : reach === undefined
              ? PHYSICS[kind]
              : physicsOf(springOver(SPRINGS[kind], distance, reach));
        const controls = animate(spring.value, target, {
          ...physics,
          velocity,
          onUpdate: show,
        });
        all.set(name, { ...spring, target, controls });
      }
    });
    if (isPlacedAtOnce) show();
  }, [key, isAtOnce, show]);

  // Stopped and forgotten when the set goes, so a set shown again (Fast Refresh, a hidden
  // Activity shown again) starts at its targets rather than holding numbers stopped mid-way.
  useEffect(() => {
    const all = springs.current;
    return () => {
      all.forEach((spring) => spring.controls?.stop());
      all.clear();
    };
  }, []);

  if (isAtOnce) return targets;
  return targets.map((target, index) => values.get(names[index] ?? String(index)) ?? target);
}

/** No number drawn yet: each is its target until its spring has been set. */
const NO_VALUES: ReadonlyMap<string, number> = new Map();
