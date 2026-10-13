import { it, expect } from "vitest";
import { parse, stringify } from "smol-toml";
import { mergeCustomization, effectivePersona } from "../bmad-customization";
it("merges tables, appends facts, and replaces menu entries by code", () => {
  const result = mergeCustomization(
    {
      agent: {
        identity: "Default",
        persistent_facts: ["Team"],
        menu: [
          { code: "A", description: "Old" },
          { code: "B", description: "Keep" },
        ],
      },
    },
    {
      agent: {
        identity: "Override",
        persistent_facts: ["Personal"],
        menu: [
          { code: "A", description: "New" },
          { code: "C", description: "Add" },
        ],
      },
    },
  );
  expect(result.agent).toEqual({
    identity: "Override",
    persistent_facts: ["Team", "Personal"],
    menu: [
      { code: "A", description: "New" },
      { code: "B", description: "Keep" },
      { code: "C", description: "Add" },
    ],
  });
  expect(parse(stringify(result))).toEqual(result);
});
it("resolves native defaults and personal overrides without editing vendor files", () => {
  expect(
    effectivePersona(
      '[agent]\nrole="Developer"\nidentity="Baseline"\nprinciples=["Verify"]',
      null,
      '[agent]\nidentity="Team"',
      '[agent]\nidentity="Personal"',
    ),
  ).toBe("Developer\nPersonal\nVerify");
});
