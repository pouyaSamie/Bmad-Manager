import { parse as parseNative, type TomlValue } from "smol-toml";
function plain(value: TomlValue): TomlValue {
  if (Array.isArray(value)) return value.map(plain);
  if (
    value &&
    typeof value === "object" &&
    !(value instanceof Date) &&
    !("toISOString" in value)
  )
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)]),
    );
  return value;
}
export function parse(content: string): Record<string, TomlValue> {
  return plain(parseNative(content.replace(/^\uFEFF/, ""))) as ReturnType<
    typeof parseNative
  >;
}
