import type { Config } from 'tailwindcss';
import base from '@vrs/config/tailwind/base.cjs';

const config: Config = {
  ...(base as Config),
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
};

export default config;
