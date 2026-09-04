import { NextResponse } from "next/server";
import { checkAvailability } from "@/lib/availability";
import {
  availabilityArgumentsSchema,
  errorResult,
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
    toolCallId = toolCall.id;

    if (toolCall.name !== "check_availability") {
      return NextResponse.json(
        errorResult(toolCallId, `Unsupported tool name: ${toolCall.name}.`),
        { status: 200 },
      );
    }

    const parsed = availabilityArgumentsSchema.safeParse(toolCall.arguments);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
        .join(", ");
      return NextResponse.json(
        errorResult(toolCallId, `Invalid availability request: ${details}.`),
        { status: 200 },
      );
    }

    const result = await checkAvailability(parsed.data);

    if (result.available && result.table) {
      const area = parsed.data.seating_preference === "no_preference"
        ? `in the ${result.table.area} dining area`
        : `in the requested ${result.table.area} dining area`;
      return NextResponse.json(
        successResult(
          toolCallId,
          `The requested reservation is available at ${parsed.data.preferred_time} for ${parsed.data.party_size} guests ${area}. You may continue collecting the guest details, but do not say the reservation is confirmed until create_reservation succeeds.`,
        ),
        { status: 200 },
      );
    }

    if (result.reason === "past_date") {
      return NextResponse.json(
        successResult(toolCallId, "The requested date is in the past. Ask the guest for a future date."),
        { status: 200 },
      );
    }

    if (result.reason === "party_too_large") {
      return NextResponse.json(
        successResult(toolCallId, "This party size is larger than the automated booking limit. Explain that the restaurant team will assist with the request."),
        { status: 200 },
      );
    }

    if (result.alternatives.length > 0) {
      return NextResponse.json(
        successResult(
          toolCallId,
          `The requested time is not available. The closest available alternatives are ${result.alternatives.join(", ")}. Offer only these times to the guest.`,
        ),
        { status: 200 },
      );
    }

    return NextResponse.json(
      successResult(
        toolCallId,
        "No suitable table is available for the requested date, party size, and seating preference. Ask whether the guest would like another date or seating preference.",
      ),
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("check_availability failed", error);
    return NextResponse.json(
      errorResult(toolCallId, `Availability could not be checked: ${message}`),
      { status: 200 },
    );
  }
}
