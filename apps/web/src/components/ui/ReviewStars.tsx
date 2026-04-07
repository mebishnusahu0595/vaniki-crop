import React from 'react';
import { Star } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ReviewStarsProps {
  rating: number;
  interactive?: boolean;
  onChange?: (rating: number) => void;
  size?: number;
}

const ReviewStars: React.FC<ReviewStarsProps> = ({ 
  rating, 
  interactive = false, 
  onChange,
  size = 16 
}) => {
  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          disabled={!interactive}
          onClick={() => interactive && onChange && onChange(i)}
          className={cn(
            'transition-transform duration-200',
            interactive ? 'hover:scale-125 focus:outline-none' : 'cursor-default',
          )}
        >
          <Star 
            size={size} 
            fill={i <= rating ? "currentColor" : "none"}
            className={i <= rating ? "text-yellow-400" : "text-primary-900/10"}
            strokeWidth={2}
          />
        </button>
      ))}
    </div>
  );
};

export default ReviewStars;
