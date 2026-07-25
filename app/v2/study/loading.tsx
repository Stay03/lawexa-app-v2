import { HomeFallback } from '@/v2/shell/designs/HomeFallback';

/**
 * Route-level loading boundary for `/study`.
 *
 * THE POINT OF THE ROUTE SPLIT. The fallback is told which tab it is drawing, as a
 * prop, from the route itself — so it draws the Study shape. It used to read the
 * tab from a browser store that the server could not see, which is why a hard load
 * on this tab drew the CHAT skeleton first (owner: "i first see the chat screen load
 * for a quick second then i see the study screen jumpy loads").
 */
export default function Loading() {
  return <HomeFallback tab="study" />;
}
