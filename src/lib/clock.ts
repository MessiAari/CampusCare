import "server-only";
import { serviceDb } from "./supabase/service";
import { isDemo } from "./demo";

/** Demo clock: real time plus an offset that the demo controls can move forward. */
export async function getOffsetMs(): Promise<number> {
  if (!isDemo()) return 0;
  const { data } = await serviceDb().from("app_settings").select("value").eq("key", "clock_offset").maybeSingle();
  return Number(data?.value?.ms ?? 0) || 0;
}

export async function setOffsetMs(ms: number) {
  await serviceDb().from("app_settings").upsert({ key: "clock_offset", value: { ms } });
}

export async function now(): Promise<Date> {
  return new Date(Date.now() + (await getOffsetMs()));
}
