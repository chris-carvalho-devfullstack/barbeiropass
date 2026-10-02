export const runtime = "edge";

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  consumePublicRateLimit,
  publicSlugSchema,
  resolvePublicBarbershop,
} from "@/app/api/public/_shared";

const verifyPinSchema = z.object({
  slug: publicSlugSchema,
  pin: z.string().trim().regex(/^\d{4,8}$/, "PIN invÃ¡lido."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = verifyPinSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: "Dados invÃ¡lidos." }, { status: 400 });
    }

    const admin = createAdminClient();
    const withinLimit = await consumePublicRateLimit(
      admin,
      request,
      "public_verify_pin",
      parsed.data.slug,
      5,
      10 * 60
    );
    if (!withinLimit) {
      return NextResponse.json(
        { success: false, error: "Muitas tentativas. Tente mais tarde." },
        { status: 429 }
      );
    }

    const barbershop = await resolvePublicBarbershop(admin, parsed.data.slug);
    if (!barbershop) {
      return NextResponse.json({ success: false, error: "CÃ³digo incorreto." }, { status: 400 });
    }

    const { data, error } = await admin
      .from("barbershops")
      .select("checkin_pin")
      .eq("id", barbershop.id)
      .maybeSingle();
    if (error) throw new Error("NÃ£o foi possÃ­vel validar o PIN.");

    return NextResponse.json({ success: data?.checkin_pin === parsed.data.pin });
  } catch (error) {
    console.error("[PUBLIC_VERIFY_PIN]", error);
    return NextResponse.json(
      { success: false, error: "NÃ£o foi possÃ­vel validar o PIN." },
      { status: 500 }
    );
  }
}
