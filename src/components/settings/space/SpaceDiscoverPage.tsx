import type { Component } from 'solid-js';
import type { Space } from '../../../api/spaces';
import { applySpaceListing, getSpaceListing, withdrawSpaceListing } from '../../../api/discover';
import { DiscoverListingForm } from '../DiscoverListingForm';
import { t } from '../../../i18n';

interface Props {
  spaceId: string;
  space: Space;
  onError: (msg: string) => void;
}

/** Space settings → Discover: apply to be listed on this instance's Discover page. */
export const SpaceDiscoverPage: Component<Props> = (props) => (
  <DiscoverListingForm
    load={() => getSpaceListing(props.spaceId)}
    apply={(input) => applySpaceListing(props.spaceId, input)}
    withdraw={() => withdrawSpaceListing(props.spaceId)}
    blocked={props.space.federation ? t('discover.listing.mirrored', { domain: props.space.federation.origin_domain }) : undefined}
    onError={props.onError}
  />
);
