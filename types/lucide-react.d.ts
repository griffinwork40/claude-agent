declare module 'lucide-react' {
  import { FC, SVGProps } from 'react';

  export interface LucideIconProps extends SVGProps<SVGSVGElement> {
    color?: string;
    size?: string | number;
    strokeWidth?: string | number;
  }

  export type LucideIcon = FC<LucideIconProps>;

  export const Wrench: LucideIcon;
  export const FileText: LucideIcon;
  export const Zap: LucideIcon;
  export const CheckCircle: LucideIcon;
  export const XCircle: LucideIcon;
  export const Brain: LucideIcon;
  export const Info: LucideIcon;
  export const Mic: LucideIcon;
  export const Square: LucideIcon;
  export const Loader2: LucideIcon;
  export default {} as Record<string, LucideIcon>;
}
