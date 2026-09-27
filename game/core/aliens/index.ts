import type { FormId } from "../types";
import { behemoth } from "./behemoth";
import { blaze } from "./blaze";
import { bolt } from "./bolt";
import { frostbyte } from "./frostbyte";
import { gravix } from "./gravix";
import { human } from "./human";
import type { AlienKit } from "./kit";
import { nanotek } from "./nanotek";
import { phantom } from "./phantom";
import { shard } from "./shard";
import { thornback } from "./thornback";
import { titan } from "./titan";

export type { AlienKit } from "./kit";

/** Every form's moves. Add new aliens here. */
export const KITS: Record<FormId, AlienKit> = { human, blaze, titan, bolt, shard, gravix, frostbyte, thornback, phantom, behemoth, nanotek };
