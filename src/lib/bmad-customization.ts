import { parse, type TomlValue } from "smol-toml";
function table(
  value: TomlValue | undefined,
): value is Record<string, TomlValue> {
  return (
    !!value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    !(value instanceof Date) &&
    !("toISOString" in value)
  );
}
export function mergeCustomization(
  base: Record<string, TomlValue>,
  override: Record<string, TomlValue>,
): Record<string, TomlValue> {
  const result = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const before = result[key];
    if (table(before) && table(value))
      result[key] = mergeCustomization(before, value);
    else if (Array.isArray(before) && Array.isArray(value)) {
      const keyed =
        value.length > 0 &&
        value.every((item) => table(item) && ("code" in item || "id" in item));
      if (keyed) {
        const combined = [...before];
        for (const item of value) {
          const entry = item as Record<string, TomlValue>;
          const field = "code" in entry ? "code" : "id";
          const index = combined.findIndex(
            (existing) => table(existing) && existing[field] === entry[field],
          );
          if (index < 0) combined.push(item);
          else combined[index] = item;
        }
        result[key] = combined;
      } else result[key] = [...before, ...value];
    } else result[key] = value;
  }
  return result;
}
export function effectivePersona(
  schema: string | null,
  legacy: string | null,
  team: string,
  personal: string,
) {
  let result = schema ? parse(schema) : {};
  if (legacy) {
    result = mergeCustomization(result, { agent: { identity: legacy } });
  }
  for (const content of [team, personal])
    if (content.trim()) result = mergeCustomization(result, parse(content));
  const agent = result.agent as Record<string, TomlValue> | undefined;
  if (!agent) return legacy;
  const parts = [
    agent.role,
    agent.identity,
    agent.communication_style,
    ...(Array.isArray(agent.principles) ? agent.principles : []),
    ...(Array.isArray(agent.persistent_facts) ? agent.persistent_facts : []),
  ].filter((v) => typeof v === "string");
  return parts.length ? parts.join("\n") : legacy;
}
