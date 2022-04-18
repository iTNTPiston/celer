import { Coord } from "core/compiler";

export interface MapSegment {
    targetCoord: Coord,
    targetIcon: string,
    iconSize: IconSize
}

export enum IconSize{
    Tiny = 16,
    Small = 24,
    Medium = 32,
    Big = 48,
    Huge = 64
}

export enum MapZoomViewLevel {
    Overview = 2, // Looking at the entire map or most of the map (2-3)
    Region = 4, // 4-5
    Detail = 6, // Looking at a detailed area, such as village or town (6-8)
}
