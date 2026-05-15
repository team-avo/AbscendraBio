'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Calendar as CalendarPrimitive } from '@/components/ui/calendar';
import { api } from '@/lib/api';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import logger from '@/lib/logger';

export interface OrderDateFilterProps {
    range: string;
    setRange: (range: string) => void;
    from: Date | undefined;
    setFrom: (date: Date | undefined) => void;
    to: Date | undefined;
    setTo: (date: Date | undefined) => void;
    salesChannelId?: string;
    setSalesChannelId?: (id: string) => void;
    onSalesChannelChange?: (id: string | undefined) => void;
    showSalesChannel?: boolean;
    className?: string;
}

export function OrderDateFilter({
    range,
    setRange,
    from,
    setFrom,
    to,
    setTo,
    salesChannelId,
    setSalesChannelId,
    onSalesChannelChange,
    showSalesChannel,
    className
}: OrderDateFilterProps) {
    const [salesChannels, setSalesChannels] = React.useState<any[]>([]);

    React.useEffect(() => {
        (async () => {
            try {
                const res = await api.getSalesChannels();
                if (res.success && res.data) {
                    setSalesChannels(res.data);
                }
            } catch (error) {
                logger.error('Failed to fetch sales channels:', { error: error });
            }
        })();
    }, []);

    const handleRangeChange = (value: string) => {
        setRange(value);
        const now = new Date();

        if (value === 'day') {
            const d = from || new Date();
            setFrom(d);
            setTo(d);
        } else if (value === 'last_7_days') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            setFrom(d);
            setTo(now);
        } else if (value === 'last_14_days') {
            const d = new Date();
            d.setDate(d.getDate() - 13);
            setFrom(d);
            setTo(now);
        } else if (value === 'last_30_days') {
            const d = new Date();
            d.setDate(d.getDate() - 29);
            setFrom(d);
            setTo(now);
        } else if (value === 'last_60_days') {
            const d = new Date();
            d.setDate(d.getDate() - 59);
            setFrom(d);
            setTo(now);
        } else if (value === 'last_90_days') {
            const d = new Date();
            d.setDate(d.getDate() - 89);
            setFrom(d);
            setTo(now);
        } else if (value === 'last_year') {
            const d = new Date();
            d.setFullYear(d.getFullYear() - 1);
            setFrom(d);
            setTo(now);
        } else if (value === 'all') {
            setFrom(undefined);
            setTo(undefined);
        }
    };

    const handleDaySelect = (d: Date | undefined) => {
        if (d) {
            setFrom(d);
            setTo(d);
        } else {
            setFrom(undefined);
            setTo(undefined);
        }
    };

    return (
        <div className={`flex flex-wrap items-stretch sm:items-center gap-2 ${className}`}>
            {(showSalesChannel || onSalesChannelChange || setSalesChannelId) && (
                <Select
                    value={salesChannelId || 'all'}
                    onValueChange={(val) => {
                        const out = val === 'all' ? '' : val;
                        if (setSalesChannelId) setSalesChannelId(out);
                        if (onSalesChannelChange) onSalesChannelChange(val === 'all' ? undefined : val);
                    }}
                >
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="All Orders" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Orders</SelectItem>
                        <SelectItem value="research">Ascendra Bio orders</SelectItem>
                        <SelectItem value="channels">All Sales Channels</SelectItem>
                        <SelectSeparator />
                        {salesChannels.map((channel) => (
                            <SelectItem key={channel.id} value={channel.id}>
                                {channel.companyName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            <Select value={range} onValueChange={handleRangeChange}>
                <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Date Range" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="day">1 Day</SelectItem>
                    <SelectItem value="last_7_days">Last 7 days</SelectItem>
                    <SelectItem value="last_14_days">Last 14 days</SelectItem>
                    <SelectItem value="last_30_days">Last 30 days</SelectItem>
                    <SelectItem value="last_60_days">Last 60 days</SelectItem>
                    <SelectItem value="last_90_days">Last 90 days</SelectItem>
                    <SelectItem value="last_year">Last year</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
            </Select>

            {range === 'day' && (
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full sm:w-[200px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {from ? from.toLocaleDateString('en-US') : 'Select date'}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <CalendarPrimitive
                            mode="single"
                            selected={from}
                            onSelect={handleDaySelect}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
            )}

            {range === 'custom' && (
                <div className="flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-[140px] justify-start text-xs sm:text-sm">
                                <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                {from ? from.toLocaleDateString('en-US') : 'From'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPrimitive mode="single" selected={from} onSelect={setFrom} initialFocus />
                        </PopoverContent>
                    </Popover>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-[140px] justify-start text-xs sm:text-sm">
                                <CalendarIcon className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                                {to ? to.toLocaleDateString('en-US') : 'To'}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPrimitive mode="single" selected={to} onSelect={setTo} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            )}
        </div>
    );
}
