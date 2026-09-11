import { createClient } from "@supabase/supabase-js";
import { parseStore } from "./persistence";
import type { Store } from "./game";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const cloud = url && key ? createClient(url, key) : null;
export async function uploadProgress(store: Store) {
  if (!cloud) throw Error("Sincronización no configurada");
  const {
    data: { user },
  } = await cloud.auth.getUser();
  if (!user) throw Error("Inicia sesión primero");
  const { error } = await cloud
    .from("geora_progress")
    .upsert({
      user_id: user.id,
      payload: store,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}
export async function downloadProgress() {
  if (!cloud) throw Error("Sincronización no configurada");
  const {
    data: { user },
  } = await cloud.auth.getUser();
  if (!user) throw Error("Inicia sesión primero");
  const { data, error } = await cloud
    .from("geora_progress")
    .select("payload")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw Error("Todavía no hay progreso guardado en tu cuenta.");
  return parseStore(JSON.stringify(data.payload));
}
