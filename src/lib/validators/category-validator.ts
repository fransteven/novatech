import { z } from "zod";

export const categoryAttributeSchema = z.object({
  key: z
    .string()
    .min(1, "Key is required")
    .regex(
      /^[a-z0-9_]+$/,
      "Key must use lowercase letters, numbers and underscores only",
    ),
  label: z.string().min(1, "Label is required"),
  type: z.enum(["text", "number", "select"]),
  options: z.array(z.string()).optional(), // Only for select
});

export const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  template: z.array(categoryAttributeSchema),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryAttribute = z.infer<typeof categoryAttributeSchema>;

/** Type guard para `categories.template` (jsonb). */
export const isCategoryTemplate = (value: unknown): value is CategoryAttribute[] =>
  Array.isArray(value) &&
  value.every(
    (attribute) =>
      typeof attribute === "object" &&
      attribute !== null &&
      typeof attribute.key === "string" &&
      typeof attribute.label === "string" &&
      typeof attribute.type === "string",
  );
