import { z } from "zod";
import { parse } from "./toml";
import { type TomlValue } from "smol-toml";
import { mergeCustomization } from "./bmad-customization";
export const behaviorSchema = z
  .object({
    icon: z.string().min(1).max(32).optional(),
    role: z.string().max(8000).optional(),
    identity: z.string().max(8000).optional(),
    communication_style: z.string().max(8000).optional(),
    principles: z.array(z.string().max(2000)).max(100).optional(),
    persistent_facts: z.array(z.string().max(2000)).max(100).optional(),
    activation_steps_prepend: z.array(z.string().max(2000)).max(100).optional(),
    activation_steps_append: z.array(z.string().max(2000)).max(100).optional(),
    menu: z
      .array(
        z
          .object({
            code: z.string().min(1),
            description: z.string(),
            skill: z.string().optional(),
            prompt: z.string().optional(),
          })
          .refine((v) => !!v.skill !== !!v.prompt, "Choose skill or prompt"),
      )
      .max(100)
      .optional(),
  })
  .strict();
export type AgentBehavior = z.infer<typeof behaviorSchema>;
export type CustomizationState = {
  base: AgentBehavior;
  team: AgentBehavior;
  personal: AgentBehavior;
  effective: AgentBehavior;
  supported: string[];
  origins: Record<string, string>;
  legacy?: AgentBehavior;
};
export function customizationState(
  schema: string | null,
  team: string,
  personal: string,
  legacy: string | null = null,
): CustomizationState {
  const block = (text: string | null) =>
    text?.trim()
      ? ((parse(text).agent ?? {}) as Record<string, TomlValue>)
      : {};
  const base = block(schema),
    t = block(team),
    p = block(personal);
  const legacyLayer: Record<string, TomlValue> = legacy
    ? { identity: legacy }
    : {};
  const effective = mergeCustomization(
    mergeCustomization(mergeCustomization(base, legacyLayer), t),
    p,
  );
  const allowed = Object.keys(behaviorSchema.shape);
  const supported = allowed.filter(
    (k) => k in base || (!schema && k === "identity"),
  );
  const origins = Object.fromEntries(
    allowed
      .filter((k) => k in effective)
      .map((k) => [
        k,
        k in p
          ? "personal"
          : k in t
            ? "team"
            : k === "identity" && legacy
              ? "legacy Manager"
              : "installed",
      ]),
  );
  const select = (v: Record<string, TomlValue>) =>
    Object.fromEntries(
      Object.entries(v).filter(([k]) => allowed.includes(k)),
    ) as AgentBehavior;
  return {
    base: select(base),
    legacy: legacyLayer as AgentBehavior,
    team: select(t),
    personal: select(p),
    effective: select(effective),
    supported,
    origins,
  };
}
export function previewBehavior(
  state: CustomizationState,
  scope: string,
  patch: AgentBehavior,
  reset: string[] = [],
) {
  const own = {
    ...(scope === "personal" ? state.personal : state.team),
    ...patch,
  };
  for (const key of reset) delete own[key as keyof AgentBehavior];
  return mergeCustomization(
    mergeCustomization(
      mergeCustomization(
        state.base as Record<string, TomlValue>,
        (state.legacy as Record<string, TomlValue>) ?? {},
      ),
      (scope === "personal" ? state.team : own) as Record<string, TomlValue>,
    ),
    (scope === "personal" ? own : state.personal) as Record<string, TomlValue>,
  ) as AgentBehavior;
}
export function behaviorPrompt(behavior: AgentBehavior) {
  return [
    behavior.role,
    behavior.identity,
    behavior.communication_style,
    ...(behavior.principles ?? []),
    ...(behavior.persistent_facts ?? []),
  ]
    .filter(Boolean)
    .join("\n");
}
