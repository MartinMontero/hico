import * as v from 'valibot';
import { LIMITS } from './limits.ts';

// Request bodies of the staff API. Browser and Worker use the same schemas; lengths come from limits.ts.
// A staff-supplied string never carries verified_on or verified_by: those are set by the server only.

export const emailSchema = v.pipe(
  v.string(),
  v.trim(),
  v.toLowerCase(),
  v.maxLength(LIMITS.email),
  v.regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
);
export const displayNameSchema = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.person));
export const roleSchema = v.picklist(['editor', 'admin']);
export const tokenSchema = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{43}$/));
export const idSchema = v.pipe(v.string(), v.length(LIMITS.id), v.regex(/^[0-9a-f]+$/));
export const labelSchema = v.pipe(v.string(), v.trim(), v.maxLength(LIMITS.name));
const jsonObject = v.record(v.string(), v.unknown());

export const loginVerifySchema = v.strictObject({ challengeId: idSchema, response: jsonObject });
export const registerOptionsSchema = v.strictObject({ token: v.optional(tokenSchema) });
export const registerVerifySchema = v.strictObject({ challengeId: idSchema, response: jsonObject, label: v.optional(labelSchema) });
export const linkSchema = v.strictObject({ token: tokenSchema });
export const sessionRevokeSchema = v.strictObject({ handle: v.pipe(v.string(), v.length(12), v.regex(/^[0-9a-f]+$/)) });
export const credentialIdSchema = v.strictObject({ id: v.pipe(v.string(), v.minLength(1), v.maxLength(LIMITS.credentialId)) });
export const credentialRenameSchema = v.strictObject({
  id: v.pipe(v.string(), v.minLength(1), v.maxLength(LIMITS.credentialId)),
  label: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(LIMITS.name)),
});
export const inviteSchema = v.strictObject({ email: emailSchema, displayName: displayNameSchema, role: roleSchema });
export const roleChangeSchema = v.strictObject({ role: roleSchema });
