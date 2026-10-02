"use client";

import { Component, Suspense, type ReactNode, type RefObject } from "react";
import type { ModelId } from "@/game/core/types";
import { useGameStore } from "@/game/store";
import type { AnimState } from "./anim";
import { GltfCharacter } from "./GltfCharacter";
import { HeroCharacter } from "./HeroCharacter";
import { PlaceholderCharacter } from "./PlaceholderCharacter";

/** If a model file is broken, keep playing with the placeholder instead of crashing the scene. */
class ModelErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn("[Alien Shift] Could not load character model, using placeholder:", error);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * THE character interface: give it a form and a live AnimState ref.
 * If /public/models/<form>.glb exists (listed in models/manifest.json) the real model is used,
 * otherwise the procedural placeholder — no code changes needed to swap in real art.
 */
export function CharacterModel({ form, state }: { form: ModelId; state: RefObject<AnimState> }) {
  const models = useGameStore((s) => s.models);
  const placeholder = <PlaceholderCharacter form={form} state={state} />;
  // Kai always uses the bundled realistic hero (falls back to the placeholder if it can't load).
  if (form === "human") {
    return (
      <ModelErrorBoundary key="hero" fallback={placeholder}>
        <Suspense fallback={placeholder}>
          <HeroCharacter state={state} />
        </Suspense>
      </ModelErrorBoundary>
    );
  }
  if (!models?.includes(form)) return placeholder;
  return (
    <ModelErrorBoundary key={form} fallback={placeholder}>
      <Suspense fallback={placeholder}>
        <GltfCharacter form={form} state={state} />
      </Suspense>
    </ModelErrorBoundary>
  );
}
