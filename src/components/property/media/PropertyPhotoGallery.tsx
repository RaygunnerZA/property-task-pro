import { useState } from 'react';
import PropertyPhotoTile from './PropertyPhotoTile';
import PropertyPhotoViewerModal from './PropertyPhotoViewerModal';
import { PropertyPhoto } from '@/hooks/property/usePropertyPhotos';

interface PropertyPhotoGalleryProps {
  photos: PropertyPhoto[];
}

export default function PropertyPhotoGallery({ photos }: PropertyPhotoGalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<PropertyPhoto | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const handlePhotoClick = (photo: PropertyPhoto, index: number) => {
    setSelectedPhoto(photo);
    setSelectedIndex(index);
  };

  const handleClose = () => {
    setSelectedPhoto(null);
  };

  const handleNext = () => {
    const nextIndex = (selectedIndex + 1) % photos.length;
    setSelectedIndex(nextIndex);
    setSelectedPhoto(photos[nextIndex]);
  };

  const handlePrevious = () => {
    const prevIndex = (selectedIndex - 1 + photos.length) % photos.length;
    setSelectedIndex(prevIndex);
    setSelectedPhoto(photos[prevIndex]);
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-neutral-600">
        <p>No photos available</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {photos.map((photo, index) => (
          <PropertyPhotoTile
            key={photo.id}
            photo={photo}
            onClick={() => handlePhotoClick(photo, index)}
          />
        ))}
      </div>

      {selectedPhoto && (
        <PropertyPhotoViewerModal
          photo={selectedPhoto}
          onClose={handleClose}
          onNext={photos.length > 1 ? handleNext : undefined}
          onPrevious={photos.length > 1 ? handlePrevious : undefined}
        />
      )}
    </>
  );
}
