/**
 * How long the view is held after a gesture on the chart, from the header's last glide since
 * (`GlidingHeight`'s `isViewHeldOnScreen`): the hold lasts while the header glides and this long
 * after it comes to rest, so the clause and the line's lead a swap or a drag brings, which on a
 * phone the header takes once the finger lifts, grow up and out of the screen rather than move
 * the chart under the hand.
 */
export const VIEW_HELD_AFTER_GESTURE_MS = 2000;
