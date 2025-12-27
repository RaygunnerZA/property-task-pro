import { useParams } from 'react-router-dom';
import { Image } from 'lucide-react';
import MediaSection from '@/components/property/media/MediaSection';
import PropertyPhotoGallery from '@/components/property/media/PropertyPhotoGallery';
import PropertyUploadButton from '@/components/property/media/PropertyUploadButton';
import { usePropertyPhotos } from '@/hooks/property/usePropertyPhotos';
import { StandardPageWithBack } from '@/components/design-system/StandardPageWithBack';
import { LoadingState } from '@/components/design-system/LoadingState';

export default function PropertyPhotos() {
  const { id } = useParams<{ id: string }>();
  const { photos, isLoading } = usePropertyPhotos(id || '');

  return (
    <StandardPageWithBack
      title="Property Photos"
      subtitle="View and manage property images"
      backTo={`/properties/${id}`}
      icon={<Image className="h-6 w-6" />}
      maxWidth="xl"
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
