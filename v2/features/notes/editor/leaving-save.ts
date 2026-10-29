/**
 * The last save an editor sends as it unmounts, as a promise that settles
 * `true` when it lands and `false` when it fails, so the chat's send can wait
 * for it (draft-flush.ts).
 *
 * It goes through the mutation's own promise (`mutateAsync`), never through
 * `mutate` with per-call callbacks: TanStack runs those only while the
 * mutation's observer still has a listener, and at unmount `useMutation` has
 * already let go of it, so the callbacks never ran and the promise never
 * settled (Frontend's review, 29 October 2026: every later send in the chat
 * then waited out its 3 s and warned that the edits had not saved).
 */
export function sendLeavingSave<Request>(send: (request: Request) => Promise<unknown>, request: Request): Promise<boolean> {
  return send(request).then(
    () => true,
    () => false,
  );
}
