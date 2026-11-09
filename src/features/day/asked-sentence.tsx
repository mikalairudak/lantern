import { Fragment } from "react";
import type { DayRequest } from "@/lib/schema/itinerary.schema";
import { chosenLabelsOf, energyLabelOf, weekdayOf } from "./sentence";

interface AskedSentenceProps {
  request: DayRequest;
  /** Said after other words, as in "Writing a lively Saturday in Lisbon". */
  isMidSentence?: boolean;
}

/** A word of several, as "with friends": one box, never broken. */
const WORDS_CLASSES = "whitespace-nowrap";
/**
 * A word of one: nothing breaks it, its comma after it included, unless it is longer than the
 * line, as a 58-letter Welsh town is, which then breaks where it must rather than push the
 * page sideways.
 */
const WORD_CLASSES = "wrap-anywhere";

/**
 * A written day's request, its energy word in its colour as in the headline. As there, each word
 * of the request is one unbreakable box with the comma after it, so "with friends" never
 * leaves "friends" alone on a line. A plain module, not a client one, so the not-found page
 * sets it on the server without the header's scripts.
 */
export function AskedSentence({ request, isMidSentence = false }: AskedSentenceProps) {
  const words = [request.city, ...chosenLabelsOf(request)];
  return (
    <>
      {isMidSentence ? "a" : "A"}{" "}
      <span className="text-energy">{energyLabelOf(request.energy)}</span> {weekdayOf(request.date)}{" "}
      in{" "}
      {words.map((word, index) => (
        <Fragment key={word}>
          {index > 0 && " "}
          <span className={word.includes(" ") ? WORDS_CLASSES : WORD_CLASSES}>
            {word}
            {index < words.length - 1 && ","}
          </span>
        </Fragment>
      ))}
    </>
  );
}
