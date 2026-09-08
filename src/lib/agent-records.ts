import { z } from "zod";
import { schemas, type EntityName } from "./registry";
export const RecordChange = z.object({ action: z.enum(["create", "update", "delete"]), entity: z.string().refine((v) => Object.hasOwn(schemas, v), "Unknown collection"), id: z.string().optional(), ref: z.string().regex(/^[a-z][a-z0-9_]{0,30}$/).optional(), fields: z.record(z.unknown()).default({}) }).strict();
export const RecordBatch = z.array(RecordChange).min(1).max(20);
function describe(schema: z.ZodTypeAny): unknown {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodDefault) return describe(schema._def.innerType);
  if (schema instanceof z.ZodEffects) return describe(schema._def.schema);
  if (schema instanceof z.ZodPipeline) return describe(schema._def.out);
  if (schema instanceof z.ZodEnum) return { enum: schema.options };
  if (schema instanceof z.ZodArray) return { arrayOf: describe(schema.element) };
  if (schema instanceof z.ZodUnion) return { anyOf: schema.options.map(describe) };
  if (schema instanceof z.ZodString) return "string";
  if (schema instanceof z.ZodNumber) return "number";
  if (schema instanceof z.ZodBoolean) return "boolean";
  return "value";
}
export function recordFields(entity: string) {
  if (!Object.hasOwn(schemas, entity)) throw new Error("Unknown collection");
  return { entity, fields: Object.fromEntries(Object.entries(schemas[entity as EntityName].shape).map(([key, value]) => [key, { required: !value.isOptional(), type: describe(value) }])), instructions: "Use only these editable fields. Updates need an ID from find_records. For related new rows in one batch, assign ref to an earlier create and use @ref:name only in foreign-key fields. Dates YYYY-MM-DD, local appointments YYYY-MM-DDTHH:mm, completedAt ISO timestamp. Notifications are in-app alerts; use tasks/touchpoints for due-date reminders. Settings only supports updating the existing profile, not creation/deletion or credentials." };
}
