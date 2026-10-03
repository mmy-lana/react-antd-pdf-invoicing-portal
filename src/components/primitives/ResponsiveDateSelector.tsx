import React from 'react';
import { DatePicker } from 'antd';
import type { Dayjs } from 'dayjs';
import { useResponsiveBreakpoints } from '@/hooks/useResponsiveBreakpoints';

export interface ResponsiveDateSelectorProps {
  id?: string;
  value?: Dayjs | null;
  onChange?: (chosenDate: Dayjs | null) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
  earliestDate?: Dayjs;
  latestDate?: Dayjs;
  className?: string;
}

const DISPLAY_FORMAT = 'MMM DD, YYYY';

/**
 * One calendar, two ergonomics. Pointer-precise devices get the compact inline
 * picker that fits a dense filter bar; touch devices get a full-width control
 * that skips the extra "OK" confirmation tap and renders at 16px so iOS does
 * not zoom the page on focus.
 */
export const ResponsiveDateSelector: React.FC<ResponsiveDateSelectorProps> = ({
  id,
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  allowClear = true,
  earliestDate,
  latestDate,
  className,
}) => {
  const { isMobile, isCoarsePointer } = useResponsiveBreakpoints();
  const prefersTouchInput = isMobile || isCoarsePointer;

  return (
    <DatePicker
      id={id}
      className={className}
      picker="date"
      value={value ?? null}
      onChange={(chosenDate) => onChange?.(chosenDate ?? null)}
      placeholder={placeholder}
      disabled={disabled}
      allowClear={allowClear}
      format={DISPLAY_FORMAT}
      disabledDate={(candidate) => {
        if (earliestDate && candidate.isBefore(earliestDate, 'day')) return true;
        if (latestDate && candidate.isAfter(latestDate, 'day')) return true;
        return false;
      }}
      // Touch input drops the confirm step; pointer input keeps it for precision.
      needConfirm={!prefersTouchInput}
      style={
        prefersTouchInput
          ? {
              width: '100%',
              minWidth: 0,
              minHeight: 'var(--touch-target-min, 44px)',
              fontSize: 'var(--input-font-size-touch, 16px)',
            }
          : { width: '100%', minWidth: 0 }
      }
      popupClassName={prefersTouchInput ? 'date-picker-popup-touch' : undefined}
    />
  );
};
