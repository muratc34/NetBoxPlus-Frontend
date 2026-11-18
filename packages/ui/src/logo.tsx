import { classNames } from './class-names';

export interface LogoProps {
  className?: string;
}

/** The NETBOX+ word mark. Screen readers hear the product name instead of the letters. */
export function Logo({ className }: LogoProps) {
  return (
    <span className={classNames('font-display font-extrabold tracking-wide text-ink-strong', className)}>
      <span aria-hidden="true">
        <span className="text-brand">NET</span>BOX+
      </span>
      <span className="sr-only">NetBoxPlus</span>
    </span>
  );
}
