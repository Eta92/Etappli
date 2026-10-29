import { STAGE } from './stage.config';

export interface Viewport {
  width: number;
  height: number;
}

/** A box in station coordinates: px from the station center (the image center). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Station geometry for a viewport, shared by the HTML station and the canvas hull.
 * Panels are given at their full (open) size; `openStation` gives what is visible.
 */
export interface StationLayout {
  /** Panels open on the sides (true) or up and down (false). */
  row: boolean;
  image: Rect;
  /** Title bar of the compact station. */
  title: Rect;
  /** Vertical shift of the title when the station is open (column: pushed up by the description). */
  titleShift: number;
  /** Description panel: above the image (column) or on its left (row). */
  details: Rect;
  /** Context and technos panel: below the image (column) or on its right (row). */
  extra: Rect;
}

/** Where a station is drawn for a given camera position. */
export interface StationPose {
  index: number;
  /** Vertical offset from the docked position (px). Next stations are above (the ship flies up). */
  offsetY: number;
  scale: number;
  /** 0 when docked, 1 or more when a station away. */
  distance: number;
  visible: boolean;
}

/** Screen position of a docked station center, and of the ship. */
export function stationCenter({ width, height }: Viewport): { x: number; y: number } {
  return { x: width / 2, y: height * STAGE.centerY };
}

export const shipPosition = stationCenter;

export function stationLayout(viewport: Viewport): StationLayout {
  return rowLayout(viewport) ?? columnLayout(viewport);
}

function columnLayout(viewport: Viewport): StationLayout {
  const { width, height } = viewport;
  const { maxImage, imageHeightRatio, imageRatio, titleHeight, border, gap } = STAGE.station;
  const fitWidth = Math.max(0, Math.min(maxImage, width - 2 * (STAGE.margin + border)));
  const imageH = Math.min(fitWidth / imageRatio, height * imageHeightRatio);
  const imageW = imageH * imageRatio;
  const halfW = imageW / 2;
  const halfH = imageH / 2;
  const centerY = stationCenter(viewport).y;
  const above = Math.max(0, centerY - STAGE.topZone - halfH - gap - titleHeight - border);
  const below = Math.max(0, height - centerY - STAGE.margin - halfH - gap - border);
  return {
    row: false,
    image: { x: -halfW, y: -halfH, width: imageW, height: imageH },
    title: { x: -halfW, y: -halfH - titleHeight, width: imageW, height: titleHeight },
    titleShift: -(gap + above),
    details: { x: -halfW, y: -halfH - gap - above, width: imageW, height: above },
    extra: { x: -halfW, y: halfH + gap, width: imageW, height: below },
  };
}

function rowLayout(viewport: Viewport): StationLayout | null {
  const { width, height } = viewport;
  const { maxImage, imageRatio, titleHeight, border, gap, rowMinWidth, sidePanelMinWidth, sidePanelMaxWidth } =
    STAGE.station;
  if (width < rowMinWidth && width <= height) {
    return null;
  }
  // The title sits above the image: keep it below the HUD, the station centered.
  const centerY = stationCenter(viewport).y;
  const vertical = 2 * Math.min(centerY - STAGE.topZone - titleHeight - border, height - centerY - STAGE.margin - border);
  // Shrink the image before giving up on side panels of the minimum width.
  const sideRoom = width - 2 * (sidePanelMinWidth + gap + border + STAGE.margin);
  const imageW = Math.max(0, Math.min(maxImage, vertical * imageRatio, sideRoom));
  const imageH = imageW / imageRatio;
  const halfW = imageW / 2;
  const halfH = imageH / 2;
  const panel = Math.min(sidePanelMaxWidth, width / 2 - halfW - gap - border - STAGE.margin);
  if (panel < sidePanelMinWidth || imageW === 0) {
    return null;
  }
  return {
    row: true,
    image: { x: -halfW, y: -halfH, width: imageW, height: imageH },
    title: { x: -halfW, y: -halfH - titleHeight, width: imageW, height: titleHeight },
    titleShift: 0,
    details: { x: -halfW - gap - panel, y: -halfH, width: panel, height: imageH },
    extra: { x: halfW + gap, y: -halfH, width: panel, height: imageH },
  };
}

/** Visible part of a station opened at `open` (0 compact, 1 open, eased). */
export interface OpenStation {
  titleY: number;
  /** Outer hull, border included. */
  hull: Rect;
  /** Visible length of each panel along its opening axis (px). */
  detailsSize: number;
  extraSize: number;
}

export function openStation(layout: StationLayout, open: number): OpenStation {
  const { border, gap } = STAGE.station;
  const { image, title, details, extra } = layout;
  const titleY = title.y + layout.titleShift * open;
  if (layout.row) {
    const reach = (gap + details.width) * open;
    return {
      titleY,
      hull: {
        x: image.x - reach - border,
        y: titleY - border,
        width: image.width + 2 * (reach + border),
        height: image.y + image.height - titleY + 2 * border,
      },
      detailsSize: details.width * open,
      extraSize: extra.width * open,
    };
  }
  const bottom = image.y + image.height + (gap + extra.height) * open + border;
  return {
    titleY,
    hull: { x: image.x - border, y: titleY - border, width: image.width + 2 * border, height: bottom - (titleY - border) },
    detailsSize: details.height * open,
    extraSize: extra.height * open,
  };
}

export function stationPose(index: number, camera: number, viewport: Viewport): StationPose {
  const spacing = viewport.height * STAGE.stationSpacing;
  const offsetY = (camera - index) * spacing;
  const distance = Math.abs(index - camera);
  return {
    index,
    offsetY,
    scale: 1 - (1 - STAGE.awayScale) * Math.min(distance, 1),
    distance,
    visible: Math.abs(offsetY) < viewport.height,
  };
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
