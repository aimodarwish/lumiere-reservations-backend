import { z } from "zod";

export const availabilityArgumentsSchema = z.object({
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  party_size: z.number().int().min(1).max(8),
  seating_preference: z.enum(["indoor", "terrace", "no_preference"]),
});

export const createReservationArgumentsSchema = z.object({
  guest_name: z.string().trim().min(2).max(120),
  reservation_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reservation_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  party_size: z.number().int().min(1).max(8),
  seating_preference: z.enum(["indoor", "terrace", "no_preference"]),
  occasion: z.string().max(200),
  dietary_requirements: z.string().max(500),
  special_requests: z.string().max(500),
});

export type AvailabilityArguments = z.infer<typeof availabilityArgumentsSchema>;
export type CreateReservationArguments = z.infer<typeof createReservationArgumentsSchema>;

type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : null;
}

export function extractToolCall(body: unknown): {
  id: string;
  name: string;
  arguments: unknown;
} {
  const root = asRecord(body);
  const message = asRecord(root?.message);

  const directList = Array.isArray(message?.toolCallList) ? message.toolCallList : [];
  const direct = asRecord(directList[0]);

  if (direct && typeof direct.id === "string" && typeof direct.name === "string") {
    return {
      id: direct.id,
      name: direct.name,
      arguments: direct.arguments ?? direct.parameters,
    };
  }

  const wrappedList = Array.isArray(message?.toolWithToolCallList)
    ? message.toolWithToolCallList
    : [];
  const wrapped = asRecord(wrappedList[0]);
  const toolCall = asRecord(wrapped?.toolCall);
  const fn = asRecord(toolCall?.function);

  if (toolCall && typeof toolCall.id === "string") {
    const name =
      (typeof wrapped?.name === "string" && wrapped.name) ||
      (fn && typeof fn.name === "string" ? fn.name : "");
    const parameters = toolCall.parameters ?? fn?.parameters ?? fn?.arguments;
    if (name) return { id: toolCall.id, name, arguments: parameters };
  }

  throw new Error("No Vapi tool call was found in the request body.");
}

export function extractCallContext(body: unknown): {
  customerPhone: string | null;
  vapiCallId: string | null;
} {
  const root = asRecord(body);
  const message = asRecord(root?.message);
  const call = asRecord(message?.call);
  const customer = asRecord(message?.customer) ?? asRecord(call?.customer);

  const customerPhone =
    (typeof customer?.number === "string" && customer.number) ||
    (typeof root?.customer_phone === "string" && root.customer_phone) ||
    null;
  const vapiCallId =
    (typeof call?.id === "string" && call.id) ||
    (typeof root?.vapi_call_id === "string" && root.vapi_call_id) ||
    null;

  return { customerPhone, vapiCallId };
}

export function successResult(toolCallId: string, result: string) {
  return {
    results: [{ toolCallId, result: result.replace(/[\r\n]+/g, " ").trim() }],
  };
}

export function errorResult(toolCallId: string, error: string) {
  return {
    results: [{ toolCallId, error: error.replace(/[\r\n]+/g, " ").trim() }],
  };
}
