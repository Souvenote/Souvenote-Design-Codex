'use client';

import * as React from 'react';
import {
  assetContentUrl,
  fetchCardDraftAssets,
  fetchCardDraftById,
  fetchPricingOffers,
  type CardDraftAsset,
  type PricingOffer,
} from '../lib/api';

const assetType = (asset: CardDraftAsset) => String(asset.assetType || asset.asset_type);

export function useDeliveryBackendData(cardDraftId: string | null, requestedAssetId: string | null) {
  const [generatedAssets, setGeneratedAssets] = React.useState<CardDraftAsset[]>([]);
  const [selectedImageAssetId, setSelectedImageAssetId] = React.useState<string | null>(requestedAssetId);
  const [messageText, setMessageText] = React.useState('');
  const [pricingOffers, setPricingOffers] = React.useState<PricingOffer[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!cardDraftId) {
      setGeneratedAssets([]);
      setSelectedImageAssetId(null);
      setError('Open Delivery from an approved card in Review or Saved Cards & Songs.');
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setGeneratedAssets([]);
    setSelectedImageAssetId(null);

    Promise.all([fetchCardDraftById(cardDraftId), fetchCardDraftAssets(cardDraftId), fetchPricingOffers()])
      .then(([cardDraft, assets, offers]) => {
        if (!active) return;
        if (cardDraft.status !== 'approved') {
          throw new Error('This card has not been approved. Go back to Review and approve the selected outputs first.');
        }

        const approvedIds = new Set(
          [cardDraft.approvedImageAssetId, cardDraft.approvedSongAssetId, cardDraft.approvedMessageAssetId].filter(
            (assetId): assetId is string => Boolean(assetId),
          ),
        );
        const approvedAssets = assets.filter((asset) => approvedIds.has(asset.id));
        const approvedImage = approvedAssets.find(
          (asset) => asset.id === cardDraft.approvedImageAssetId && assetType(asset) === 'image',
        );
        const approvedMessage = approvedAssets.find(
          (asset) => asset.id === cardDraft.approvedMessageAssetId && assetType(asset) === 'message',
        );

        if (!approvedImage || !approvedMessage) {
          throw new Error('The approved card outputs are unavailable. Go back to Review and try approval again.');
        }
        if (requestedAssetId && requestedAssetId !== approvedImage.id) {
          throw new Error('The requested image is not the approved image for this card.');
        }

        setGeneratedAssets(approvedAssets);
        setSelectedImageAssetId(approvedImage.id);
        setPricingOffers(offers.filter((offer) => offer.checkoutEnabled));
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error ? loadError.message : 'Generated assets could not be loaded from the backend.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [cardDraftId, requestedAssetId]);

  const songAsset = generatedAssets.find((asset) => assetType(asset) === 'song') || null;
  const messageAsset = generatedAssets.find((asset) => assetType(asset) === 'message') || null;

  React.useEffect(() => {
    if (!messageAsset?.id) {
      setMessageText('');
      return;
    }
    let active = true;
    fetch(assetContentUrl(messageAsset.id), { credentials: 'same-origin', cache: 'no-store' })
      .then(async (response) => (response.ok ? response.text() : ''))
      .then((text) => {
        if (active) setMessageText(text.trim());
      })
      .catch(() => {
        if (active) setMessageText('');
      });
    return () => {
      active = false;
    };
  }, [messageAsset?.id]);

  return { error, loading, messageText, pricingOffers, selectedImageAssetId, songAsset };
}
