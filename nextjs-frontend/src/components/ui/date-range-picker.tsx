'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatePickerWithRangeProps {
  value: {
    from: Date | undefined;
    to: Date | undefined;
  };
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  placeholder?: string;
  className?: string;
}

export function DatePickerWithRange({ 
  value, 
  onChange, 
  placeholder = "Pick a date range",
  className 
}: DatePickerWithRangeProps) {
  const [open, setOpen] = useState(false);

  const handleFromDateChange = (date: string) => {
    const newDate = date ? new Date(date) : undefined;
    onChange({ from: newDate, to: value.to });
  };

  const handleToDateChange = (date: string) => {
    const newDate = date ? new Date(date) : undefined;
    onChange({ from: value.from, to: newDate });
  };

  const handleClear = () => {
    onChange({ from: undefined, to: undefined });
  };

  const formatDate = (date: Date | undefined) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDisplayText = () => {
    if (value.from && value.to) {
      return `${formatDate(value.from)} - ${formatDate(value.to)}`;
    }
    if (value.from) {
      return `From ${formatDate(value.from)}`;
    }
    if (value.to) {
      return `Until ${formatDate(value.to)}`;
    }
    return placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value.from && !value.to && "text-muted-foreground",
            className
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {getDisplayText()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <div className="grid gap-2">
            <label htmlFor="from-date" className="text-sm font-medium">
              From Date
            </label>
            <input
              id="from-date"
              type="date"
              value={value.from ? value.from.toISOString().split('T')[0] : ''}
              onChange={(e) => handleFromDateChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          
          <div className="grid gap-2">
            <label htmlFor="to-date" className="text-sm font-medium">
              To Date
            </label>
            <input
              id="to-date"
              type="date"
              value={value.to ? value.to.toISOString().split('T')[0] : ''}
              onChange={(e) => handleToDateChange(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="flex justify-between">
            <Button variant="outline" size="sm" onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}