import "server-only";
import { customAlphabet } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_OWNED_CLASSES = 5;
export const MAX_JOINED_CLASSES = 5;
export const MAX_CLASS_NAME = 60;

// Eight lowercase letters and digits, from nanoid's CSPRNG — unguessable is
// the only access control on a class link, so this is deliberately not
// derived from the name, the owner or the time. 36^8 is ~2.8e12; a code is
// not a secret worth brute-forcing for a list of first names and ticks, but
// it should not be walkable either.
const CODE_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const makeCode = customAlphabet(CODE_ALPHABET, 8);

export function newClassCode(): string {
  return makeCode();
}

// Codes are matched case-insensitively at the edges (a student typing one
// off a whiteboard will capitalise it) but stored lowercase.
export function normaliseClassCode(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export interface ClassSummary {
  id: string;
  code: string;
  name: string;
  memberCount: number;
}

// Classes this user owns, with member counts. Owner-only data — a member
// gets the far smaller `getJoinedClasses` below.
export async function getOwnedClasses(
  admin: SupabaseClient,
  userId: string
): Promise<ClassSummary[]> {
  const { data: owned } = await admin
    .from("classes")
    .select("id, code, name")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true });
  const rows = owned ?? [];
  if (rows.length === 0) return [];

  const { data: members } = await admin
    .from("class_members")
    .select("class_id")
    .in(
      "class_id",
      rows.map((r) => r.id as string)
    );
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    const id = m.class_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return rows.map((r) => ({
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    memberCount: counts.get(r.id as string) ?? 0,
  }));
}

export interface JoinedClass {
  id: string;
  name: string;
  memberCount: number;
}

// A member sees the class name and how many people are in it. Nothing
// about who they are — that is the teacher's view, not a class roster.
export async function getJoinedClasses(
  admin: SupabaseClient,
  userId: string
): Promise<JoinedClass[]> {
  const { data: memberships } = await admin
    .from("class_members")
    .select("class_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true });
  const rows = memberships ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.class_id as string);
  const [{ data: classRows }, { data: allMembers }] = await Promise.all([
    admin.from("classes").select("id, name").in("id", ids),
    admin.from("class_members").select("class_id").in("class_id", ids),
  ]);

  const nameById = new Map((classRows ?? []).map((c) => [c.id as string, c.name as string]));
  const counts = new Map<string, number>();
  for (const m of allMembers ?? []) {
    const id = m.class_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return ids.map((id) => ({
    id,
    name: nameById.get(id) ?? "A class",
    memberCount: counts.get(id) ?? 0,
  }));
}
