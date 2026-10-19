// src/app/api/fila/metricas/configuracao/route.ts

import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const queueAcceptancePolicySchema = z.enum([
  "accept_until_closing",
  "restrict_by_capacity",
]);

const saveQueueSettingsSchema = z.object({
  defaultQueueDurationMinutes: z.number().int().min(1).max(480),
  queueAcceptancePolicy: queueAcceptancePolicySchema,
});

interface BarbershopMemberRow {
  barbershop_id: string;
  role: string;
}

interface QueueSettingsRow {
  default_queue_duration_minutes: number | null;
  queue_duration_configured: boolean | null;
  queue_acceptance_policy: string | null;
}

async function getAuthorizedBarbershop() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json(
        { error: "É necessário entrar na sua conta." },
        { status: 401 }
      ),
      barbershopId: null,
    };
  }

  // A consulta administrativa acontece somente após validar a sessão.
  const admin = createAdminClient();

  const { data: memberData, error: memberError } = await admin
    .from("barbershop_members")
    .select("barbershop_id, role")
    .eq("profile_id", user.id)
    .maybeSingle();

  const member = memberData as BarbershopMemberRow | null;

  if (memberError || !member) {
    return {
      response: NextResponse.json(
        { error: "Vínculo com a barbearia não encontrado." },
        { status: 403 }
      ),
      barbershopId: null,
    };
  }

  if (member.role !== "owner" && member.role !== "manager") {
    return {
      response: NextResponse.json(
        {
          error:
            "Somente o proprietário ou gerente pode alterar a configuração da fila.",
        },
        { status: 403 }
      ),
      barbershopId: null,
    };
  }

  return {
    response: null,
    barbershopId: member.barbershop_id,
  };
}

export async function GET() {
  try {
    const authorization = await getAuthorizedBarbershop();

    if (authorization.response || !authorization.barbershopId) {
      return (
        authorization.response ??
        NextResponse.json(
          { error: "Não foi possível identificar a barbearia." },
          { status: 403 }
        )
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("barbershop_settings")
      .select(
        "default_queue_duration_minutes, queue_duration_configured, queue_acceptance_policy"
      )
      .eq("barbershop_id", authorization.barbershopId)
      .maybeSingle();

    if (error) {
      console.error("[QUEUE_SETTINGS_GET]", error.message);

      return NextResponse.json(
        { error: "Não foi possível carregar a configuração do estimador." },
        { status: 500 }
      );
    }

    const settings = data as QueueSettingsRow | null;

    const queueAcceptancePolicy =
      settings?.queue_acceptance_policy === "accept_until_closing"
        ? "accept_until_closing"
        : "restrict_by_capacity";

    const savedDuration = Number(
      settings?.default_queue_duration_minutes
    );

    const hasValidSavedDuration =
      Number.isInteger(savedDuration) &&
      savedDuration >= 1 &&
      savedDuration <= 480;

    const queueDurationConfigured =
      settings?.queue_duration_configured === true &&
      hasValidSavedDuration;

    return NextResponse.json(
      {
        data: {
          defaultQueueDurationMinutes: queueDurationConfigured
            ? savedDuration
            : 20,
          queueDurationConfigured,
          queueAcceptancePolicy,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[QUEUE_SETTINGS_GET_UNEXPECTED]", error);

    return NextResponse.json(
      { error: "Erro inesperado ao carregar a configuração da fila." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const authorization = await getAuthorizedBarbershop();

    if (authorization.response || !authorization.barbershopId) {
      return (
        authorization.response ??
        NextResponse.json(
          { error: "Não foi possível identificar a barbearia." },
          { status: 403 }
        )
      );
    }

    const body = await request.json().catch(() => null);
    const validation = saveQueueSettingsSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error:
            "Configuração inválida. Informe um tempo inteiro entre 1 e 480 minutos e uma política válida.",
          details: validation.error.flatten(),
        },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("barbershop_settings")
      .upsert(
        {
          barbershop_id: authorization.barbershopId,
          default_queue_duration_minutes:
            validation.data.defaultQueueDurationMinutes,
          queue_duration_configured: true,
          queue_acceptance_policy:
            validation.data.queueAcceptancePolicy,
        },
        { onConflict: "barbershop_id" }
      )
      .select(
        "default_queue_duration_minutes, queue_duration_configured, queue_acceptance_policy"
      )
      .single();

    if (error || !data) {
      console.error(
        "[QUEUE_SETTINGS_PATCH]",
        error?.message ?? "Nenhuma linha retornada."
      );

      return NextResponse.json(
        { error: "Não foi possível salvar a configuração do estimador." },
        { status: 500 }
      );
    }

    const settings = data as QueueSettingsRow;

    return NextResponse.json({
      success: true,
      data: {
        defaultQueueDurationMinutes:
          settings.default_queue_duration_minutes ?? 20,
        queueDurationConfigured:
          settings.queue_duration_configured === true,
        queueAcceptancePolicy:
          settings.queue_acceptance_policy === "accept_until_closing"
            ? "accept_until_closing"
            : "restrict_by_capacity",
      },
    });
  } catch (error) {
    console.error("[QUEUE_SETTINGS_PATCH_UNEXPECTED]", error);

    return NextResponse.json(
      { error: "Erro inesperado ao salvar a configuração da fila." },
      { status: 500 }
    );
  }
}