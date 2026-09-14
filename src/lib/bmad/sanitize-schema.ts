import { defaultSchema } from "rehype-sanitize";

export const bmadSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "details", "summary"],
  attributes: {
    ...defaultSchema.attributes,
    code: ["className"],
    img: [
      ...(defaultSchema.attributes?.img ?? [
        "alt",
        "src",
        "longDesc",
        "title",
        "width",
        "height",
      ]),
      "className",
      "loading",
    ],
  },
  protocols: {
    ...defaultSchema.protocols,
    src: ["http", "https", "data"],
  },
} as const;
