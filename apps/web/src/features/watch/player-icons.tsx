import type { ReactNode } from 'react';

function Icon({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-7" fill="currentColor">
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Icon>
    <path d="M7 4.5v15l12.5-7.5z" />
  </Icon>
);

export const PauseIcon = () => (
  <Icon>
    <path d="M6 4.5h4v15H6zM14 4.5h4v15h-4z" />
  </Icon>
);

export const RewindIcon = () => (
  <Icon>
    <path d="M12 5V2L7 6l5 4V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z" />
    <text x="12" y="16.5" textAnchor="middle" fontSize="6.5" fontWeight="700">
      10
    </text>
  </Icon>
);

export const ForwardIcon = () => (
  <Icon>
    <path d="M12 5V2l5 4-5 4V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z" />
    <text x="12" y="16.5" textAnchor="middle" fontSize="6.5" fontWeight="700">
      10
    </text>
  </Icon>
);

export const VolumeIcon = ({ muted }: Readonly<{ muted: boolean }>) => (
  <Icon>
    <path d="M4 9v6h4l5 4.5v-15L8 9z" />
    {muted ? (
      <path d="M16 9.4 17.4 8l2.1 2.1L21.6 8 23 9.4l-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z" />
    ) : (
      <path d="M15.5 8.5a4.5 4.5 0 0 1 0 7v-2.3a2.3 2.3 0 0 0 0-2.4zM15.5 4.6a8.5 8.5 0 0 1 0 14.8v-2.2a6.4 6.4 0 0 0 0-10.4z" />
    )}
  </Icon>
);

export const FullscreenIcon = ({ active }: Readonly<{ active: boolean }>) => (
  <Icon>
    {active ? (
      <path d="M8 3v5H3v2h7V3zM16 3h-2v7h7V8h-5zM3 14v2h5v5h2v-7zM14 14v7h2v-5h5v-2z" />
    ) : (
      <path d="M3 3h7v2H5v5H3zM14 3h7v7h-2V5h-5zM3 14h2v5h5v2H3zM19 14h2v7h-7v-2h5z" />
    )}
  </Icon>
);

export const BackIcon = () => (
  <Icon>
    <path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <path
      d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM13 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
      transform="translate(-1 0)"
    />
  </Icon>
);
