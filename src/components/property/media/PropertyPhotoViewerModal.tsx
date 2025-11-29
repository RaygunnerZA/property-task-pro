import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { PropertyPhoto } from '@/hooks/property/usePropertyPhotos';
import { Button } from '@/components/filla';

interface PropertyPhotoViewerModalProps {
  photo: PropertyPhoto;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
}

export default function PropertyPhotoViewerModal({
  photo,
  onClose,
  onNext,
  onPrevious,
}: PropertyPhotoViewerModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-neutral-300 transition-colors z-10"
      >
        <X size={32} />
      </button>

      {/* Previous button */}
      {onPrevious && (
        <button
          onClick={onPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-neutral-300 transition-colors z-10"
        >
          <ChevronLeft size={48} />
        </button>
      )}

      {/* Next button */}
      {onNext && (
        <button
          onClick={onNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-neutral-300 transition-colors z-10"
        >
          <ChevronRight size={48} />
        </button>
      )}

      {/* Image */}
      <div className="max-w-7xl max-h-[90vh] p-4">
        <img
          src={photo.url}
          alt={photo.caption || 'Property photo'}
          className="max-w-full max-h-full object-contain"
        />
        {photo.caption && (
          <p className="text-white text-center mt-4 text-lg">{photo.caption}</p>
        )}
      </div>
    </div>
  );
}
