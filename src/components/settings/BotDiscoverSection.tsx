import type { Component } from 'solid-js';
import type { Application } from '../../api/developers';
import { applyBotListing, getBotListing, withdrawBotListing } from '../../api/discover';
import { DiscoverListingForm } from './DiscoverListingForm';
import { t } from '../../i18n';

/** Developers → an application: list its bot on this instance's Discover page. */
export const BotDiscoverSection: Component<{ app: Application }> = (props) => {
  const blocked = () => (!props.app.has_bot ? t('discover.listing.noBot') : !props.app.bot_public ? t('discover.listing.botPrivate') : undefined);
  return (
    <DiscoverListingForm
      load={() => getBotListing(props.app.id)}
      apply={(input) => applyBotListing(props.app.id, input)}
      withdraw={() => withdrawBotListing(props.app.id)}
      blocked={blocked()}
    />
  );
};
