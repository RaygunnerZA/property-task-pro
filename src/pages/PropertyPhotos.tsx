import { useParams, useNavigate } from 'react-router-dom';
import { propertyHubPath, propertySubPath } from '@/lib/propertyRoutes';
import { Image } from 'lucide-react';
import MediaSection from '@/components/property/media/MediaSection';
import PropertyPhotoGallery from '@/components/property/media/PropertyPhotoGallery';
import PropertyUploadButton from '@/components/property/media/PropertyUploadButton';
import { usePropertyPhotos } from '@/hooks/property/usePropertyPhotos';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';
import { usePropertiesQuery } from '@/hooks/usePropertiesQuery';
import { PropertyPageScopeBar } from '@/components/properties/PropertyPageScopeBar';

export default function PropertyPhotos() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const propertyId = id || '';
  const { photos, isLoading } = usePropertyPhotos(propertyId);
  const { data: properties = [] } = usePropertiesQuery();
  const headerAccent =
    (
      properties.find((p: { id: string }) => p.id === propertyId) as
        | { icon_color_hex?: string | null }
        | undefined
    )?.icon_color_hex?.trim() || '#8EC9CE';

  return (
    <StandardPageWithBack
      title="Property Photos"
      subtitle="View and manage property images"
      backTo={propertyId ? propertyHubPath(propertyId) : '/'}
      icon={<Image className="h-6 w-6" />}
      maxWidth="xl"
      headerAccentColor={headerAccent}
      hideHeaderBack
      belowGradientRow={
        propertyId ? (
          <PropertyPageScopeBar
            propertyId={propertyId}
            hrefForProperty={(pid) => propertySubPath(pid, 'photos')}
          />
        ) : null
      }
    >
      <MediaSection
        title="Photo Gallery"
        action={<PropertyUploadButton label="Upload Photos" />}
      >
        {isLoading ? (
          <LoadingState message="Loading photos..." />
        ) : (
          <PropertyPhotoGallery photos={photos} />
        )}
      </MediaSection>
    </StandardPageWithBack>
  );
}
