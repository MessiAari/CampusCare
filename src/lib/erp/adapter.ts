import "server-only";
import bcrypt from "bcryptjs";
import { serviceDb } from "../supabase/service";

/**
 * The ERP only answers one question: "is this a real, enrolled student?"
 * It is never told what happens next, so it cannot learn who filed a report.
 * To plug in a real college ERP, implement this interface and return it from getErpAdapter().
 */
export interface ErpAdapter {
  verify(rollNo: string, password: string): Promise<{ ok: boolean; rollNo?: string }>;
}

export class MockErpAdapter implements ErpAdapter {
  async verify(rollNo: string, password: string) {
    const roll = rollNo.trim().toUpperCase();
    const { data } = await serviceDb()
      .from("erp_students")
      .select("roll_no, password_hash")
      .eq("roll_no", roll)
      .maybeSingle();
    if (!data) return { ok: false };
    const ok = await bcrypt.compare(password, data.password_hash);
    return ok ? { ok: true, rollNo: data.roll_no as string } : { ok: false };
  }
}

export function getErpAdapter(): ErpAdapter {
  return new MockErpAdapter();
}
