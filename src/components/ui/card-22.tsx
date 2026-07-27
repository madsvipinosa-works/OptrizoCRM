"use client";

import * as React from 'react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Star, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

// Interface for component props for type safety and reusability
export interface PlaceCardProps {
  images: string[];
  tags: string[];
  rating?: number;
  title: string;
  dateRange?: string;
  hostType?: string;
  isTopRated?: boolean;
  description: string;
  pricePerNight?: number;
  buttonText?: string;
  className?: string;
  onAction?: () => void;
}

export const PlaceCard = ({
  images = [],
  tags = [],
  rating,
  title,
  dateRange,
  hostType,
  isTopRated = false,
  description,
  pricePerNight,
  buttonText = "Book Now",
  className,
  onAction,
}: PlaceCardProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  // Carousel image change handler
  const changeImage = (newDirection: number) => {
    if (!images || images.length === 0) return;
    setDirection(newDirection);
    setCurrentIndex((prevIndex) => {
      const nextIndex = prevIndex + newDirection;
      if (nextIndex < 0) return images.length - 1;
      if (nextIndex >= images.length) return 0;
      return nextIndex;
    });
  };

  // Animation variants for the carousel
  const carouselVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0,
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
    }),
  };

  // Animation variants for staggering content
  const contentVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 },
  };

  const hasImages = images && images.length > 0;

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      variants={contentVariants}
      whileHover={{ 
        scale: 1.03, 
        boxShadow: '0px 10px 30px -5px hsl(var(--foreground) / 0.1)',
        transition: { type: 'spring', stiffness: 300, damping: 20 }
      }}
      className={cn(
        'w-full max-w-sm overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-lg cursor-pointer flex flex-col justify-between',
        className
      )}
    >
      {/* Image Carousel Section */}
      <div className="relative group h-64 overflow-hidden">
        {hasImages ? (
          <AnimatePresence initial={false} custom={direction}>
            <motion.img
              key={currentIndex}
              src={images[currentIndex]}
              alt={title}
              custom={direction}
              variants={carouselVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              className="absolute h-full w-full object-cover"
            />
          </AnimatePresence>
        ) : (
          <div className="h-full w-full bg-muted flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        
        {/* Carousel Navigation */}
        {hasImages && images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/30 hover:bg-black/50 text-white"
              onClick={(e) => {
                e.stopPropagation();
                changeImage(-1);
              }}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-black/30 hover:bg-black/50 text-white"
              onClick={(e) => {
                e.stopPropagation();
                changeImage(1);
              }}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        {/* Top Badges and Rating */}
        {tags && tags.length > 0 && (
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="bg-background/70 backdrop-blur-sm">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {rating !== undefined && (
          <div className="absolute top-3 right-3">
            <Badge variant="secondary" className="flex items-center gap-1 bg-background/70 backdrop-blur-sm">
              <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" /> {rating}
            </Badge>
          </div>
        )}

        {/* Pagination Dots */}
        {hasImages && images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(index);
                }}
                className={cn(
                  'h-1.5 w-1.5 rounded-full transition-all',
                  currentIndex === index ? 'w-4 bg-white' : 'bg-white/50'
                )}
                aria-label={`Go to image ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Content Section */}
      <motion.div variants={contentVariants} className="p-5 space-y-4 flex-1 flex flex-col justify-between">
        <div className="space-y-3">
          <motion.div variants={itemVariants} className="flex justify-between items-start">
            <h3 className="text-xl font-bold">{title}</h3>
            {isTopRated && <Badge variant="outline">Top rated</Badge>}
          </motion.div>

          {(dateRange || hostType) && (
            <motion.div variants={itemVariants} className="text-sm text-muted-foreground">
              {dateRange && <span>{dateRange}</span>}
              {dateRange && hostType && <span> &bull; </span>}
              {hostType && <span>{hostType}</span>}
            </motion.div>
          )}

          <motion.p variants={itemVariants} className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {description}
          </motion.p>
        </div>

        <motion.div variants={itemVariants} className="flex justify-between items-center pt-2 mt-auto">
          {pricePerNight !== undefined ? (
            <p className="font-semibold">
              ${pricePerNight}{' '}
              <span className="text-sm font-normal text-muted-foreground">/ night</span>
            </p>
          ) : (
            <div />
          )}
          <Button className="group" onClick={onAction}>
            {buttonText}
            <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};
