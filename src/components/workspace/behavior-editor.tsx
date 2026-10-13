"use client";
import {
  Stack,
  Textarea,
  Button,
  Text,
  Accordion,
  Alert,
  TextInput,
  Select,
  Paper,
} from "@mantine/core";
import type { AgentBehavior, CustomizationState } from "@/lib/agent-behavior";
const labels: Record<string, string> = {
  icon: "Activation icon",
  identity: "Identity and instructions",
  role: "Behavior role",
  communication_style: "Communication style",
  principles: "Principles",
  persistent_facts: "Persistent facts",
  activation_steps_prepend: "Before greeting",
  activation_steps_append: "After greeting",
  menu: "Menu actions (JSON)",
};
export function BehaviorEditor({
  state,
  scope,
  patch,
  reset,
  onChange,
  onReset,
  skills,
}: {
  state: CustomizationState;
  scope: string;
  patch: AgentBehavior;
  reset: string[];
  onChange: (
    key: keyof AgentBehavior,
    value: string | string[] | AgentBehavior["menu"],
  ) => void;
  onReset: (key: string) => void;
  skills: { name: string }[];
}) {
  const own = scope === "personal" ? state.personal : state.team;
  const fields = state.supported;
  return (
    <Stack>
      <Alert>
        Only edited fields are written. Empty overrides can be reset to inherit
        the installed or team setting.
      </Alert>
      {fields.map((key) => {
        const k = key as keyof AgentBehavior;
        const v = reset.includes(key) ? undefined : (patch[k] ?? own[k]);
        const inherited = state.effective[k];
        if (key === "menu")
          return (
            <MenuEditor
              key={key}
              value={
                (Array.isArray(v) ? v : []) as NonNullable<
                  AgentBehavior["menu"]
                >
              }
              skills={skills}
              onChange={(items) => onChange("menu", items)}
              onReset={() => onReset("menu")}
            />
          );
        return (
          <Stack gap="xs" key={key}>
            <Textarea
              label={labels[key] ?? key}
              description={
                "Current source: " +
                (state.origins[key] ?? "installed") +
                " · Editing " +
                scope +
                " override"
              }
              minRows={key === "identity" ? 5 : 2}
              autosize
              defaultValue={undefined}
              value={
                key === "menu"
                  ? JSON.stringify(v ?? [], null, 2)
                  : Array.isArray(v)
                    ? v.join("\n")
                    : String(v ?? "")
              }
              placeholder={
                Array.isArray(inherited)
                  ? inherited
                      .map((x) =>
                        typeof x === "string" ? x : JSON.stringify(x),
                      )
                      .join("\n")
                  : String(inherited ?? "Inherited setting")
              }
              onChange={(e) => {
                const text = e.currentTarget.value;
                if (key === "menu") {
                  try {
                    onChange(k, JSON.parse(text));
                  } catch {
                    onChange(k, text);
                  }
                } else
                  onChange(
                    k,
                    [
                      "principles",
                      "persistent_facts",
                      "activation_steps_prepend",
                      "activation_steps_append",
                    ].includes(key)
                      ? text.split("\n")
                      : text,
                  );
              }}
            />
            <Button
              variant="subtle"
              size="sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => onReset(key)}
            >
              Reset {labels[key] ?? key} override
            </Button>
          </Stack>
        );
      })}
      <Accordion>
        <Accordion.Item value="effective">
          <Accordion.Control>
            Installed, team, and personal settings
          </Accordion.Control>
          <Accordion.Panel>
            {(["base", "team", "personal"] as const).map((layer) => (
              <div key={layer}>
                <Text fw={600}>{layer === "base" ? "Installed" : layer}</Text>
                <pre style={{ overflow: "auto", fontSize: 14 }}>
                  {JSON.stringify(state[layer], null, 2)}
                </pre>
              </div>
            ))}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    </Stack>
  );
}

function MenuEditor({
  value,
  skills,
  onChange,
  onReset,
}: {
  value: NonNullable<AgentBehavior["menu"]>;
  skills: { name: string }[];
  onChange: (v: NonNullable<AgentBehavior["menu"]>) => void;
  onReset: () => void;
}) {
  const edit = (
    i: number,
    change: Partial<NonNullable<AgentBehavior["menu"]>[number]>,
  ) =>
    onChange(value.map((v, index) => (index === i ? { ...v, ...change } : v)));
  return (
    <Stack>
      <Text fw={600}>Menu action overrides</Text>
      <Text size="sm" c="dimmed">
        Add an action or use an installed action code to replace that entry.
        Installed entries remain inherited.
      </Text>
      {value.map((item, i) => (
        <Paper key={i} withBorder p="md">
          <Stack>
            <TextInput
              label="Action code"
              value={item.code}
              onChange={(e) => edit(i, { code: e.currentTarget.value })}
            />
            <TextInput
              label="Action description"
              value={item.description}
              onChange={(e) => edit(i, { description: e.currentTarget.value })}
            />
            <Select
              label="Action type"
              data={[
                { value: "skill", label: "Installed skill" },
                { value: "prompt", label: "Instructions" },
              ]}
              value={item.skill ? "skill" : "prompt"}
              onChange={(v) =>
                edit(
                  i,
                  v === "skill"
                    ? { skill: skills[0]?.name ?? "bmad", prompt: undefined }
                    : {
                        skill: undefined,
                        prompt: "Describe the intended result.",
                      },
                )
              }
            />
            {item.skill ? (
              <Select
                label="Skill"
                searchable
                data={skills.map((s) => s.name)}
                value={item.skill}
                onChange={(v) => edit(i, { skill: v ?? undefined })}
              />
            ) : (
              <Textarea
                label="Instructions"
                value={item.prompt ?? ""}
                onChange={(e) => edit(i, { prompt: e.currentTarget.value })}
              />
            )}
            <Button
              color="red"
              variant="subtle"
              onClick={() => onChange(value.filter((_, index) => index !== i))}
            >
              Remove this override
            </Button>
          </Stack>
        </Paper>
      ))}
      <Button
        variant="light"
        onClick={() => {
          let n = value.length + 1;
          while (value.some((v) => v.code === "CUSTOM-" + n)) n++;
          onChange([
            ...value,
            {
              code: "CUSTOM-" + n,
              description: "Project action",
              prompt: "Describe the intended result.",
            },
          ]);
        }}
      >
        Add menu action
      </Button>
      <Button variant="subtle" onClick={onReset}>
        Reset menu overrides
      </Button>
    </Stack>
  );
}
