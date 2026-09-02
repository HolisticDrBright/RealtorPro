import { inbox, syncCalendar } from "@/services/google";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Force a refresh of the calendar mirror and the inbox snapshot. */
export async function POST() {
  try {
    const calendar = await syncCalendar(true);
    const mail = await inbox(true);
    return ok({ calendar, inbox: mail.length });
  } catch (err) { return errorResponse(err); }
}
