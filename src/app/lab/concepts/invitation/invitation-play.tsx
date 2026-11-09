"use client";

import { Day } from "@/features/day/day";
import type { DayRequest } from "@/lib/schema/itinerary.schema";

interface InvitationPlayProps {
  theme: "light" | "dark";
  request: DayRequest;
}

/** The day written from its request, in one theme, as its own address writes it. */
export function InvitationPlay({ theme, request }: InvitationPlayProps) {
  return (
    <div data-theme={theme} className="min-h-screen bg-ground text-ink">
      {/* The day holds its own main, with the page's last line after it. */}
      <Day first={request} />
    </div>
  );
}
