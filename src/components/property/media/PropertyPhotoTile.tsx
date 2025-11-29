import { PropertyPhoto } from '@/hooks/property/usePropertyPhotos';
import { Surface } from '@/components/filla';

interface PropertyPhotoTileProps {
  photo: PropertyPhoto;
  onClick: () => void;
}

export default function PropertyPhotoTile({ photo, onClick }: PropertyPhotoTileProps) {
  return (
    <Surface
      variant="neomorphic"
      interactive
      className="aspect-square overflow-hidden group"
      onClick={onClick}
    >
      <div className="relative w-full h-full">
        <img
          src={photo.url}
          alt={photo.caption || 'Property photo'}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
        {photo.caption && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
            <p className="text-white text-xs font-medium">{photo.caption}</p>
          </div>
        )}
      </div>
    </Surface>
  );
}
