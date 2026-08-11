'use client';

import * as React from 'react';
import { assetContentUrl, fetchEnvironmentCapabilities } from '../lib/api';
import type { CardDraftAsset } from '../lib/api';

function matchesType(asset: CardDraftAsset, type: string): boolean {
  return String(asset.assetType || asset.asset_type) === type;
}

export function useBmcReviewAssets(assets: CardDraftAsset[]) {
  const generatedImageAsset = React.useMemo(
    () => assets.find((asset) => matchesType(asset, 'image')) || null,
    [assets],
  );
  const songAsset = React.useMemo(() => assets.find((asset) => matchesType(asset, 'song')) || null, [assets]);
  const messageAsset = React.useMemo(() => assets.find((asset) => matchesType(asset, 'message')) || null, [assets]);
  const [imgApproved, setImgApproved] = React.useState(false);
  const [songApproved, setSongApproved] = React.useState(false);
  const [msgApproved, setMsgApproved] = React.useState(false);
  const [messageText, setMessageText] = React.useState('');
  const [capabilityLabel, setCapabilityLabel] = React.useState('Deterministic beta mock');

  React.useEffect(() => setImgApproved(Boolean(generatedImageAsset?.approvedAt)), [generatedImageAsset]);
  React.useEffect(() => setSongApproved(Boolean(songAsset?.approvedAt)), [songAsset]);
  React.useEffect(() => setMsgApproved(Boolean(messageAsset?.approvedAt)), [messageAsset]);

  React.useEffect(() => {
    let cancelled = false;
    fetchEnvironmentCapabilities()
      .then((capabilities) => {
        if (!cancelled) setCapabilityLabel(capabilities.label);
      })
      .catch(() => {
        // The conservative static label remains if capability discovery is unavailable.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!messageAsset?.id) {
      setMessageText('');
      return;
    }
    let cancelled = false;
    fetch(assetContentUrl(messageAsset.id), { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (!cancelled) setMessageText(text.trim());
      })
      .catch(() => {
        if (!cancelled) setMessageText('');
      });
    return () => {
      cancelled = true;
    };
  }, [messageAsset?.id]);

  return {
    generatedImageAsset,
    songAsset,
    messageAsset,
    imgApproved,
    songApproved,
    msgApproved,
    setImgApproved,
    setSongApproved,
    setMsgApproved,
    messageText,
    capabilityLabel,
  };
}
