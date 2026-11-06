import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function FilterSelect({
  value,
  onChange,
  options,
  placeholder = 'All',
  className = undefined,
  ariaLabel = undefined,
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        aria-label={ariaLabel ?? placeholder}
        className={cn('h-[30px] gap-1.5 rounded-[7px] border-border bg-surface px-2.5 text-[12.5px] shadow-none', className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent align="start">
        {options.map((option) => (
          <SelectItem key={String(option.value)} value={String(option.value)} className="text-[12.5px]">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}