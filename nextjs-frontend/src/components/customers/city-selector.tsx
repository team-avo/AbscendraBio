'use client';

import { useState, useMemo, useCallback } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { City } from 'country-state-city';
import logger from '@/lib/logger';

interface CitySelectorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

// Get all US cities and cache them - only load once
let cachedCities: string[] | null = null;

const getCities = (): string[] => {
  if (cachedCities) return cachedCities;
  
  try {
    const cities = City.getCitiesOfCountry('US') || [];
    const uniqueCities = Array.from(new Set(cities.map(city => city.name))).sort();
    cachedCities = uniqueCities;
    return uniqueCities;
  } catch (error) {
    logger.error('Error loading cities:', { error: error });
    return [];
  }
};

// Limit initial display to popular cities or empty, require search
const POPULAR_CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'San Francisco', 'Columbus', 'Fort Worth', 'Charlotte', 'Seattle', 'Denver',
  'Washington', 'Boston', 'El Paso', 'Detroit', 'Nashville', 'Portland',
  'Oklahoma City', 'Las Vegas', 'Memphis', 'Louisville', 'Baltimore', 'Milwaukee'
];

export function CitySelector({ value, onChange, placeholder = "Select city", className, id }: CitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [allCities, setAllCities] = useState<string[]>([]);
  const [isLoadingCities, setIsLoadingCities] = useState(false);

  // Load cities asynchronously when dropdown opens or when user starts searching
  const loadCitiesIfNeeded = useCallback(() => {
    if (allCities.length > 0 || isLoadingCities) return;
    
    setIsLoadingCities(true);
    // Use requestIdleCallback or setTimeout to load in background
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => {
        const cities = getCities();
        setAllCities(cities);
        setIsLoadingCities(false);
      }, { timeout: 1000 });
    } else {
      setTimeout(() => {
        const cities = getCities();
        setAllCities(cities);
        setIsLoadingCities(false);
      }, 0);
    }
  }, [allCities.length, isLoadingCities]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    // If no search, show popular cities only (fast)
    if (!searchValue.trim()) {
      return POPULAR_CITIES;
    }

    // When searching, use all cities if loaded, otherwise start loading
    const searchLower = searchValue.toLowerCase().trim();
    
    // If cities not loaded yet, trigger loading
    if (allCities.length === 0 && !isLoadingCities) {
      loadCitiesIfNeeded();
    }

    // Search in popular cities first (instant results)
    const popularMatches = POPULAR_CITIES.filter(city => 
      city.toLowerCase().includes(searchLower)
    );

    // If we have all cities loaded, search in them too
    if (allCities.length > 0) {
      const allMatches = allCities.filter(city => 
        city.toLowerCase().includes(searchLower) && 
        !POPULAR_CITIES.includes(city) // Avoid duplicates
      );
      
      // Combine popular matches first, then other matches, limit to 100
      return [...popularMatches, ...allMatches].slice(0, 100);
    }

    // If cities not loaded yet, return popular matches only
    return popularMatches;
  }, [searchValue, allCities, isLoadingCities, loadCitiesIfNeeded]);

  const selectedCity = value || '';

  const handleOpenChange = useCallback((newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      // Start loading cities in background when dropdown opens
      loadCitiesIfNeeded();
    } else {
      // Reset search when closing
      setSearchValue('');
    }
  }, [loadCitiesIfNeeded]);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">
            {selectedCity || placeholder}
          </span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search city..."
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList className="max-h-[300px] overflow-y-auto">
            <CommandEmpty>
              {searchValue ? `No city found for "${searchValue}"` : 'Start typing to search cities...'}
            </CommandEmpty>
            <CommandGroup>
              {filteredCities.length > 0 ? (
                filteredCities.map((city) => {
                  const isSelected = selectedCity === city;
                  return (
                    <CommandItem
                      key={city}
                      value={city}
                      onSelect={() => {
                        onChange(isSelected ? '' : city);
                        setOpen(false);
                        setSearchValue('');
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          isSelected ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {city}
                    </CommandItem>
                  );
                })
              ) : (
                !searchValue && (
                  <div className="px-2 py-1.5 text-sm text-muted-foreground">
                    Start typing to search cities...
                  </div>
                )
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

