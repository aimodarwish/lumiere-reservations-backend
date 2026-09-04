import { NextResponse } from "next/server";
import { createReservation } from "@/lib/reservations";
import {
  createReservationArgumentsSchema,
  errorResult,
  extractCallContext,
  extractToolCall,
  successResult,
} from "@/lib/vapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const expected = process.env.VAPI_WEBHOOK_SECRET;
  if (!expected || expected === "CHANGE_ME_TO_A_LONG_RANDOM_SECRET") return true;
  return request.headers.get("x-vapi-secret") === expected;
}

export async function POST(request: Request) {
  let toolCallId = "unknown-tool-call";

  try {
    if (!isAuthorized(request)) {
      return NextResponse.json(errorResult(toolCallId, "Unauthorized tool request."), { status: 200 });
    }

    const body: unknown = await request.json();
    const toolCall = extractToolCall(body);
    const callContext = extractCallContext(body);
    toolCallId = toolCall.id;

    if (toolCall.name !== "create_reservation") {
      return NextResponse.json(
        errorResult(toolCallId, `Unsupported tool name: ${toolCall.name}.`),
        { status: 200 },
      );
    }

    const parsed = createReservationArgumentsSchema.safeParse(toolCall.arguments);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
        .join(", ");
      return NextResponse.json(
        errorResult(toolCallId, `Invalid reservation request: ${details}.`),
        { status: 200 },
      );
    }

    const result = await createReservation(parsed.data, callContext);

    if (!result.success) {
      if (result.reason === "no_longer_available") {
        const alternatives = Array.isArray(result.alternatives) && result.alternatives.length
          ? ` The closest available alternatives are ${result.alternatives.join(", ")}.`
          : "";
        return NextResponse.json(
          successResult(
            toolCallId,
            `The selected table is no longer available and no reservation was created.${alternatives} Apologize briefly and ask the guest to choose another time.`,
          ),
          { status: 200 },
        );
      }

      return NextResponse.json(
        successResult(
          toolCallId,
          "The reservation could not be created. Do not tell the guest it is confirmed. Apologize and offer to try again.",
        ),
        { status: 200 },
      );
    }

    return NextResponse.json(
      successResult(
        toolCallId,
        `Reservation created successfully. The confirmation reference is ${result.confirmation_code}. The assigned dining area is ${result.seating_area}. You may now tell the guest that the reservation is confirmed and repeat the final details and confirmation reference.`,
      ),
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("create_reservation failed", error);
    return NextResponse.json(
      errorResult(toolCallId, `Reservation could not be created: ${message}`),
      { status: 200 },
    );
  }
}
