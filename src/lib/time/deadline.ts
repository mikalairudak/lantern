/**
 * The work, or a rejection naming `what` once the deadline passes, whichever comes first. A
 * store call that answers after it may still have changed the store: a hold then expires, and
 * a take costs that visitor one call of the day.
 */
export function beforeDeadline<T>(
  work: Promise<T>,
  deadline: AbortSignal,
  what: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const expire = (): void => reject(new Error(`${what} did not answer in time`));
    if (deadline.aborted) expire();
    deadline.addEventListener("abort", expire, { once: true });
    work.then(resolve, reject).finally(() => deadline.removeEventListener("abort", expire));
  });
}
