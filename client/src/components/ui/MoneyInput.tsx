import { DollarSign } from 'lucide-react';
import { Input } from './Input';

/**
 * Text input for dollar amounts. Displays thousands separators as the
 * user types (20000 -> 20,000), reports a plain number to the caller,
 * and drops cents by default — money fields across the app should read
 * like money, not like raw integers.
 */
interface MoneyInputProps {
  value: number | '' | undefined;
  onChange: (value: number | undefined) => void;
  label?: string;
  error?: string;
  placeholder?: string;
  allowCents?: boolean;
  disabled?: boolean;
  className?: string;
}

export function formatMoneyString(raw: string, allowCents = false): string {
  if (!raw) return '';
  const [int, dec] = raw.split('.');
  const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return allowCents && dec !== undefined ? `${formatted}.${dec}` : formatted;
}

export function MoneyInput({
  value,
  onChange,
  label,
  error,
  placeholder = '5,000',
  allowCents = false,
  disabled,
  className,
}: MoneyInputProps) {
  const display =
    value === undefined || value === ''
      ? ''
      : formatMoneyString(String(allowCents ? value : Math.round(Number(value))), allowCents);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pattern = allowCents ? /[^0-9.]/g : /[^0-9]/g;
    const raw = e.target.value.replace(pattern, '');
    if (!raw) {
      onChange(undefined);
      return;
    }
    const n = Number(raw);
    onChange(Number.isFinite(n) ? n : undefined);
  };

  return (
    <Input
      label={label}
      error={error}
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      inputMode="numeric"
      prefix={<DollarSign className="h-3.5 w-3.5" />}
      disabled={disabled}
      className={className}
    />
  );
}
