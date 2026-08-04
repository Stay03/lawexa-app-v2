import { OrganizationScreenFrame } from '@/v2/features/organizations/states';

/**
 * Route-level loading boundary for `/organization`.
 *
 * ONE SILHOUETTE, NOT TWO: it draws the SAME `OrganizationScreenFrame` the
 * live screen shows while `/my-organization` resolves, imported from the
 * feature's `states.tsx` so the two can never drift. `still` (no pulse): a
 * route boundary waits on an RSC payload, not a query.
 *
 * `aria-hidden` + `inert` per standards §8(ii), with exactly one
 * visually-hidden `role="status"` node carrying the announcement.
 */
export default function OrganizationLoading() {
  return (
    <>
      <span role="status" className="sr-only">
        Loading your organization
      </span>
      <div aria-hidden inert>
        <OrganizationScreenFrame still />
      </div>
    </>
  );
}
