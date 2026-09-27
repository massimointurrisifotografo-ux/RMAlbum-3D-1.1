import React from 'react';

type P = { size?: number };
const s = (n = 16) => ({ width: n, height: n, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const IconPlus = ({ size }: P) => (<svg {...s(size)}><path d="M12 5v14M5 12h14" /></svg>);
export const IconCopy = ({ size }: P) => (<svg {...s(size)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>);
export const IconTrash = ({ size }: P) => (<svg {...s(size)}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></svg>);
export const IconLeft = ({ size }: P) => (<svg {...s(size)}><path d="M15 18l-6-6 6-6" /></svg>);
export const IconRight = ({ size }: P) => (<svg {...s(size)}><path d="M9 18l6-6-6-6" /></svg>);
export const IconUp = ({ size }: P) => (<svg {...s(size)}><path d="M18 15l-6-6-6 6" /></svg>);
export const IconDown = ({ size }: P) => (<svg {...s(size)}><path d="M6 9l6 6 6-6" /></svg>);
export const IconEye = ({ size }: P) => (<svg {...s(size)}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>);
export const IconSave = ({ size }: P) => (<svg {...s(size)}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>);
export const IconFolder = ({ size }: P) => (<svg {...s(size)}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>);
export const IconImage = ({ size }: P) => (<svg {...s(size)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>);
export const IconDownload = ({ size }: P) => (<svg {...s(size)}><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>);
export const IconFile = ({ size }: P) => (<svg {...s(size)}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6" /></svg>);
export const IconClose = ({ size }: P) => (<svg {...s(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconReset = ({ size }: P) => (<svg {...s(size)}><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>);
