'use client';

import type { ReactNode } from 'react';

/**
 * GameLinkQr — the QR code of a game's link, for people in the room to scan
 * from the host's screen (Arthur's spec, 9 November 2026: "a link and QR code
 * that add people to the Space and take them straight into the game").
 *
 * Drawing a QR code needs a package the app does not have yet; adding it is
 * Stay's call, asked in thread f730f71c (01:42Z, 10 November 2026). Until he
 * answers, this draws nothing and the invite shares the link alone. It is the
 * one place the code is drawn, and its callers already pass the link, so the
 * package's arrival changes this file only.
 */
export const GameLinkQr: (props: { url: string }) => ReactNode = () => null;
